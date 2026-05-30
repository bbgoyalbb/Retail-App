# API Documentation

## Overview
The Retail-App provides a RESTful API built with FastAPI. This document describes how to access and use the API documentation.

## Swagger/OpenAPI Documentation

### Development Environment
When `DEBUG=true` is set in the environment, Swagger UI and ReDoc are automatically available:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

### Production Environment
In production, API documentation is disabled for security reasons. To enable it temporarily:

```bash
# Set DEBUG=true
export DEBUG=true

# Restart the application
docker-compose restart retail-app
```

## API Endpoints

### Authentication
All endpoints (except `/api/auth/login`) require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Main API Routes

#### Items
- `GET /api/items` - List all items with pagination
- `POST /api/items` - Create a new item
- `GET /api/items/{item_id}` - Get item by ID
- `PUT /api/items/{item_id}` - Update item
- `DELETE /api/items/{item_id}` - Delete item
- `POST /api/items/group` - Create item group
- `PUT /api/items/group/{group_id}` - Update item group
- `DELETE /api/items/group/{group_id}` - Delete item group

#### Bills
- `GET /api/bills` - List bills
- `POST /api/bills` - Create bill
- `GET /api/bills/{bill_id}` - Get bill by ID
- `PUT /api/bills/{bill_id}` - Update bill
- `DELETE /api/bills/{bill_id}` - Delete bill

#### Tailoring
- `POST /api/tailoring/assign` - Assign tailoring to karigar
- `POST /api/tailoring/split` - Split tailoring order

#### Jobwork
- `POST /api/jobwork/move` - Move jobwork
- `POST /api/jobwork/move-back` - Move jobwork back
- `POST /api/jobwork/move-emb` - Move embroidery jobwork
- `POST /api/jobwork/edit-emb` - Edit embroidery jobwork

#### Settlements
- `POST /api/settlements/pay` - Process settlement payment

#### Daybook
- `GET /api/daybook/dates` - Get daybook dates
- `GET /api/daybook/pending-count` - Get pending count
- `POST /api/daybook/tally` - Tally daybook

#### Labour
- `GET /api/labour/karigars` - List karigars
- `POST /api/labour/pay` - Pay labour
- `POST /api/labour/delete-payment` - Delete labour payment

#### Advances
- `GET /api/advances` - List advances
- `POST /api/advances` - Create advance

#### Orders
- `POST /api/orders/deliver` - Mark order as delivered

#### Reports
- `GET /api/reports/revenue` - Revenue report (daily/weekly/monthly)
- `GET /api/reports/customers` - Customer report
- `GET /api/reports/summary` - Business summary report

#### Invoice
- `GET /api/invoice` - Generate invoice (supports multiple formats: standard, thermal, article-wise, article-summary)

#### Data
- `POST /api/import/excel` - Import data from Excel
- `POST /api/restore` - Restore from backup
- `POST /api/db/normalize` - Normalize database

#### Settings
- `GET /api/settings` - Get app settings
- `GET /api/settings/public` - Get public settings (firm name, logo, etc.)
- `PUT /api/settings` - Update settings

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

#### Health
- `GET /health` - Health check endpoint

## Query Parameters

### Pagination
Most list endpoints support pagination:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 1000)

### Filtering
Many endpoints support filtering by date range:
- `date_from`: Start date (YYYY-MM-DD format)
- `date_to`: End date (YYYY-MM-DD format)

### Sorting
Most list endpoints support sorting:
- `sort_by`: Field to sort by
- `sort_order`: `asc` or `desc`

## Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Success"
}
```

### Error Response
```json
{
  "detail": "Error message describing the issue"
}
```

## Rate Limiting
- **Global rate limit**: 200 requests per minute per IP
- **Login endpoint**: Stricter rate limiting (5 attempts per 15 minutes)
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## CORS Configuration
CORS is configured via the `CORS_ORIGINS` environment variable. In development with `DEBUG=true`, all origins are allowed.

## Request Validation
All endpoints use Pydantic models for request validation. Invalid requests return 422 Unprocessable Entity with validation errors.

## Error Handling
Errors are logged with unique error IDs. Include the error ID when reporting issues.

## API Versioning
Current version: v1
All endpoints are prefixed with `/api/`

Future versions will use `/api/v2/` prefix while maintaining backward compatibility.
