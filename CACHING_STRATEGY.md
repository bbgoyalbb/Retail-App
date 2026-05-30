# Caching Strategy for Expensive Queries

## Overview
This document outlines the caching strategy for expensive database queries in the Retail-App.

## Current State
- In-memory TTLCache for single-worker deployments
- No caching for multi-worker deployments
- No persistent caching
- No cache invalidation strategy

## Caching Layers

### Level 1: In-Memory Cache (Single Worker)
- **Implementation**: `cachetools.TTLCache`
- **Use Case**: Development, single-worker deployments
- **TTL**: 5-15 minutes depending on data
- **Limit**: 10,000 items

### Level 2: Redis Cache (Multi-Worker)
- **Implementation**: Redis with hiredis
- **Use Case**: Production, multi-worker deployments
- **TTL**: 5-60 minutes depending on data
- **Persistence**: Configurable (RDB/AOF)

### Level 3: CDN Cache (Static Assets)
- **Implementation**: Cloudflare, AWS CloudFront
- **Use Case**: Static files, images
- **TTL**: 1 day to 1 year

## Expensive Queries to Cache

### Report Queries
```python
# Revenue report - expensive aggregation
@cache_result(ttl=900)  # 15 minutes
async def get_revenue_report(period: str, date_from: str, date_to: str):
    pipeline = [
        {"$match": match_query},
        {"$group": {...}},
        {"$sort": {...}}
    ]
    return await db.items.aggregate(pipeline).to_list(500)

# Customer report - expensive aggregation
@cache_result(ttl=900)
async def get_customer_report(date_from: str, date_to: str):
    pipeline = [
        {"$match": match_query},
        {"$group": {...}},
        {"$sort": {...}}
    ]
    return await db.items.aggregate(pipeline).to_list(200)

# Summary report - very expensive with facet
@cache_result(ttl=600)  # 10 minutes
async def get_summary_report(date_from: str, date_to: str):
    pipeline = [
        {"$match": match_query},
        {"$facet": {...}}
    ]
    return await db.items.aggregate(pipeline).to_list(1)
```

### List Queries with Pagination
```python
# Items list - cache by page
@cache_result(ttl=300)  # 5 minutes
async def get_items(page: int, limit: int, filters: dict):
    skip = (page - 1) * limit
    return await db.items.find(filters).skip(skip).limit(limit).to_list(limit)

# Bills list - cache by page
@cache_result(ttl=300)
async def get_bills(page: int, limit: int, filters: dict):
    skip = (page - 1) * limit
    return await db.bills.find(filters).skip(skip).limit(limit).to_list(limit)
```

### Lookups
```python
# Settings - rarely change
@cache_result(ttl=3600)  # 1 hour
async def get_settings():
    return await db.settings.find_one({"key": "app_settings"})

# Karigars - rarely change
@cache_result(ttl=1800)  # 30 minutes
async def get_karigars():
    return await db.karigars.find().to_list(100)

# Groups - rarely change
@cache_result(ttl=1800)
async def get_groups():
    return await db.groups.find().to_list(100)
```

## Cache Key Design

### Key Format
```
{prefix}:{operation}:{hash(parameters)}
```

### Examples
```
cache:report:revenue:daily:2024-05-30:abc123
cache:items:page:1:limit:50:def456
cache:settings:public:ghi789
```

### Key Generation
```python
import hashlib
import json

def generate_cache_key(prefix: str, operation: str, **kwargs) -> str:
    """Generate a cache key from parameters."""
    params_str = json.dumps(kwargs, sort_keys=True)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
    return f"{prefix}:{operation}:{params_hash}"
```

## Cache Invalidation

### Manual Invalidation
```python
# Invalidate specific cache
def invalidate_cache(key: str):
    redis_client.delete(key)

# Invalidate pattern
def invalidate_cache_pattern(pattern: str):
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)
```

### Automatic Invalidation
```python
# Invalidate on data changes
async def update_item(item_id: str, data: dict):
    # Update database
    await db.items.update_one({"id": item_id}, {"$set": data})
    
    # Invalidate related caches
    invalidate_cache_pattern("cache:items:*")
    invalidate_cache_pattern("cache:report:*")
```

### Time-Based Invalidation
```python
# Use TTL for automatic expiration
redis_client.setex(key, ttl, value)
```

## Implementation

### Cache Decorator
```python
from functools import wraps
import json
import hashlib
from typing import Any, Callable
from redis import Redis

redis_client = Redis.from_url(os.environ.get("REDIS_URL"))

def cache_result(ttl: int = 300):
    """Decorator to cache function results in Redis."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Generate cache key
            cache_key = generate_cache_key(
                "cache",
                func.__name__,
                args=args,
                kwargs=kwargs
            )
            
            # Try to get from cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            redis_client.setex(
                cache_key,
                ttl,
                json.dumps(result, default=str)
            )
            
            return result
        return wrapper
    return decorator
```

### Cache-Aside Pattern
```python
async def get_item_with_cache(item_id: str):
    """Get item with cache-aside pattern."""
    cache_key = f"item:{item_id}"
    
    # Try cache first
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Cache miss - fetch from database
    item = await db.items.find_one({"id": item_id})
    
    if item:
        # Store in cache
        redis_client.setex(cache_key, 300, json.dumps(item, default=str))
    
    return item
```

### Write-Through Pattern
```python
async def update_item_with_cache(item_id: str, data: dict):
    """Update item with write-through pattern."""
    # Update database
    await db.items.update_one({"id": item_id}, {"$set": data})
    
    # Update cache
    cache_key = f"item:{item_id}"
    redis_client.setex(cache_key, 300, json.dumps(data, default=str))
```

## Cache Warming

### Warm Cache on Startup
```python
async def warm_cache():
    """Warm cache with frequently accessed data."""
    # Cache settings
    settings = await get_settings()
    redis_client.setex("cache:settings", 3600, json.dumps(settings))
    
    # Cache karigars
    karigars = await get_karigars()
    redis_client.setex("cache:karigars", 1800, json.dumps(karigars))
    
    # Cache groups
    groups = await get_groups()
    redis_client.setex("cache:groups", 1800, json.dumps(groups))
```

### Scheduled Cache Warming
```python
import asyncio
from datetime import datetime, time

async def scheduled_cache_warming():
    """Warm cache at scheduled times."""
    while True:
        now = datetime.now()
        target = datetime.combine(now.date(), time(6, 0))  # 6 AM
        
        if now < target:
            sleep_seconds = (target - now).total_seconds()
            await asyncio.sleep(sleep_seconds)
        else:
            await warm_cache()
            await asyncio.sleep(86400)  # Wait 24 hours
```

## Cache Monitoring

### Metrics
```python
def get_cache_stats():
    """Get cache statistics."""
    info = redis_client.info("stats")
    return {
        "hits": info["keyspace_hits"],
        "misses": info["keyspace_misses"],
        "hit_rate": info["keyspace_hits"] / (info["keyspace_hits"] + info["keyspace_misses"]) if info["keyspace_hits"] + info["keyspace_misses"] > 0 else 0,
        "used_memory": info["used_memory_human"],
        "total_keys": redis_client.dbsize()
    }
```

### Logging
```python
import logging

cache_logger = logging.getLogger("cache")

def log_cache_hit(key: str):
    cache_logger.info(f"Cache HIT: {key}")

def log_cache_miss(key: str):
    cache_logger.info(f"Cache MISS: {key}")

def log_cache_set(key: str, ttl: int):
    cache_logger.info(f"Cache SET: {key} (TTL: {ttl}s)")
```

## Cache Optimization

### Compression
```python
import gzip

def compress_data(data: str) -> bytes:
    """Compress data before caching."""
    return gzip.compress(data.encode())

def decompress_data(data: bytes) -> str:
    """Decompress data from cache."""
    return gzip.decompress(data).decode()
```

### Serialization
```python
import pickle

def serialize(data: Any) -> bytes:
    """Serialize data for caching."""
    return pickle.dumps(data)

def deserialize(data: bytes) -> Any:
    """Deserialize data from cache."""
    return pickle.loads(data)
```

### Batch Operations
```python
async def cache_multiple_items(items: list):
    """Cache multiple items in a single operation."""
    pipe = redis_client.pipeline()
    for item in items:
        key = f"item:{item['id']}"
        pipe.setex(key, 300, json.dumps(item, default=str))
    pipe.execute()
```

## Cache Eviction Policy

### LRU (Least Recently Used)
```python
# Redis automatically uses LRU when maxmemory is set
redis_client.config_set("maxmemory", "256mb")
redis_client.config_set("maxmemory-policy", "allkeys-lru")
```

### TTL-Based
```python
# All keys have TTL set
redis_client.setex(key, ttl, value)
```

### Manual Eviction
```python
# Evict specific pattern
def evict_pattern(pattern: str):
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)
```

## Cache Testing

### Unit Tests
```python
import pytest
from unittest.mock import Mock, patch

@pytest.mark.asyncio
async def test_cache_hit():
    with patch.object(redis_client, 'get', return_value='{"id": "123"}'):
        result = await get_item_with_cache("123")
        assert result["id"] == "123"

@pytest.mark.asyncio
async def test_cache_miss():
    with patch.object(redis_client, 'get', return_value=None):
        with patch.object(db.items, 'find_one', return_value={"id": "123"}):
            result = await get_item_with_cache("123")
            assert result["id"] == "123"
```

### Load Testing
```python
# Test cache under load
async def test_cache_load():
    tasks = [get_item_with_cache(f"item{i}") for i in range(1000)]
    results = await asyncio.gather(*tasks)
    assert len(results) == 1000
```

## Troubleshooting

### High Miss Rate
- Increase TTL
- Check cache key generation
- Verify cache is being set
- Monitor cache size

### Memory Issues
- Reduce TTL
- Implement eviction policy
- Compress cached data
- Use Redis Cluster

### Stale Data
- Implement cache invalidation
- Reduce TTL
- Add cache warming
- Monitor data freshness

## Best Practices

### Do
- Cache read-heavy operations
- Use appropriate TTL values
- Implement cache invalidation
- Monitor cache performance
- Test cache behavior

### Don't
- Cache write operations
- Cache sensitive data without encryption
- Ignore cache failures
- Set too long TTL for dynamic data
- Cache everything indiscriminately

## Future Enhancements

### Distributed Caching
- Redis Cluster for horizontal scaling
- Consistent hashing for key distribution
- Cross-region cache replication

### Intelligent Caching
- Predictive caching based on access patterns
- Automatic TTL adjustment based on data freshness
- Cache warming based on usage analytics

### Cache Analytics
- Detailed cache performance metrics
- Cache hit rate by endpoint
- Cache size monitoring
- Automated cache optimization recommendations
