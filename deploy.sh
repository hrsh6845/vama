#!/bin/bash
# Deploy script for AWS EC2/Lightsail
# Run this on your server after cloning the repo

set -e

echo "=== Invoice App - Setup ==="

# Install Node.js 20 if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install PM2 globally for process management
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  sudo npm install -g pm2
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Seed the database with sample data (skip if data exists)
if [ ! -f data/invoices.db ]; then
  echo "Seeding database..."
  npm run db:seed
fi

# Build the React frontend
echo "Building frontend..."
npm run build

# Start with PM2
echo "Starting application..."
pm2 delete invoice-app 2>/dev/null || true
pm2 start server/index.js --name invoice-app --env production
pm2 save
pm2 startup

echo ""
echo "=== Setup Complete ==="
echo "App running on http://localhost:3001"
echo ""
echo "Next steps:"
echo "  1. Set up Nginx reverse proxy (see nginx.conf)"
echo "  2. Set up SSL with: sudo certbot --nginx -d yourdomain.com"
echo "  3. Open port 80/443 in your AWS security group"
