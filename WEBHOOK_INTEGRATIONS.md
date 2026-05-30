# Webhook Support for Integrations

## Overview
This document outlines the webhook support for third-party integrations in the Retail-App.

## What are Webhooks?

Webhooks are HTTP callbacks that are triggered by specific events in the system. They allow external systems to receive real-time notifications about events without polling.

## Supported Events

### Item Events
- `item.created` - New item created
- `item.updated` - Item details updated
- `item.deleted` - Item deleted
- `item.delivered` - Item marked as delivered

### Order Events
- `order.created` - New order created
- `order.updated` - Order updated
- `order.cancelled` - Order cancelled
- `order.delivered` - Order delivered

### Payment Events
- `payment.received` - Payment received
- `payment.settled` - Payment settled
- `payment.failed` - Payment failed

### Invoice Events
- `invoice.generated` - Invoice generated
- `invoice.sent` - Invoice sent to customer

### Labour Events
- `labour.assigned` - Labour assigned to karigar
- `labour.completed` - Labour completed
- `labour.paid` - Labour payment processed

## Webhook Configuration

### Database Schema
```javascript
// webhooks collection
{
  "_id": ObjectId,
  "url": "https://example.com/webhook",
  "events": ["item.created", "item.updated"],
  "secret": "webhook_secret_key",
  "active": true,
  "created_at": ISODate,
  "updated_at": ISODate,
  "last_triggered": ISODate,
  "failure_count": 0
}
```

### API Endpoints

#### Create Webhook
```http
POST /api/webhooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://example.com/webhook",
  "events": ["item.created", "item.updated"],
  "secret": "optional_secret"
}
```

#### List Webhooks
```http
GET /api/webhooks
Authorization: Bearer <token>
```

#### Update Webhook
```http
PUT /api/webhooks/{webhook_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "active": false
}
```

#### Delete Webhook
```http
DELETE /api/webhooks/{webhook_id}
Authorization: Bearer <token>
```

## Webhook Payload

### Example Payload
```json
{
  "event": "item.created",
  "timestamp": "2024-05-30T12:00:00Z",
  "data": {
    "id": "ITEM001",
    "name": "Shirt",
    "barcode": "123456789",
    "ref": "REF001",
    "date": "2024-05-30"
  }
}
```

### Payload Structure
- `event`: Event type
- `timestamp`: ISO 8601 timestamp
- `data`: Event-specific data

## Security

### Signature Verification
Webhooks include a signature in the `X-Webhook-Signature` header:

```python
import hmac
import hashlib

def verify_signature(payload: str, signature: str, secret: str) -> bool:
    """Verify webhook signature."""
    expected_signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)
```

### Retry Logic
- Initial retry: 1 second
- Exponential backoff: 2^n seconds
- Max retries: 5
- Total retry time: ~31 seconds

### Failure Handling
- Increment failure count on failure
- Disable webhook after 10 consecutive failures
- Send notification to webhook owner

## Implementation

### Webhook Sender
```python
import httpx
import asyncio
from typing import List

class WebhookSender:
    def __init__(self, db):
        self.db = db
    
    async def trigger_webhooks(self, event: str, data: dict):
        """Trigger webhooks for an event."""
        webhooks = await self.db.webhooks.find({
            "events": event,
            "active": True
        }).to_list(None)
        
        tasks = [self.send_webhook(webhook, event, data) for webhook in webhooks]
        await asyncio.gather(*tasks)
    
    async def send_webhook(self, webhook: dict, event: str, data: dict):
        """Send webhook to a single endpoint."""
        payload = {
            "event": event,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        
        signature = self.generate_signature(payload, webhook.get("secret"))
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook["url"],
                    json=payload,
                    headers={
                        "X-Webhook-Signature": signature,
                        "Content-Type": "application/json"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    await self.db.webhooks.update_one(
                        {"_id": webhook["_id"]},
                        {
                            "$set": {
                                "last_triggered": datetime.utcnow(),
                                "failure_count": 0
                            }
                        }
                    )
                else:
                    await self.handle_failure(webhook)
        except Exception as e:
            await self.handle_failure(webhook)
    
    def generate_signature(self, payload: dict, secret: str) -> str:
        """Generate webhook signature."""
        import hmac
        import hashlib
        import json
        
        payload_str = json.dumps(payload, sort_keys=True)
        signature = hmac.new(
            secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"
    
    async def handle_failure(self, webhook: dict):
        """Handle webhook delivery failure."""
        await self.db.webhooks.update_one(
            {"_id": webhook["_id"]},
            {
                "$inc": {"failure_count": 1}
            }
        )
        
        webhook = await self.db.webhooks.find_one({"_id": webhook["_id"]})
        
        if webhook["failure_count"] >= 10:
            await self.db.webhooks.update_one(
                {"_id": webhook["_id"]},
                {"$set": {"active": False}}
            )
            # Send notification to webhook owner
```

### Integration Points

#### Item Creation
```python
# backend/routers/items.py
@app.post("/items")
async def create_item(item: ItemCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    # Create item
    result = await db.items.insert_one(item.dict())
    
    # Trigger webhook
    webhook_sender = WebhookSender(db)
    await webhook_sender.trigger_webhooks("item.created", item.dict())
    
    return {"id": str(result.inserted_id)}
```

## Testing

### Webhook Testing Tool
```python
# backend/routers/webhooks.py
@router.post("/webhooks/test")
async def test_webhook(url: str, payload: dict):
    """Test webhook delivery."""
    webhook_sender = WebhookSender(db)
    result = await webhook_sender.send_webhook(
        {"url": url, "secret": "test"},
        "test.event",
        payload
    )
    return {"status": "success" if result else "failed"}
```

### Local Testing
Use tools like ngrok to test webhooks locally:
```bash
ngrok http 8000
```

## Monitoring

### Metrics to Track
- Webhook delivery success rate
- Webhook delivery latency
- Failed webhooks
- Disabled webhooks
- Webhook retry attempts

### Alerting
- Alert on high failure rate (> 10%)
- Alert on webhook disabled due to failures
- Alert on slow webhook delivery (> 5s)

## Best Practices

### For Webhook Consumers
- Verify signatures
- Return 200 OK quickly (process asynchronously)
- Handle duplicate events (idempotency)
- Implement retry logic on consumer side
- Monitor webhook delivery

### For Webhook Providers
- Use HTTPS endpoints
- Implement retry logic
- Provide clear error messages
- Monitor delivery status
- Document event schemas

## Rate Limiting
- Webhook endpoints: 100 requests per minute per webhook
- Burst: 10 requests per second
- Exceeding limits: 429 Too Many Requests

## Future Enhancements

### Event Filtering
Allow webhooks to filter events based on criteria:
```json
{
  "events": ["item.created"],
  "filter": {
    "data.category": "Clothing",
    "data.amount": { "$gt": 1000 }
  }
}
```

### Batch Events
Send multiple events in a single payload:
```json
{
  "events": [
    {"event": "item.created", "data": {...}},
    {"event": "item.created", "data": {...}}
  ]
}
```

### Webhook Logs
Maintain delivery logs for debugging:
```javascript
// webhook_logs collection
{
  "_id": ObjectId,
  "webhook_id": ObjectId,
  "event": "item.created",
  "status": "success",
  "response_code": 200,
  "response_body": "...",
  "timestamp": ISODate
}
```

## Common Integrations

### Accounting Systems
- QuickBooks
- Xero
- Zoho Books

### CRM Systems
- Salesforce
- HubSpot
- Zoho CRM

### Communication Platforms
- Slack
- Microsoft Teams
- Discord

### Analytics Platforms
- Google Analytics
- Mixpanel
- Segment
