# API Rate Limiting

## Overview
This document outlines the API rate limiting strategy for the Retail-App.

## Current Implementation

### Global Rate Limit
- **Limit**: 200 requests per minute per IP address
- **Scope**: All endpoints except `/health`
- **Implementation**: In-memory TTLCache (single-worker only)
- **Reset**: Sliding window (1 minute)

### Login Rate Limit
- **Limit**: 5 attempts per 15 minutes per IP address
- **Scope**: `/api/auth/login` endpoint only
- **Implementation**: In-memory TTLCache
- **Reset**: Fixed window (15 minutes)

## Rate Limit Tiers

### Free Tier (Default)
- **Requests**: 200 per minute
- **Burst**: 10 requests per second
- **Features**: Basic API access

### Premium Tier (Future)
- **Requests**: 1000 per minute
- **Burst**: 50 requests per second
- **Features**: Extended API access, priority support

### Enterprise Tier (Future)
- **Requests**: 5000 per minute
- **Burst**: 200 requests per second
- **Features**: Unlimited API access, dedicated support, custom integrations

## Rate Limit Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 150
X-RateLimit-Reset: 1717084800
X-RateLimit-Reset-After: 45
```

### Header Definitions
- `X-RateLimit-Limit`: Maximum requests allowed in the current window
- `X-RateLimit-Remaining`: Requests remaining in the current window
- `X-RateLimit-Reset`: Unix timestamp when the current window resets
- `X-RateLimit-Reset-After`: Seconds until window reset

## Rate Limit Error Response

When rate limit is exceeded:

```json
{
  "detail": "Rate limit exceeded. Maximum 200 requests per minute."
}
```

HTTP Status Code: 429 Too Many Requests

## Implementation Details

### Current (In-Memory)
```python
# backend/server.py
from cachetools import TTLCache

_RATE_LIMIT_MAX = 200
_RATE_LIMIT_WINDOW = 60  # 1 minute
_global_rate_limits: dict = TTLCache(maxsize=10000, ttl=_RATE_LIMIT_WINDOW)

@app.middleware("http")
async def global_rate_limit(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    
    if request.method == "GET":
        return await call_next(request)
    
    count = _global_rate_limits.get(client_ip, 0)
    if count >= _RATE_LIMIT_MAX:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit exceeded. Maximum {_RATE_LIMIT_MAX} requests per minute."}
        )
    _global_rate_limits[client_ip] = count + 1
    
    return await call_next(request)
```

### Production (Redis-Based)
See REDIS_CACHING.md for Redis implementation details.

## Endpoint-Specific Limits

### Read Endpoints (GET)
- **Limit**: 400 per minute (2x global limit)
- **Rationale**: Read operations are less resource-intensive

### Write Endpoints (POST, PUT, DELETE)
- **Limit**: 100 per minute (0.5x global limit)
- **Rationale**: Write operations require more resources

### Expensive Operations
- **Report Generation**: 10 per minute
- **Bulk Operations**: 5 per minute
- **Data Import**: 1 per hour

## Whitelisting

### IP Whitelist
Certain IPs can be whitelisted from rate limits:
- Internal monitoring systems
- Trusted partners
- Admin users

```python
WHITELISTED_IPS = ["127.0.0.1", "192.168.1.100"]

if client_ip in WHITELISTED_IPS:
    return await call_next(request)  # Skip rate limit
```

### API Key Bypass
API keys can bypass IP-based rate limits:
```python
api_key = request.headers.get("X-API-Key")
if api_key and validate_api_key(api_key):
    return await call_next(request)  # Skip rate limit
```

## Monitoring

### Metrics to Track
- Rate limit violations per endpoint
- Rate limit violations per IP
- Average request rate
- Peak request rate
- Rate limit hit rate

### Alerting
- Alert on high rate limit violation rate (> 5%)
- Alert on suspected DDoS attack
- Alert on API key abuse

## Best Practices

### Client-Side
- Implement exponential backoff on 429 responses
- Respect Retry-After header
- Cache responses where possible
- Use bulk operations when appropriate

### Server-Side
- Use Redis for multi-worker deployments
- Implement different limits for different tiers
- Log rate limit violations
- Monitor and adjust limits based on usage

## Configuration

### Environment Variables
```bash
# Rate limit configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_GLOBAL_MAX=200
RATE_LIMIT_GLOBAL_WINDOW=60
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW=900
```

### Dynamic Configuration
Rate limits can be adjusted without restart:
```python
# Update rate limit dynamically
RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_GLOBAL_MAX", 200))
```

## Testing

### Load Testing
Use tools like Apache JMeter or Locust to test rate limits:
```python
# locustfile.py
from locust import HttpUser, task, between

class RetailAppUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def get_items(self):
        self.client.get("/api/items")
```

### Rate Limit Testing
```bash
# Test rate limit with curl
for i in {1..250}; do
  curl -X GET http://localhost:8000/api/items &
done
wait
```

## Troubleshooting

### Common Issues

#### Rate Limit Too Strict
- Increase limits in environment variables
- Implement tiered rate limiting
- Add whitelisting for trusted IPs

#### Rate Limit Too Lenient
- Decrease limits
- Implement stricter limits for expensive operations
- Add monitoring for abuse detection

#### Redis Connection Issues
- Implement fallback to in-memory cache
- Add Redis health checks
- Monitor Redis performance

## Future Enhancements

### Adaptive Rate Limiting
- Adjust limits based on system load
- Increase limits during off-peak hours
- Decrease limits during high load

### Machine Learning-Based Detection
- Detect anomalous traffic patterns
- Identify bot traffic
- Block malicious IPs automatically

### Distributed Rate Limiting
- Use Redis Cluster for horizontal scaling
- Implement consistent hashing for key distribution
- Add rate limit synchronization across regions
