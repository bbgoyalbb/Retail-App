# Redis Caching for Production

## Overview
This document outlines the Redis caching strategy for production deployments of the Retail-App.

## Why Redis in Production?

### Current State
- Development: Uses in-memory `TTLCache` from `cachetools`
- Single-worker only: Rate limiting and caching don't work with multiple uvicorn workers
- No persistence: Cache is lost on restart

### Production Requirements
- Multi-worker support: Cache must be shared across workers
- Persistence: Cache should survive restarts
- Scalability: Cache should scale horizontally
- Performance: Sub-millisecond response times

## Redis Implementation

### Installation
```bash
# Add to requirements.txt
redis==5.0.0
hiredis==2.2.3  # C parser for faster performance
```

### Configuration
```python
# backend/config.py
import os
from redis import Redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
```

### Rate Limiting with Redis
```python
# backend/auth.py (modified for Redis)
from redis import Redis

redis_client = Redis.from_url(os.environ.get("REDIS_URL"))

async def check_rate_limit(client_ip: str, max_requests: int = 200, window: int = 60):
    """Check rate limit using Redis."""
    key = f"ratelimit:{client_ip}"
    
    # Use Redis pipeline for atomic operations
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    results = pipe.execute()
    
    count = results[0]
    return count <= max_requests
```

### Caching Expensive Queries
```python
# backend/routers/reports/revenue.py (example)
from functools import wraps
import json
from datetime import timedelta

def cache_result(ttl: int = 300):
    """Decorator to cache function results in Redis."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = f"cache:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            redis_client.setex(cache_key, ttl, json.dumps(result))
            
            return result
        return wrapper
    return decorator

# Usage
@cache_result(ttl=300)  # Cache for 5 minutes
async def get_revenue_report(period: str = "daily", ...):
    # Expensive aggregation query
    ...
```

### Session Storage
```python
# backend/auth.py (modified for Redis)
from fastapi_sessions.backends.redis import RedisBackend
from fastapi_sessions.cookie import CookieBackend

# Redis session backend
session_backend = RedisBackend(redis_client, key_prefix="session:")
```

## Docker Compose Configuration

```yaml
# docker-compose.yml (production)
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  retail-app:
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis

volumes:
  redis-data:
```

## Cache Strategies

### Cache-Aside Pattern
```python
# Application manages cache
def get_item(item_id: str):
    # Try cache first
    cached = redis_client.get(f"item:{item_id}")
    if cached:
        return json.loads(cached)
    
    # Cache miss - fetch from database
    item = db.items.find_one({"id": item_id})
    
    # Store in cache
    redis_client.setex(f"item:{item_id}", 300, json.dumps(item))
    
    return item
```

### Write-Through Pattern
```python
# Write to cache and database simultaneously
def update_item(item_id: str, data: dict):
    # Update database
    db.items.update_one({"id": item_id}, {"$set": data})
    
    # Update cache
    redis_client.setex(f"item:{item_id}", 300, json.dumps(data))
```

### Cache Invalidation
```python
# Invalidate cache on updates
def delete_item(item_id: str):
    # Delete from database
    db.items.delete_one({"id": item_id})
    
    # Invalidate cache
    redis_client.delete(f"item:{item_id}")
    
    # Invalidate related caches
    redis_client.delete(f"items:page:*")
```

## Cache Keys Design

### Naming Convention
```
{prefix}:{entity}:{identifier}
```

Examples:
- `cache:report:revenue:daily:2024-05-30`
- `ratelimit:192.168.1.1`
- `session:user123:abc123`
- `item:ITEM001`

### TTL Strategies
- **User data**: 5 minutes
- **Report data**: 15 minutes
- **Settings**: 1 hour
- **Rate limits**: 1 minute (window size)
- **Sessions**: 24 hours

## Monitoring

### Redis Metrics
```python
# Monitor Redis performance
def get_redis_stats():
    info = redis_client.info()
    return {
        "connected_clients": info["connected_clients"],
        "used_memory": info["used_memory_human"],
        "hits": info["keyspace_hits"],
        "misses": info["keyspace_misses"],
        "hit_rate": info["keyspace_hits"] / (info["keyspace_hits"] + info["keyspace_misses"]) if info["keyspace_hits"] + info["keyspace_misses"] > 0 else 0
    }
```

### Alerting
- Monitor Redis memory usage
- Alert on high miss rate (> 50%)
- Alert on connection failures
- Monitor cache hit rate

## Performance Optimization

### Connection Pooling
```python
from redis.connection import ConnectionPool

pool = ConnectionPool(
    host='localhost',
    port=6379,
    db=0,
    max_connections=50,
    retry_on_timeout=True
)
redis_client = Redis(connection_pool=pool)
```

### Pipeline for Bulk Operations
```python
# Use pipeline for multiple operations
pipe = redis_client.pipeline()
for item_id in item_ids:
    pipe.get(f"item:{item_id}")
results = pipe.execute()
```

### Lua Scripts for Atomic Operations
```python
# Atomic increment with expiry
script = """
local key = KEYS[1]
local ttl = ARGV[1]
local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, ttl)
end
return current
"""
redis_client.eval(script, 1, "counter:123", 60)
```

## Migration Strategy

### Phase 1: Add Redis to Docker Compose
- Add Redis service to docker-compose.yml
- Update environment variables
- Test connectivity

### Phase 2: Implement Redis Caching
- Add Redis dependencies
- Implement cache decorators
- Add Redis to rate limiting
- Test with single worker

### Phase 3: Multi-Worker Testing
- Test with multiple uvicorn workers
- Verify cache sharing
- Monitor performance

### Phase 4: Production Deployment
- Deploy to staging
- Monitor metrics
- Deploy to production

## Fallback Strategy
```python
# Fallback to in-memory cache if Redis is unavailable
try:
    redis_client.ping()
except:
    logger.warning("Redis unavailable, falling back to in-memory cache")
    from cachetools import TTLCache
    cache = TTLCache(maxsize=1000, ttl=300)
```

## Security
- Use Redis AUTH in production
- Enable TLS for Redis connections
- Restrict Redis network access
- Use separate Redis instance for different environments
