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
│   └── order-confirmation.html            # Order confirmation page
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

## Included Components

### Frontend Pages

1. **Landing Page** (`index.html`): Program overview and affiliate registration CTA
2. **Affiliate Registration** (`affiliate-register.html`): Form to sign up new affiliates
3. **Affiliate Login** (`affiliate-login.html`): Authentication for affiliates
4. **Affiliate Success** (`affiliate-success.html`): Registration confirmation with next steps
5. **Affiliate Dashboard** (`affiliate-dashboard.html`): Complete management console
6. **Customer Registration** (`customer-register.html`): Form for affiliates to register customers
7. **Customer Login** (`customer-login.html`): Authentication for customers
8. **Customer Success** (`customer-success.html`): Registration confirmation for customers
9. **Customer Dashboard** (`customer-dashboard.html`): Customer portal for orders
10. **Schedule Pickup** (`schedule-pickup.html`): Form to schedule laundry pickups
11. **Order Confirmation** (`order-confirmation.html`): Details of scheduled pickup

### Backend Components

1. **API Controllers**: Business logic for all operations
2. **MongoDB Models**: Data schemas and relationships
3. **API Routes**: RESTful endpoint definitions
4. **Authentication**: JWT-based security
5. **Email Service**: Notification system using templates
6. **Encryption**: Secure handling of sensitive data

### Visualization Components

1. **Affiliate Metrics Dashboard**: React component for affiliates analytics
2. **Customer Dashboard Analytics**: React component for customer analytics

### Configuration & Deployment

1. **Docker Configuration**: Container setup for development and production
2. **MongoDB Initialization**: Database setup script
3. **Environment Configuration**: Security and connection settings

## Technologies Used

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with MongoDB Atlas)
- **Visualization**: React, Recharts
- **Security**: JWT, AES-256-GCM encryption
- **Deployment**: Docker, Nginx
- **Email**: Nodemailer

## Setup & Installation

### Prerequisites

- Node.js v16+
- MongoDB
- npm or yarn

### Local Development

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

4. Start the development server:
   ```
   npm run dev
   ```

5. Access the application at `http://localhost:3000`

### Docker Development

1. Start using Docker Compose:
   ```
   docker-compose up
   ```

2. Access the application at `http://localhost:3000`

## Deployment

See the detailed [Deployment Guide](docs/deployment/README.md) for instructions on deploying to:

- Traditional web servers
- Docker environments
- Cloud platforms (AWS, Azure, GCP)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributors

- Your Name <your.email@example.com>

## Acknowledgments

- WaveMAX Laundry for the concept and business model
