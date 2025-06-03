# Coverage Analysis Report

This directory contains the comprehensive test coverage analysis for the WaveMAX Affiliate Program.

## Accessing the Report

### Development/Test Environment
Simply navigate to: `/coverage`

### Production Environment
Add the secret key to access: `/coverage?key=YOUR_COVERAGE_ACCESS_KEY`

Set the `COVERAGE_ACCESS_KEY` environment variable to enable production access.

## Report Contents

- **index.html** - Main dashboard with coverage overview
- **critical-files.html** - Deep analysis of files with lowest coverage
- **test-templates.html** - Ready-to-use test code templates
- **action-plan.html** - Sprint planning and prioritization guide

## Security Features

1. **Iframe Protection**: Reports cannot be accessed from embedded contexts
2. **Environment Check**: Automatically available in development/test
3. **Secret Key**: Required for production access
4. **X-Frame-Options**: Set to DENY to prevent embedding

## Generated
December 6, 2024