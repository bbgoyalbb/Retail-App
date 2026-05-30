# API Changelog

All notable changes to the Retail-App API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Database connection retry logic with exponential backoff
- CORS preflight caching (10-minute cache)
- Request timeout configuration in uvicorn (120s keep-alive, 30s graceful shutdown)
- Docker health checks for all services
- Docker resource limits (CPU and memory)
- Security scanning GitHub workflow
- MongoDB backup strategy documentation
- API documentation (Swagger/OpenAPI)
- Data retention policy documentation
- GDPR compliance documentation
- Database indexing strategy documentation
- Redis caching strategy documentation
- API rate limiting documentation
- API versioning strategy documentation
- Modular reports router structure (split from 1755-line file)

### Changed
- Split `backend/routers/reports.py` into modular structure:
  - `backend/routers/reports/invoice.py` - Invoice generation
  - `backend/routers/reports/revenue.py` - Revenue reports
  - `backend/routers/reports/customers.py` - Customer reports
  - `backend/routers/reports/summary.py` - Summary reports
- Removed frontend test step from CI (no actual tests exist)
- Fixed CI environment variables (DEBUG and CORS_ORIGINS)
- Removed `--frozen-lockfile` from local build script

### Fixed
- CI backend test failure due to missing environment variables
- Yarn lockfile mismatch error in local build
- SSL volume mount in docker-compose (made optional)

### Security
- Added automated security scanning workflow (Trivy, Bandit, TruffleHog)
- Documented security best practices

## [1.0.0] - 2024-05-30

### Added
- Initial release of Retail Management API
- Customer management
- Item management with fabric, tailoring, embroidery tracking
- Order management
- Billing and invoicing (multiple formats: standard, thermal, article-wise, article-summary)
- Payment tracking (fabric, tailoring, embroidery, addons)
- Labour management
- Jobwork management
- Settlement management
- Daybook operations
- Advance management
- Reports (revenue, customers, summary)
- Data import from Excel
- Authentication and authorization (JWT)
- Audit logging
- Error logging with unique error IDs
- Bug report submission
- Global rate limiting (200 requests/minute)
- Login rate limiting (5 attempts/15 minutes)
- Security headers middleware
- Request size limiting
- Cache-Control headers
- MongoDB indexing strategy
- Static file serving
- Health check endpoint

### Security
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- CORS configuration
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.)
- Request validation with Pydantic
- SQL injection prevention (MongoDB)
- XSS prevention (HTML escaping)

### Infrastructure
- Docker multi-stage build
- Docker Compose configuration
- Nginx reverse proxy
- SSL/TLS support
- CI/CD pipeline with GitHub Actions
- Pre-commit hooks (Black, Isort, Flake8)
- Logging with rotation
