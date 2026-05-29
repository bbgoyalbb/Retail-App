# SSL Certificate Setup for HTTPS

This directory should contain your SSL certificates for HTTPS/TLS encryption.

## Generating Self-Signed Certificates (Development)

For development, you can generate self-signed certificates using OpenSSL:

```bash
# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/CN=localhost"
```

## Production Certificates

For production, use certificates from a trusted Certificate Authority (CA):
- Let's Encrypt (free): https://letsencrypt.org/
- Commercial CA providers

Place your certificates in this directory:
- `cert.pem` - SSL certificate
- `key.pem` - Private key

**Important:** Never commit actual certificate files to version control. This directory is in `.gitignore`.
