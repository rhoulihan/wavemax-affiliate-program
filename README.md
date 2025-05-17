# WaveMAX Laundry Affiliate Program

This repository contains a complete solution for the WaveMAX Laundry affiliate program, allowing individuals to register as affiliates and provide pickup/delivery services for WaveMAX's wash, dry, fold laundry services.

## Overview

The WaveMAX Affiliate Program enables individuals to register as affiliates, onboard their own customers, and manage pickup and delivery of laundry for WaveMAX's wash, dry, fold (WDF) services. Affiliates earn 10% commission on all WDF orders plus any markup they set for delivery services.

### Key Features

- **Affiliate Registration & Management**: Complete onboarding and management system for affiliates
- **Customer Registration**: Allow affiliates to register customers using unique affiliate links
- **Order Management**: Schedule pickups, track order status, and manage deliveries
- **Laundry Bag Tracking**: Track customer bags with barcodes for accurate order processing
- **Secure Payments**: Encrypted payment processing and commission tracking
- **Dashboard Analytics**: Comprehensive metrics for both affiliates and customers
- **Email Notifications**: Automated emails for all important events in the lifecycle

## New Improvements

Recent updates to the project include:

- **Enhanced Security**: Removed hardcoded credentials and implemented rate limiting for authentication
- **Updated Dependencies**: Upgraded to Node.js 20 and MongoDB 7.0
- **Better Error Handling**: Improved error propagation and logging throughout the application
- **Robust Testing**: Added testing infrastructure with MongoDB memory server
- **API Documentation**: Added Swagger UI for interactive API documentation
- **Environment Configuration**: Better separation of development/production environments
- **Secure Deployment**: Comprehensive deployment guide for Ubuntu servers

## Project Structure

This repository is organized as follows:

```
wavemax-affiliate-program/
│
├── public/                                # Frontend HTML/CSS/JS
│   ├── assets/                            # Static assets (images, CSS, JS)
│   ├── index.html                         # Landing page
│   ├── affiliate-register.html            # Affiliate registration form
│   ├── affiliate-login.html               # Affiliate login page
│   ├── affiliate-success.html             # Affiliate registration success
│   ├── affiliate-dashboard.html           # Affiliate dashboard
│   ├── customer-register.html             # Customer registration form
│   ├── customer-login.html                # Customer login page
│   ├── customer-success.html              # Customer registration success
│   ├── customer-dashboard.html            # Customer dashboard
│   ├── schedule-pickup.html               # Pickup scheduling form
│   ├── order-confirmation.html            # Order confirmation page
│   └── api-docs.html                      # API documentation (Swagger UI)
│
├── server/                                # Server-side code
│   ├── controllers/                       # API controllers
│   │   ├── affiliateController.js         # Affiliate endpoints
│   │   ├── authController.js              # Authentication endpoints 
│   │   ├── bagController.js               # Bag endpoints
│   │   ├── customerController.js          # Customer endpoints
│   │   └── orderController.js             # Order endpoints
│   │
│   ├── middleware/                        # Express middleware
│   │   └── auth.js                        # Authentication middleware
│   │
│   ├── models/                            # Mongoose models
│   │   ├── Affiliate.js                   # Affiliate model
│   │   ├── Customer.js                    # Customer model
│   │   ├── Order.js                       # Order model
│   │   ├── Bag.js                         # Bag model
│   │   └── Transaction.js                 # Transaction model
│   │
│   ├── routes/                            # Express routes
│   │   ├── affiliateRoutes.js             # Affiliate routes
│   │   ├── authRoutes.js                  # Authentication routes
│   │   ├── bagRoutes.js                   # Bag routes
│   │   ├── customerRoutes.js              # Customer routes
│   │   └── orderRoutes.js                 # Order routes
│   │
│   ├── templates/                         # Email templates
│   │   └── emails/                        # Email HTML templates
│   │       ├── affiliate-welcome.html     # Affiliate welcome email
│   │       └── customer-welcome.html      # Customer welcome email
│   │
│   └── utils/                             # Utility functions
│       ├── emailService.js                # Email sending service
│       └── encryption.js                  # Data encryption utilities
│
├── tests/                                 # Test files
│   ├── setup.js                           # Test setup configuration
│   ├── affiliate.test.js                  # Affiliate API tests
│   └── auth.test.js                       # Authentication tests
│
├── scripts/                               # Utility scripts
│
├── .env.example                           # Environment variables template
├── Dockerfile                             # Docker configuration
├── docker-compose.yml                     # Docker Compose config
├── docker-compose.prod.yml                # Production Docker Compose
├── init-mongo.js                          # MongoDB initialization script
├── nginx.conf                             # Nginx configuration
├── package.json                           # NPM dependencies
└── server.js                              # Main application entry point
```

## Technologies Used

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **Backend**: Node.js 20, Express.js
- **Database**: MongoDB 7.0 (with MongoDB Atlas)
- **Visualization**: React, Recharts
- **Security**: JWT, Rate limiting, AES-256-GCM encryption
- **Deployment**: Docker, Nginx
- **Email**: Nodemailer
- **Testing**: Jest, Supertest, MongoDB Memory Server

## Local Development Setup

### Prerequisites

- Node.js v20+
- MongoDB 7.0+
- npm or yarn

### Installation Steps

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/wavemax-affiliate-program.git
   cd wavemax-affiliate-program
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   ```
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Generate secure keys:
   ```
   # Generate ENCRYPTION_KEY
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

5. Add the generated keys to your `.env` file.

6. Start the development server:
   ```
   npm run dev
   ```

7. Access the application at `http://localhost:3000`

### Docker Development

1. Start using Docker Compose:
   ```
   docker-compose up
   ```

2. Access the application at `http://localhost:3000`

## Testing

Run the test suite:

```
npm test
```

## Production Deployment

See the [Deployment Guide](#deployment-guide) for detailed instructions on deploying to production.

## Deployment Guide

### System Requirements

- Ubuntu 20.04 LTS or newer
- 2GB RAM minimum (4GB recommended)
- 20GB storage (minimum)
- Non-root user with sudo privileges

### Server Setup

1. **Update System**

   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y curl git build-essential
   ```

2. **Install Node.js 20.x**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Verify installation
   node -v  # Should show v20.x.x
   npm -v   # Should show 9.x.x or newer
   ```

3. **Install MongoDB 7.0**

   ```bash
   # Import MongoDB public key
   curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
     sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
     --dearmor
   
   # Create MongoDB repository list file
   echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | \
     sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
   
   # Update package list and install MongoDB
   sudo apt update
   sudo apt install -y mongodb-org
   
   # Start and enable MongoDB service
   sudo systemctl start mongod
   sudo systemctl enable mongod
   
   # Verify MongoDB is running
   sudo systemctl status mongod
   ```

4. **Install Nginx**

   ```bash
   sudo apt install -y nginx
   
   # Enable and start Nginx
   sudo systemctl enable nginx
   sudo systemctl start nginx
   
   # Configure firewall (if enabled)
   sudo ufw allow 'Nginx Full'
   ```

### Application Deployment

1. **Create Application Directory**

   ```bash
   sudo mkdir -p /var/www/wavemax
   sudo chown -R $USER:$USER /var/www/wavemax
   ```

2. **Clone the Repository**

   ```bash
   cd /var/www/wavemax
   git clone https://github.com/yourusername/wavemax-affiliate-program.git .
   ```

3. **Set Up Environment Variables**

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file with your production settings:

   ```bash
   # Generate secure encryption key
   ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   
   # Generate secure JWT secret
   JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
   
   # Edit .env file with secure keys and production settings
   sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
   sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
   sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" .env
   
   # Set MongoDB URI (change as needed for your setup)
   sed -i "s|^MONGODB_URI=.*|MONGODB_URI=mongodb://localhost:27017/wavemax|" .env
   
   # Set additional environment variables manually
   nano .env
   ```

4. **Install Dependencies and Build**

   ```bash
   npm ci --production
   ```

5. **Initialize MongoDB (Optional)**

   ```bash
   mongosh < init-mongo.js
   ```

6. **Configure Nginx**

   Create a new Nginx configuration file:

   ```bash
   sudo nano /etc/nginx/sites-available/wavemax
   ```

   Add the following configuration:

   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable the configuration:

   ```bash
   sudo ln -s /etc/nginx/sites-available/wavemax /etc/nginx/sites-enabled/
   sudo nginx -t  # Test configuration
   sudo systemctl restart nginx
   ```

7. **Set Up SSL with Let's Encrypt (Recommended)**

   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

### Process Management with PM2

1. **Install PM2**

   ```bash
   sudo npm install -g pm2
   ```

2. **Create PM2 Configuration**

   Create an ecosystem file:

   ```bash
   nano ecosystem.config.js
   ```

   Add the following content:

   ```javascript
   module.exports = {
     apps: [{
       name: 'wavemax',
       script: 'server.js',
       instances: 'max',
       exec_mode: 'cluster',
       autorestart: true,
       watch: false,
       max_memory_restart: '1G',
       env: {
         NODE_ENV: 'production'
       }
     }]
   };
   ```

3. **Start the Application**

   ```bash
   pm2 start ecosystem.config.js
   
   # Save PM2 configuration to start on system boot
   pm2 startup
   pm2 save
   ```

4. **Monitor the Application**

   ```bash
   pm2 status
   pm2 logs
   pm2 monit  # Interactive monitoring
   ```

### Database Backup Configuration

Set up automated MongoDB backups:

1. **Create Backup Script**

   ```bash
   mkdir -p /var/www/wavemax/scripts/backup
   nano /var/www/wavemax/scripts/backup/mongodb-backup.sh
   ```

   Add the following content:

   ```bash
   #!/bin/bash
   
   # Set variables
   BACKUP_DIR="/var/www/wavemax/backups"
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   BACKUP_FILE="$BACKUP_DIR/wavemax_$TIMESTAMP.gz"
   
   # Create backup directory if it doesn't exist
   mkdir -p $BACKUP_DIR
   
   # Create backup
   mongodump --db wavemax --gzip --archive=$BACKUP_FILE
   
   # Delete backups older than 14 days
   find $BACKUP_DIR -type f -name "wavemax_*.gz" -mtime +14 -delete
   ```

2. **Make the Script Executable**

   ```bash
   chmod +x /var/www/wavemax/scripts/backup/mongodb-backup.sh
   ```

3. **Set Up Cron Job**

   ```bash
   crontab -e
   ```

   Add the following line to run the backup daily at 2 AM:

   ```
   0 2 * * * /var/www/wavemax/scripts/backup/mongodb-backup.sh
   ```

### Security Considerations

1. **Set Up a Firewall**

   ```bash
   sudo ufw enable
   sudo ufw allow ssh
   sudo ufw allow 'Nginx Full'
   sudo ufw status
   ```

2. **Secure MongoDB**

   Create a MongoDB admin user:

   ```javascript
   use admin
   db.createUser({
     user: "adminUser",
     pwd: "securePassword",
     roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
   })
   ```

   Edit MongoDB configuration:

   ```bash
   sudo nano /etc/mongod.conf
   ```

   Add security settings:

   ```yaml
   security:
     authorization: enabled
   ```

   Restart MongoDB:

   ```bash
   sudo systemctl restart mongod
   ```

3. **Regular Updates**

   Set up automated security updates:

   ```bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

### Monitoring and Logging

1. **Set Up Application Monitoring**

   ```bash
   pm2 install pm2-server-monit  # Monitor server metrics
   ```

2. **Set Up Log Rotation**

   ```bash
   sudo nano /etc/logrotate.d/wavemax
   ```

   Add configuration:

   ```
   /var/www/wavemax/logs/*.log {
       daily
       missingok
       rotate 14
       compress
       delaycompress
       notifempty
       create 0640 www-data www-data
       sharedscripts
       postrotate
           pm2 reload all
       endscript
   }
   ```

## Maintenance

1. **Application Updates**

   ```bash
   # Pull latest changes
   cd /var/www/wavemax
   git pull
   
   # Install dependencies
   npm ci --production
   
   # Restart application
   pm2 reload all
   ```

2. **Database Maintenance**

   ```bash
   # Create database backup before maintenance
   /var/www/wavemax/scripts/backup/mongodb-backup.sh
   
   # Connect to MongoDB
   mongosh
   
   # Run database operations
   use wavemax
   db.getCollectionNames()
   db.orders.createIndex({ "status": 1, "createdAt": 1 })
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributors

- Your Name <your.email@example.com>

## Acknowledgments

- WaveMAX Laundry for the concept and business model
