# WaveMAX Affiliate Program - Embed Test Pages Guide

This guide explains the different test pages available for testing the WaveMAX Affiliate Program iframe embedding functionality.

## Test Pages Overview

### 1. **test-embed-local.html**
- **URL**: `/test-embed-local.html`
- **Purpose**: Simple local test page with basic embed functionality
- **Features**: 
  - Test header/footer that hide on mobile
  - Quick links to test different URL parameters
  - Basic message handling
- **Best for**: Quick testing of basic functionality

### 2. **iframe-parent-example.html**
- **URL**: `/iframe-parent-example.html`
- **Purpose**: Original example showing basic iframe integration
- **Features**:
  - Height resizing
  - Scroll-to-top
  - Route change tracking
- **Best for**: Understanding the basic integration approach

### 3. **iframe-parent-example-complete.html**
- **URL**: `/iframe-parent-example-complete.html`
- **Purpose**: Complete testing environment with all bridge features
- **Features**:
  - Full parent-iframe bridge implementation
  - Test controls for simulating mobile/desktop
  - Event logging
  - Manual navigation controls
  - Language switching tests
  - Geocoding simulation
- **Best for**: Comprehensive testing of all features

### 4. **wavemaxlaundry-embed-code.html**
- **URL**: `/wavemaxlaundry-embed-code.html`
- **Purpose**: Documentation page showing the basic embed code
- **Features**:
  - Complete embed code examples
  - URL parameter documentation
  - Implementation notes
- **Best for**: Reference for basic implementation

### 5. **wavemaxlaundry-embed-code-complete.html**
- **URL**: `/wavemaxlaundry-embed-code-complete.html`
- **Purpose**: Documentation for the complete embed code with all features
- **Features**:
  - Full embed code with mobile support
  - Chrome hiding functionality
  - Container padding removal
  - Language and geocoding support
- **Best for**: Production implementation reference

## Testing Different Scenarios

### Testing Affiliate Registration
Add `?affid=AFF123456` to any test page URL:
- `/test-embed-local.html?affid=AFF123456`
- Shows customer registration form for the specified affiliate

### Testing Login Pages
Add `?login=TYPE` where TYPE can be:
- `customer` - Customer login
- `affiliate` - Affiliate login
- `admin` - Administrator login
- `operator` - Operator login

Example: `/test-embed-local.html?login=customer`

### Testing Direct Routes
Add `?route=/PAGE` where PAGE can be:
- `/affiliate-dashboard`
- `/customer-dashboard`
- `/schedule-pickup`
- `/order-confirmation`

Example: `/test-embed-local.html?route=/schedule-pickup`

### Testing Mobile Behavior
1. Open `/iframe-parent-example-complete.html`
2. Use browser developer tools to simulate mobile viewport
3. Or use the "Simulate Mobile" button in the test controls

### Testing Height Adjustment
Navigate between different pages within the embedded app to see automatic height adjustment.

### Testing Language Support
1. Open `/iframe-parent-example-complete.html`
2. Use the language buttons to test language switching
3. The embedded content should update accordingly

## Production Implementation

For production use, refer to:
- `/wavemaxlaundry-embed-code-complete.html` for the full embed code
- Copy the entire script block including all functionality
- Adjust the chrome hiding selectors to match your site's structure

## Common Issues

### Iframe Not Loading
- Check browser console for errors
- Verify the iframe src URL is correct
- Check for Content Security Policy issues

### Mobile Chrome Not Hiding
- Ensure viewport detection is working
- Check that the correct selectors are used for your site's header/footer
- Verify message passing is working (check console logs)

### Height Not Adjusting
- Check that message event listeners are set up
- Verify origin checks aren't blocking messages
- Look for JavaScript errors in console

## Development Tips

1. Always test in both desktop and mobile viewports
2. Use browser developer tools to monitor console messages
3. Test with different URL parameters to ensure routing works
4. Check that the iframe maintains proper height when navigating between pages
5. Verify that mobile chrome hiding/showing transitions are smooth