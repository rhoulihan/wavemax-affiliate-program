# Marketing Email System

## Overview

The Marketing Email System provides administrators with a professional outreach tool to contact potential business clients in healthcare, caregiving, and catering sectors. The system features hospital-quality sanitation messaging centered around WaveMAX's Omni LUX UV water purification technology.

## Features

- **Template Management**: Extensible template system supporting multiple marketing campaigns
- **Admin Dashboard Integration**: One-click access from the Affiliates tab
- **TDD Implementation**: Comprehensive test coverage with 10 passing integration tests
- **Form Validation**: Client and server-side validation for email addresses and recipient names
- **Real-time Feedback**: Loading states and success/error notifications
- **Professional Templates**: Mobile-responsive HTML emails with hospital-grade sanitation messaging

## Available Templates

### Healthcare & Catering Outreach
**Template ID**: `healthcare-catering-outreach`

**Target Audience**:
- Healthcare facilities
- Nursing homes and assisted living facilities
- Caregivers and home health agencies
- Caterers and food service businesses
- Medical offices and clinics
- Restaurants and hospitality

**Key Messaging**:
- Hospital-quality sanitation with Omni LUX UV water purification
- 99.99% bacteria/virus elimination
- Convenient pickup and delivery service
- Fast turnaround times
- Eco-friendly and safe for sensitive skin
- Professional laundry solutions for critical business needs

## Usage

### Admin Dashboard

1. Navigate to the **Affiliates** tab in the administrator dashboard
2. Click the **"Send Marketing Email"** button (with envelope icon)
3. Fill in the recipient information:
   - **Recipient Name**: Business contact name (e.g., "John Smith")
   - **Email Address**: Valid email address (e.g., "john@business.com")
   - **Email Template**: Select from dropdown (currently "Healthcare & Catering Outreach")
4. Click **"Send Email"**
5. Wait for confirmation and success notification

### API Endpoints

#### Get Marketing Templates
```
GET /api/v1/administrators/marketing/templates
Authorization: Bearer <admin-jwt-token>

Response:
{
  "success": true,
  "templates": [
    {
      "id": "healthcare-catering-outreach",
      "name": "Healthcare & Catering Outreach",
      "description": "Professional outreach for healthcare facilities, nursing homes, caregivers, and catering businesses...",
      "targetAudience": ["Healthcare facilities", "Nursing homes", "Caregivers", "Caterers", "Food service businesses"]
    }
  ]
}
```

#### Send Marketing Email
```
POST /api/v1/administrators/marketing/send
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json

Request Body:
{
  "recipientEmail": "contact@business.com",
  "recipientName": "Jane Doe",
  "templateType": "healthcare-catering-outreach"
}

Response:
{
  "success": true,
  "message": "Marketing email sent successfully",
  "recipient": "contact@business.com",
  "templateType": "healthcare-catering-outreach"
}
```

## Implementation Details

### Backend Components

**Controller**: `server/controllers/marketingController.js`
- `getTemplates()`: Returns list of available templates
- `sendMarketingEmail()`: Validates input and sends email
- Template validation and error handling

**Service**: `server/utils/emailService.js`
- `sendMarketingEmail(recipientEmail, recipientName, templateType)`: Core email sending function
- Template loading and variable substitution
- SMTP configuration with TLS servername handling for IP-based connections

**Routes**: `server/routes/administratorRoutes.js`
- `GET /marketing/templates`: List templates
- `POST /marketing/send`: Send email with validation middleware

**Templates**: `server/templates/emails/marketing/`
- `healthcare-catering-outreach.html`: Professional HTML email template

### Frontend Components

**HTML**: `public/administrator-dashboard-embed.html`
- "Send Marketing Email" button in Affiliates tab header
- Modal with form fields (name, email, template dropdown)
- Alert area for success/error messages

**JavaScript**: `public/assets/js/administrator-dashboard-init.js`
- `loadMarketingEmailTemplates()`: Fetches and populates template dropdown
- `openMarketingEmailModal()`: Opens modal and loads templates
- `closeMarketingEmailModal()`: Closes modal
- `sendMarketingEmail(event)`: Handles form submission with loading states

### Tests

**Integration Tests**: `tests/integration/marketing.test.js`
- 10 comprehensive test cases covering:
  - Authentication requirements
  - Input validation (email, name, template)
  - Email format validation
  - Template validation
  - Successful email sending
  - Default template handling
  - Template list retrieval

**Test Coverage**: All tests passing with proper error handling and edge case coverage

## Adding New Templates

To add a new marketing email template:

1. **Create HTML Template**:
   ```bash
   touch server/templates/emails/marketing/your-template-name.html
   ```

2. **Update Controller**:
   Add template definition to `MARKETING_TEMPLATES` array in `marketingController.js`:
   ```javascript
   {
     id: 'your-template-name',
     name: 'Your Template Display Name',
     description: 'Detailed description...',
     targetAudience: ['Audience 1', 'Audience 2']
   }
   ```

3. **Update Email Service** (if needed):
   Add subject line mapping in `emailService.js`:
   ```javascript
   const subjects = {
     'healthcare-catering-outreach': 'Hospital-Quality Laundry Service...',
     'your-template-name': 'Your Email Subject'
   };
   ```

4. **Test**:
   - Add integration tests for the new template
   - Verify template appears in dropdown
   - Send test email to validate formatting

## Security

- **Authentication Required**: Only authenticated administrators can access marketing endpoints
- **Input Validation**: Server-side validation of all inputs
- **CSRF Protection**: CSRF tokens required for POST requests
- **Email Validation**: Regex-based email format validation
- **Error Handling**: Graceful error handling with user-friendly messages
- **Logging**: All marketing email sends are logged with admin identification

## SMTP Configuration

The system uses Nodemailer with custom TLS configuration to handle IP-based SMTP connections:

```javascript
// Supports both hostname and IP address for EMAIL_HOST
// If using IP (e.g., 158.62.198.7), automatically sets servername for TLS cert verification
transportConfig.tls = {
  servername: 'mail.wavemax.promo'
};
```

**Environment Variables**:
- `EMAIL_HOST`: SMTP server hostname or IP (e.g., `158.62.198.7` or `mail.wavemax.promo`)
- `EMAIL_PORT`: SMTP port (default: `587`)
- `EMAIL_USER`: SMTP username
- `EMAIL_PASS`: SMTP password
- `EMAIL_FROM`: From address for emails

## Future Enhancements

- [ ] Email sending history and analytics
- [ ] Bulk email sending capabilities
- [ ] A/B testing for email templates
- [ ] Custom template creation interface
- [ ] Email open and click tracking
- [ ] Scheduled email campaigns
- [ ] Contact list management
- [ ] Template preview functionality
- [ ] Multi-language template support

## Troubleshooting

### Email Not Sending
- Check SMTP configuration in `.env`
- Verify EMAIL_HOST resolves correctly
- Check PM2 logs: `pm2 logs wavemax --lines 100`
- Test SMTP connectivity: `nc -zv <EMAIL_HOST> <EMAIL_PORT>`

### Modal Not Opening
- Check browser console for JavaScript errors
- Verify button ID matches event listener
- Ensure administrator-dashboard-init.js is loaded

### Template Not Appearing
- Verify template is added to MARKETING_TEMPLATES array
- Check template file exists in correct directory
- Restart application after adding new templates

## Support

For issues or questions about the Marketing Email System:
1. Check application logs: `pm2 logs wavemax`
2. Review test results: `npm test -- tests/integration/marketing.test.js`
3. Verify SMTP configuration and connectivity
4. Check browser console for frontend errors
