# MongoDB Backup Strategy

## Overview
This document outlines the backup strategy for MongoDB data in the Retail-App deployment.

## Backup Methods

### 1. Docker Volume Backup (Recommended for Development)
The MongoDB data is persisted in a Docker volume named `mongo-data`. To backup:

```bash
# Stop the MongoDB container
docker-compose stop mongo

# Backup the volume
docker run --rm -v mongo-data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb-backup-$(date +%Y%m%d).tar.gz /data

# Restart MongoDB
docker-compose start mongo
```

### 2. mongodump (Recommended for Production)
Use `mongodump` for logical backups:

```bash
# Backup to a directory
docker exec retail-app-mongo-1 mongodump --db retail --out /backup/$(date +%Y%m%d)

# Backup to archive
docker exec retail-app-mongo-1 mongodump --db retail --archive=/backup/mongodb-backup-$(date +%Y%m%d).gz --gzip
```

### 3. Automated Backup Script
Create a cron job or scheduled task for automated backups:

```bash
#!/bin/bash
# backup-mongodb.sh
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec retail-app-mongo-1 mongodump --db retail --archive=${BACKUP_DIR}/mongodb-backup-${DATE}.gz --gzip
# Keep only last 7 days of backups
find ${BACKUP_DIR} -name "mongodb-backup-*.gz" -mtime +7 -delete
```

## Restore Procedures

### From Docker Volume Backup
```bash
# Stop MongoDB
docker-compose stop mongo

# Restore from tar.gz
docker run --rm -v mongo-data:/data -v $(pwd):/backup alpine tar xzf /backup/mongodb-backup-20240530.tar.gz -C /

# Start MongoDB
docker-compose start mongo
```

### From mongodump Archive
```bash
# Restore from archive
docker exec -i retail-app-mongo-1 mongorestore --db retail --archive=/backup/mongodb-backup-20240530.gz --gzip
```

## Backup Retention Policy
- **Development**: Keep last 7 days of backups
- **Staging**: Keep last 30 days of backups
- **Production**: Keep last 90 days of backups, with monthly archives for 1 year

## Offsite Storage
For production, consider:
- AWS S3 or similar cloud storage
- Automated sync to remote location
- Encryption of backup files

## Monitoring
- Monitor backup job success/failure
- Alert on backup failures
- Regularly test restore procedures

## Disaster Recovery
1. Document recovery procedures
2. Test restore quarterly
3. Maintain offsite backups
4. Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
