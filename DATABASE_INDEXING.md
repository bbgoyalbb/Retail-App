# Database Indexing Strategy

## Overview
This document outlines the database indexing strategy for MongoDB in the Retail-App.

## Current Indexes

### Items Collection
```javascript
// Basic indexes
db.items.createIndex({ "date": 1 })
db.items.createIndex({ "order_no": 1 })
db.items.createIndex({ "karigar": 1 })
db.items.createIndex({ "cancelled": 1 })

// Compound indexes for common queries
db.items.createIndex({ "tailoring_status": 1, "date": -1 })
db.items.createIndex({ "ref": 1, "fabric_pay_mode": 1 })
db.items.createIndex({ "name": 1, "fabric_pay_mode": 1 })
db.items.createIndex({ "tailoring_status": 1, "labour_paid": 1 })
db.items.createIndex({ "embroidery_status": 1, "emb_labour_paid": 1 })
db.items.createIndex({ "embroidery_status": 1, "date": -1 })

// Payment mode indexes
db.items.createIndex({ "fabric_pay_mode": 1 })
db.items.createIndex({ "tailoring_pay_mode": 1 })
db.items.createIndex({ "embroidery_pay_mode": 1 })
db.items.createIndex({ "addon_pay_mode": 1 })

// Payment date indexes
db.items.createIndex({ "fabric_pay_date": 1 })
db.items.createIndex({ "tailoring_pay_date": 1 })
db.items.createIndex({ "embroidery_pay_date": 1 })
db.items.createIndex({ "addon_pay_date": 1 })
db.items.createIndex({ "delivery_date": 1 })
db.items.createIndex({ "delivery_date": 1, "tailoring_status": 1 })

// Text search index
db.items.createIndex(
  { 
    "name": "text", 
    "barcode": "text", 
    "ref": "text", 
    "order_no": "text", 
    "karigar": "text", 
    "addon_desc": "text" 
  },
  { name: "items_text_search" }
)

// Created timestamp
db.items.createIndex({ "created_at": 1 })
```

### Advances Collection
```javascript
db.advances.createIndex({ "id": 1 }, { unique: true })
db.advances.createIndex({ "ref": 1 })
db.advances.createIndex({ "date": 1 })
db.advances.createIndex({ "ref": 1, "date": 1 })
db.advances.createIndex({ "date": 1, "tally": 1 })
```

### Settings Collection
```javascript
db.settings.createIndex({ "key": 1 }, { unique: true })
```

### Token Blocklist Collection
```javascript
db.token_blocklist.createIndex({ "jti": 1 }, { unique: true })
db.token_blocklist.createIndex({ "created_at": 1 }, { expireAfterSeconds: 86400 })
```

### Audit Logs Collection
```javascript
db.audit_logs.createIndex({ "username": 1 })
db.audit_logs.createIndex({ "action": 1 })
db.audit_logs.createIndex({ "timestamp": -1 })
```

### Counters Collection
```javascript
db.counters.createIndex({ "created_at": 1 }, { expireAfterSeconds: 86400 * 90 })
```

### Error Logs Collection
```javascript
db.error_logs.createIndex({ "error_id": 1 }, { unique: true })
db.error_logs.createIndex({ "timestamp": 1 })
db.error_logs.createIndex({ "resolved": 1 })
db.error_logs.createIndex({ "error_type": 1 })
db.error_logs.createIndex({ "path": 1, "timestamp": -1 })
```

### Bug Reports Collection
```javascript
db.bug_reports.createIndex({ "report_id": 1 }, { unique: true })
```

## Indexing Best Practices

### ESR Rule (Equality, Sort, Range)
When creating compound indexes, follow the ESR rule:
1. **E**quality fields first
2. **S**ort fields next
3. **R**ange fields last

Example:
```javascript
// Good: Equality (cancelled) -> Sort (date) -> Range (created_at)
db.items.createIndex({ "cancelled": 1, "date": -1, "created_at": -1 })

// Bad: Range before sort
db.items.createIndex({ "date": -1, "cancelled": 1, "created_at": -1 })
```

### Covered Queries
Design indexes to cover queries to avoid fetching documents:
```javascript
// Index covers this query (no document fetch needed)
db.items.createIndex({ "cancelled": 1, "date": 1 }, { "fabric_amount": 1, "tailoring_amount": 1 })

// Query
db.items.find({ "cancelled": false, "date": { "$gte": "2024-01-01" } }, { "fabric_amount": 1, "tailoring_amount": 1 })
```

### Partial Indexes
Use partial indexes to reduce index size:
```javascript
// Only index active items
db.items.createIndex(
  { "date": -1, "tailoring_status": 1 },
  { partialFilterExpression: { "cancelled": false } }
)
```

### TTL Indexes
Use TTL indexes for automatic expiration:
```javascript
// Auto-delete after 90 days
db.counters.createIndex({ "created_at": 1 }, { expireAfterSeconds: 86400 * 90 })
```

## Index Maintenance

### Monitoring
- Monitor index usage with `$indexStats`
- Identify unused indexes
- Monitor index size and growth

### Rebuilding
```javascript
// Rebuild index
db.items.reIndex()

// Compact collection
db.items.compact()
```

### Index Size Limits
- Maximum index key length: 1024 bytes
- Maximum indexes per collection: 64
- Maximum compound index fields: 32

## Query Optimization

### Explain Plans
Always use explain() to analyze query performance:
```javascript
db.items.find({ "cancelled": false, "date": { "$gte": "2024-01-01" } }).explain("executionStats")
```

### Index Selection
MongoDB automatically selects the best index, but you can hint:
```javascript
db.items.find({ "cancelled": false }).hint({ "cancelled": 1, "date": -1 })
```

### Avoid Full Collection Scans
Ensure queries use indexes:
- Use `$exists` sparingly
- Avoid regex without anchors
- Avoid negation queries on indexed fields

## Performance Metrics

### Target Metrics
- Query execution time: < 100ms for common queries
- Index hit ratio: > 95%
- Index size: < 10% of data size

### Monitoring Commands
```javascript
// Index stats
db.items.stats().indexSizes

// Index usage
db.items.aggregate([{ "$indexStats": {} }])

// Slow queries
db.setProfilingLevel(1, 100)  // Log queries > 100ms
db.system.profile.find().sort({ millis: -1 }).limit(10)
```

## Recommendations

### For Large Collections (> 1M documents)
1. Use sharding for horizontal scaling
2. Consider time-series collections for time-based data
3. Use read replicas for read-heavy workloads
4. Implement caching for frequently accessed data

### For Write-Heavy Workloads
1. Minimize number of indexes
2. Use background index creation
3. Consider write concern settings
4. Implement write batching

### For Read-Heavy Workloads
1. Add more covering indexes
2. Use read replicas
3. Implement application-level caching
4. Denormalize frequently accessed data
