# Deploying on AWS EC2 (Docker Compose)

This guide covers how to deploy the Aviator Betting Platform on a single AWS EC2 instance using Docker Compose. This is the fastest way to get a production-ready environment live for testing or small-scale production.

## 1. Launch instance
- **AMI**: Ubuntu 22.04 LTS
- **Instance Type**: `t3.large` (minimum) or `c5.xlarge` (recommended for load testing)
- **Storage**: 20GB+ gp3 EBS

## 2. Security Group Configuration
Open the following ports:
- `80` (HTTP) & `443` (HTTPS)
- `3000` (Gateway Proxy - Nginx)
- `22` (SSH - restrict to your IP)

## 3. Server Setup
SSH into your instance and run:
```bash
# Install Docker & Compose
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
```
*Logout and back in to apply group changes.*

## 4. Deploy Application
```bash
git clone <your-repo-url>
cd aviator-betting-platform

# Generate production .env
cat <<EOF > .env
AGGREGATOR_URL=your_actual_callback_endpoint
AGGREGATOR_API_KEY=your_secure_api_key
EOF

# Start the stack in production mode
make prod-up
```

## 5. Post-Deployment
- **SSL**: Use `certbot` with Nginx to enable HTTPS.
- **Monitoring**: Access Grafana at `http://YOUR_EC2_IP:3100`.
- **Scaling**: Use `docker-compose up -d --scale gateway=10` to handle more users.
