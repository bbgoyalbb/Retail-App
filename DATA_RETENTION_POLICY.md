# Data Retention Policy

## Overview
This document outlines the data retention policy for the Retail-App system.

## Retention Periods

### Customer Data
- **Customer Names and Contact Info**: Retained indefinitely while customer is active
- **Inactive Customer Data**: Archived after 2 years of inactivity
- **Deleted Customer Data**: Soft delete with 90-day retention before permanent deletion

### Transaction Data
- **Orders/Items**: Retained for 7 years (statutory requirement)
- **Financial Records (Advances, Payments)**: Retained for 7 years (statutory requirement)
- **Audit Logs**: Retained for 1 year
- **Error Logs**: Retained for 90 days
- **Bug Reports**: Retained for 1 year

### System Data
- **Counters**: 90-day TTL (auto-expired)
- **Token Blocklist**: 24-hour TTL (auto-expired)
- **Session Data**: 24-hour TTL (auto-expired)

## Data Archival

### Archival Process
1. Data older than retention period is identified
2. Data is exported to compressed archive
3. Archive is stored in secure offsite location
4. Database records are marked as archived
5. Archived data is removed from active database after 30 days

### Archive Storage
- **Development**: Local storage
- **Staging**: Cloud storage with encryption
- **Production**: Encrypted cloud storage with multiple geographic regions

## Data Deletion

### Automatic Deletion
- Error logs: Auto-deleted after 90 days
- Counters: Auto-deleted after 90 days (TTL)
- Token blocklist: Auto-deleted after 24 hours (TTL)

### Manual Deletion
- Customer data: Soft delete with 90-day grace period
- Bug reports: Manual review before deletion
- Audit logs: Manual review before deletion

### Data Right to be Forgotten
Customers can request deletion of their personal data:
1. Submit deletion request via support
2. Verify identity
3. Soft delete customer record
4. Remove from all indexes
5. Archive financial records (required by law)
6. Confirm deletion to customer

## Compliance

### Legal Requirements
- **Tax Records**: 7 years retention (Income Tax Act)
- **Financial Records**: 7 years retention (GST Act)
- **Audit Trail**: 1 year retention (internal policy)

### GDPR Compliance
- Data minimization: Collect only necessary data
- Purpose limitation: Use data only for stated purposes
- Storage limitation: Retain only as long as necessary
- Right to erasure: Support deletion requests
- Data portability: Export data on request

## Backup Retention
- **Daily backups**: 7 days
- **Weekly backups**: 4 weeks
- **Monthly backups**: 12 months
- **Yearly backups**: 7 years

## Monitoring
- Monitor data growth
- Alert on approaching storage limits
- Review retention policy annually
- Audit deletion activities

## Exceptions
- Legal holds: Data retained beyond normal period if required by legal proceedings
- Regulatory requirements: Extended retention if required by regulators
- Business continuity: Data retained during disaster recovery

## Review Schedule
- Annual review of retention periods
- Quarterly review of deletion activities
- Monthly review of storage utilization
