# Server Deployment Guide

This guide will help you deploy the Webhook to Telegram Bot application on a production server using Docker.

## Prerequisites

### System Requirements
- Ubuntu 20.04 LTS or newer (or similar Linux distribution)
- At least 1GB RAM (2GB+ recommended)
- At least 10GB free disk space
- Root or sudo access

### Required Software
- Docker (20.10+)
- Docker Compose (2.0+)
- Git
- nginx (if not using Docker nginx)

## Server Setup

### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Setup Application Directory
```bash
# Create application directory
sudo mkdir -p /opt/webhook-to-telegram
cd /opt/webhook-to-telegram

# Clone repository (or upload files)
git clone https://github.com/yourusername/webhook-to-telegram.git .

# Or if uploading manually:
# Upload all project files to /opt/webhook-to-telegram
```

### 4. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
sudo nano .env
```

**Important environment variables to configure:**
```bash
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-very-secure-session-secret-at-least-32-characters-long
DATABASE_PATH=/app/data/database.db
TRUST_PROXY=true
DOMAIN=your-domain.com
```

### 5. Setup SSL Certificate (Recommended)

#### Option A: Using Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install certbot -y

# Create SSL directory
sudo mkdir -p /opt/webhook-to-telegram/nginx/ssl

# Get certificate (replace your-domain.com)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/webhook-to-telegram/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/webhook-to-telegram/nginx/ssl/

# Set permissions
sudo chown -R $USER:$USER /opt/webhook-to-telegram/nginx/ssl/
sudo chmod 600 /opt/webhook-to-telegram/nginx/ssl/*.pem
```

#### Option B: Self-Signed Certificate (Development)
```bash
sudo mkdir -p /opt/webhook-to-telegram/nginx/ssl
cd /opt/webhook-to-telegram/nginx/ssl

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout privkey.pem \
    -out fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=your-domain.com"
```

### 6. Configure Nginx
Edit the nginx configuration file:
```bash
sudo nano nginx/nginx.conf
```

Update the following lines:
- Change `server_name your-domain.com;` to your actual domain
- Uncomment SSL configuration lines if using HTTPS
- For development without SSL, keep the `listen 80;` line

### 7. Set Permissions
```bash
# Set proper ownership
sudo chown -R $USER:$USER /opt/webhook-to-telegram

# Make deploy script executable
chmod +x deploy.sh

# Create required directories
mkdir -p data logs logs/nginx
```

## Deployment

### Basic Deployment (App Only)
```bash
# Deploy application without nginx
./deploy.sh --build
```

### Full Deployment (App + Nginx)
```bash
# Deploy with nginx reverse proxy
./deploy.sh --nginx
```

### Check Status
```bash
# View deployment status
./deploy.sh --status

# View logs
./deploy.sh --logs
```

## Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Optional: Allow direct app access (for debugging)
sudo ufw allow 3000/tcp

# Check status
sudo ufw status
```

## Domain Configuration

1. Point your domain's DNS A record to your server's IP address
2. If using Cloudflare, ensure SSL/TLS mode is set to "Full" or "Full (strict)"

## Monitoring and Maintenance

### View Container Status
```bash
docker ps
docker-compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs webhook-to-telegram

# Nginx logs
docker-compose -f docker-compose.prod.yml logs nginx

# Follow logs in real-time
./deploy.sh --logs
```

### Database Backup
```bash
# Create backup directory
mkdir -p backups

# Backup database
cp data/database.db backups/database-$(date +%Y%m%d-%H%M%S).db

# Automated backup script (add to crontab)
echo "0 2 * * * cd /opt/webhook-to-telegram && cp data/database.db backups/database-\$(date +\%Y\%m\%d-\%H\%M\%S).db" | crontab -
```

### Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and redeploy
./deploy.sh --build

# Or with nginx
./deploy.sh --nginx
```

### SSL Certificate Renewal
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/webhook-to-telegram/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/webhook-to-telegram/nginx/ssl/

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

## Troubleshooting

### Common Issues

1. **Port 80/443 already in use**
   ```bash
   # Check what's using the port
   sudo netstat -tulpn | grep :80
   sudo netstat -tulpn | grep :443
   
   # Stop apache2 if installed
   sudo systemctl stop apache2
   sudo systemctl disable apache2
   ```

2. **Permission issues**
   ```bash
   # Fix ownership
   sudo chown -R $USER:$USER /opt/webhook-to-telegram
   
   # Fix data directory permissions
   sudo chmod 755 data
   ```

3. **Database connection issues**
   ```bash
   # Check if data directory exists and has proper permissions
   ls -la data/
   
   # Check container logs
   ./deploy.sh --logs
   ```

4. **SSL issues**
   ```bash
   # Check certificate files
   ls -la nginx/ssl/
   
   # Test certificate
   openssl x509 -in nginx/ssl/fullchain.pem -text -noout
   ```

### Useful Commands

```bash
# Restart all services
./deploy.sh --restart

# Stop all services
./deploy.sh --stop

# Clean up Docker resources
./deploy.sh --cleanup

# View resource usage
docker stats

# Access container shell
docker-compose -f docker-compose.prod.yml exec webhook-to-telegram sh
```

## Security Best Practices

1. **Keep system updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use strong passwords and session secrets**
3. **Enable firewall (UFW)**
4. **Use SSL/TLS certificates**
5. **Regular backups**
6. **Monitor logs for suspicious activity**
7. **Keep Docker images updated**
8. **Use non-root users in containers** (already configured)

## Support

- Check application logs: `./deploy.sh --logs`
- Check system resources: `htop` or `docker stats`
- Verify network connectivity: `curl -I http://localhost:3000`
- Test database: `sqlite3 data/database.db ".tables"`
