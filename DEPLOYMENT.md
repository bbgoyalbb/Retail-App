# Deployment Guide

This guide covers deploying the Retail App using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- Git
- For production: SSL certificates (see SSL section below)

## Quick Start (Development)

1. Clone the repository:
```bash
git clone https://github.com/bbgoyalbb/Retail-App.git
cd Retail-App
```

2. Set up environment variables:
```bash
# Copy the example file
cp .env.docker.example .env

# Edit .env with your settings
# Required: JWT_SECRET (generate a strong random string)
# Optional: ORG_NAME (defaults to "Retail Business")
```

3. Start the application:
```bash
docker-compose up -d
```

4. Access the application:
- HTTP: http://localhost:80
- HTTPS: https://localhost:443 (requires SSL certificates)

## Production Deployment

### SSL/TLS Configuration

For production, you must use HTTPS. Follow these steps:

#### Option 1: Let's Encrypt (Recommended)

1. Install certbot on your server:
```bash
sudo apt-get update
sudo apt-get install certbot
```

2. Generate certificates:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

3. Copy certificates to ssl directory:
```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
sudo chmod 644 ssl/cert.pem ssl/key.pem
```

#### Option 2: Self-Signed (Development Only)

```bash
cd ssl
openssl genrsa -out key.pem 2048
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/CN=localhost"
```

**Note:** Self-signed certificates will show browser warnings. Only use for development.

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Optional
ORG_NAME=Your Business Name
```

### Start Production Services

```bash
docker-compose up -d
```

### Verify Deployment

Check that all services are running:
```bash
docker-compose ps
```

Check logs:
```bash
docker-compose logs -f
```

## Service Architecture

The application consists of three services:

1. **nginx** - Reverse proxy with SSL termination
   - Ports: 80 (HTTP), 443 (HTTPS)
   - Proxies to retail-app on port 8000

2. **retail-app** - FastAPI backend + React frontend
   - Built from Dockerfile
   - Environment variables from .env
   - Depends on mongo service

3. **mongo** - MongoDB database
   - Port 27017 (internal only, not exposed)
   - Data persisted in Docker volume

## Security Considerations

### Production Checklist

- [ ] Use strong JWT_SECRET (minimum 32 characters)
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure CORS origins in backend/.env
- [ ] Set DEBUG=false in production
- [ ] Use firewall to restrict access
- [ ] Regular database backups
- [ ] Monitor logs for suspicious activity

### Database Security

- MongoDB port 27017 is NOT exposed to host
- Only accessible within Docker network
- Use strong passwords for production databases

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs nginx
docker-compose logs retail-app
docker-compose logs mongo

# Restart services
docker-compose restart
```

### SSL Certificate Errors

If nginx fails to start due to SSL:
```bash
# Check certificate files exist
ls -la ssl/

# For development, use HTTP only (port 80)
# For production, ensure cert.pem and key.pem exist
```

### Database Connection Issues

```bash
# Check MongoDB is running
docker-compose exec mongo mongosh

# Check backend can connect
docker-compose logs retail-app | grep mongo
```

## Backup and Restore

### Backup Database

```bash
# Backup to JSON
docker-compose exec retail-app python backup_database.py

# Or use mongodump
docker-compose exec mongo mongodump --archive=/data/db/backup
```

### Restore Database

```bash
# Restore from JSON via API
# Use the /restore endpoint (admin only)

# Or use mongorestore
docker-compose exec mongo mongorestore --archive=/data/db/backup
```

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f retail-app
```

### Health Checks

The application exposes health check endpoints:
- `GET /health/ready` - Service readiness check
- `GET /health/live` - Service liveness check

## Scaling

For higher traffic, consider:

1. **Horizontal Scaling**: Use Docker Swarm or Kubernetes
2. **Load Balancing**: Add multiple nginx instances
3. **Database Scaling**: Use MongoDB replica sets
4. **Caching**: Add Redis for session caching

## Updates

To update the application:

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up -d --build

# Clean up old images
docker image prune -f
```

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review documentation: README.md
- Open an issue on GitHub
