# WaveMAX Laundry Affiliate Program

This repository contains the complete solution for the WaveMAX Laundry affiliate program, allowing individuals to register as affiliates and provide pickup/delivery services for WaveMAX's wash, dry, fold laundry services.

## Overview

The WaveMAX Affiliate Program enables individuals to register as affiliates, onboard their own customers, and manage pickup and delivery of laundry for WaveMAX's wash, dry, fold (WDF) services. Affiliates earn 10% commission on all WDF orders plus any markup they set for delivery services.

### Features

- **Affiliate Registration**: Register as a WaveMAX affiliate partner
- **Customer Onboarding**: Affiliates can register customers with their unique affiliate link
- **Laundry Bag Tracking**: Each customer receives barcoded laundry bags associated with their account
- **Scheduling System**: Customers can schedule pickups and deliveries
- **Affiliate Dashboard**: Manage customers, orders, and earnings
- **Customer Dashboard**: Manage orders and schedule pickups

## Technical Stack

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **Backend**: Node.js with Express
- **Database**: MongoDB Atlas (cloud-hosted)
- **Security**: AES-256-GCM encryption for sensitive data, JWT authentication
- **Email**: Nodemailer for notification emails

## Installation and Setup

### Prerequisites

- Node.js v14 or higher
- MongoDB Atlas account
- SMTP email provider (for notifications)

### Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/wavemax-affiliate-program.git
   cd wavemax-affiliate-program
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory (use the provided env-config as a template)

4. Configure MongoDB Atlas:
   - Create a new cluster in MongoDB Atlas
   - Set up Network Access to allow connections
   - Create a database user with read/write permissions
   - Update the MONGODB_URI in your `.env` file

5. Generate a secure encryption key:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   
6. Update the ENCRYPTION_KEY in your `.env` file with the generated key

7. Start the server:
   ```
   npm start
   ```

## Deployment

### Development Environment

```
npm run dev
```

### Production Environment

```
npm start
```

For production deployment, we recommend using a process manager like PM2:

```
npm install -g pm2
pm2 start server.js --name wavemax-affiliate
```

## MongoDB Atlas Configuration

The application uses MongoDB Atlas for secure, cloud-hosted database storage. The database includes the following collections:

- **Affiliates**: Affiliate partner accounts
- **Customers**: Customer accounts registered through affiliates
- **Orders**: Laundry pickup/delivery orders
- **Bags**: Laundry bag tracking
- **Transactions**: Affiliate commission transactions

## Security Considerations

This application handles sensitive customer and payment information. The following security measures are implemented:

1. **Data Encryption**: All sensitive data (payment information, personal details) is encrypted using AES-256-GCM
2. **Password Security**: Passwords are salted and hashed using PBKDF2 with 10,000 iterations
3. **JWT Authentication**: Secure token-based authentication for API endpoints
4. **HTTPS**: All production deployments should use HTTPS
5. **Input Validation**: Thorough validation of all user inputs
6. **PCI Compliance**: Payment information handling follows best practices

## File Structure

```
├── public/               # Static files (HTML, CSS, client-side JS)
│   ├── index.html        # Landing page
│   ├── affiliate-register.html  # Affiliate registration
│   ├── customer-register.html   # Customer registration
│   ├── schedule-pickup.html     # Pickup scheduling
│   ├── affiliate-dashboard.html # Affiliate dashboard
│   ├── customer-dashboard.html  # Customer dashboard
│
├── server/               # Server-side code
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API routes
│   ├── controllers/      # Business logic
│   ├── utils/            # Utility functions
│   ├── middleware/       # Express middleware
│
├── .env                  # Environment variables
├── server.js             # Main application entry point
└── README.md             # Project documentation
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions or support, please contact:

- Email: support@wavemaxlaundry.com
- Phone: (555) 123-4567
