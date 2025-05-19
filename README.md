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
- **Amazon SES Integration**: Added support for scalable email notifications using Amazon SES
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
│   │   ├── auth.js                        # Authentication middleware
│   │   └── errorHandler.js                # Central error handling middleware
│   │
│   ├── models/                            # Mongoose models
│   │   ├── Affiliate.js                   # Affiliate model
│   │   ├── Customer.js                    # Customer model
│   │   ├── Order.js                       # Order model
│   │   ├── Bag.js                         # Bag model
│   │   ├── RefreshToken.js                # Refresh token model
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
│       ├── encryption.js                  # Data encryption utilities
│       ├── logger.js                      # Logging service
│       └── paginationMiddleware.js        # Pagination utility
│
├── tests/                                 # Test files
│   ├── setup.js                           # Test setup configuration
│   ├── integration/                       # Integration tests
│   │   └── affiliate.test.js              # Affiliate API tests
│   └── unit/                              # Unit tests
│       ├── emailService.test.js           # Email service tests
│       └── encryption.test.js             # Encryption utility tests
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
- **Deployment**: Docker, Nginx, PM2
- **Email**: Amazon SES, Nodemailer
- **Testing**: Jest, Supertest, MongoDB Memory Server
- **Logging**: Winston

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

4. Generate secure keys and configure all required settings:

   ```bash
   # Open the .env file in your editor
   nano .env
   ```

### Environment Variable Configuration Guide

Below is a detailed guide for configuring each setting in your `.env` file:

#### Basic Configuration

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `NODE_ENV` | Environment mode | Set to `development`, `test`, or `production` |
| `PORT` | Server port | Set to `3000` or your preferred port |

#### MongoDB Configuration

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `MONGODB_URI` | MongoDB connection string | For local development: `mongodb://localhost:27017/wavemax`<br>For MongoDB Atlas: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/wavemax?retryWrites=true&w=majority` |

#### Security Keys

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `ENCRYPTION_KEY` | 32-byte key for data encryption | Generate using:<br>`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_SECRET` | Secret for JWT token signing | Generate using:<br>`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `SESSION_SECRET` | Secret for Express sessions | Generate using:<br>`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

#### Email Configuration with Amazon SES

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `EMAIL_PROVIDER` | Email service to use | Set to `ses` to use Amazon SES |
| `AWS_REGION` | AWS region for SES | Example: `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | From your IAM user with SES permissions |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | From your IAM user with SES permissions |
| `SES_FROM_EMAIL` | Verified sender email | Email verified in SES, e.g., `noreply@yourdomain.com` |

#### CORS Configuration

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `CORS_ORIGIN` | Allowed origins for CORS | For development: `http://localhost:3000`<br>For production: `https://yourdomain.com,https://www.yourdomain.com`<br>Multiple domains separated by commas |

#### Payment Processing (Optional)

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `STRIPE_SECRET_KEY` | Stripe secret API key | 1. Create a Stripe account<br>2. Go to Developers > API keys<br>3. Copy the Secret key<br>Format: `sk_test_...` or `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable API key | Copy from the same Stripe dashboard<br>Format: `pk_test_...` or `pk_live_...` |

#### File Storage (Optional for Bag Barcodes)

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `AWS_S3_BUCKET` | AWS S3 bucket name | Create in AWS S3 console: `wavemax-laundry-barcodes` |
| `AWS_REGION` | AWS region for the bucket | Example: `us-east-1` |

#### Frontend URL Configuration

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `FRONTEND_URL` | Base URL for frontend links | Development: `http://localhost:3000`<br>Production: `https://yourdomain.com` |

#### Logging Configuration

| Variable | Description | How to Generate/Configure |
|----------|-------------|---------------------------|
| `LOG_LEVEL` | Logging verbosity level | Set to `error`, `warn`, `info`, `verbose`, `debug`, or `silly`. Default: `info` |
| `LOG_DIR` | Directory for log files | Default: `logs` directory in project root. Make sure this directory exists |

5. Start the development server:
   ```
   npm run dev
   ```

6. Access the application at `http://localhost:3000`

### Using Amazon SES for Email Notifications

The WaveMAX Laundry Affiliate Program uses Amazon Simple Email Service (SES) for sending emails to affiliates and customers. Follow these steps to configure Amazon SES:

#### 1. Set Up Your AWS Account

If you don't already have an AWS account, create one at [aws.amazon.com](https://aws.amazon.com/).

#### 2. Verify Email Addresses or Domains in SES

1. Navigate to the Amazon SES console
2. Select "Verified Identities" from the left sidebar
3. Click "Create identity"
4. Choose between verifying an email address or an entire domain
   - For email addresses: Enter the email and click "Create identity"
   - For domains: Follow the DNS verification instructions provided
5. Complete the verification process by following the instructions sent to your email or by adding the required DNS records

#### 3. Create an IAM User with SES Permissions

1. Navigate to the IAM console
2. Select "Users" from the left sidebar
3. Click "Add users"
4. Enter a username (e.g., `wavemax-ses-user`)
5. Select "Access key - Programmatic access" as the access type
6. Click "Next: Permissions"
7. Click "Attach existing policies directly"
8. Create a new policy with the following JSON:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail",
                "ses:SendTemplatedEmail"
            ],
            "Resource": "*"
        }
    ]
}
```

9. Name the policy (e.g., `WaveMAXSESPolicy`), provide a description, and create it
10. Attach the newly created policy to your user
11. Complete the user creation process
12. Save the Access Key ID and Secret Access Key displayed at the end

#### 4. Configure Your Application

Update your `.env` file with the SES configuration:

```
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
SES_FROM_EMAIL=noreply@yourdomain.com
```

#### 5. Move from SES Sandbox to Production (Optional)

By default, new AWS accounts have SES in sandbox mode, which only allows sending to verified email addresses. To move to production:

1. Navigate to the SES console
2. Select "Account dashboard" from the left sidebar
3. Find the "Production access" section
4. Click "Request production access"
5. Fill out the request form with your use case details
6. Submit the request and wait for AWS approval

#### 6. Set Up Bounce and Complaint Handling

To maintain a good sender reputation:

1. Navigate to the SES console
2. Select "Configuration sets" from the left sidebar
3. Create a new configuration set
4. Add an SNS event destination for bounce and complaint notifications
5. Create an SNS topic to receive these notifications
6. Implement a handler for these notifications in your application or set up email forwarding

### Docker Development

1. Start using Docker Compose:
   ```
   docker-compose up
   ```

2. Access the application at `http://localhost:3000`

When using Docker, ensure your environment variables in the docker-compose.yml file are properly set.

## Known Issues and Troubleshooting

### CSRF Protection

The application uses CSRF protection for all API routes. When testing API endpoints:

1. Make sure the CSRF token is included in all forms via a hidden input:
   ```html
   <input type="hidden" name="_csrf" value="{{csrfToken}}">
   ```

2. For frontend JavaScript, include the CSRF token in the fetch headers:
   ```javascript
   fetch('/api/endpoint', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'CSRF-Token': document.querySelector('[name="_csrf"]').value
     },
     credentials: 'same-origin',
     body: JSON.stringify(data)
   });
   ```

3. For public endpoints (like registration), you may need to exclude them from CSRF protection in `server.js`.

### Rate Limiting

The application uses express-rate-limit for security. When deploying behind a proxy:

1. Ensure proper proxy configuration in `server.js`:
   ```javascript
   // Add this near the beginning of server.js
   app.set('trust proxy', 1);  // Trust first proxy
   ```

2. If experiencing rate limit issues, check the IP identification configuration in auth.js.

### Data Encryption

Sensitive data like payment information is encrypted using AES-256-GCM:

1. Ensure `ENCRYPTION_KEY` is properly set in `.env`
2. For model fields that need encryption, they should be defined as objects in the schema:
   ```javascript
   fieldName: {
     iv: String,
     encryptedData: String,
     authTag: String
   }
   ```

3. The encryption/decryption is handled by middleware in the model definition.

## Testing

Run the test suite:

```
npm test
```

The project uses Jest with MongoDB Memory Server for testing, allowing database tests to run without affecting your local MongoDB instance.

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
   
   # Generate secure session secret
   SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   
   # Edit .env file with secure keys and production settings
   sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
   sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
   sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
   sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" .env
   
   # Set MongoDB URI (change as needed for your setup)
   sed -i "s|^MONGODB_URI=.*|MONGODB_URI=mongodb://localhost:27017/wavemax|" .env
   
   # Set additional environment variables manually
   nano .env
   ```
   
   Refer to the [Environment Variable Configuration Guide](#environment-variable-configuration-guide) for details on configuring each setting.


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

3. **Create Logs Directory**

   ```bash
   mkdir -p /var/www/wavemax/logs
   chmod 755 /var/www/wavemax/logs
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
