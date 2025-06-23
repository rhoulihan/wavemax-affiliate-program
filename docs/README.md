# WaveMAX Documentation Index

Welcome to the WaveMAX Affiliate Program documentation. This directory contains all technical documentation, implementation details, and development guides.

## 📁 Documentation Structure

### 🔧 [Implementation Details](./implementation/)
Technical implementation documentation for specific features:
- [Paygistix Integration Guide](./implementation/PAYGISTIX_INTEGRATION_GUIDE.md) - Complete payment integration documentation
- [Paygistix Integration Summary](./implementation/PAYGISTIX_INTEGRATION_SUMMARY.md) - Quick overview of payment system
- [Paygistix Form Pool Guide](./implementation/PAYGISTIX_FORM_POOL_GUIDE.md) - Callback URL pool system
- [Paygistix Environment Config](./implementation/PAYGISTIX_ENV_CONFIG.md) - Environment configuration guide
- [Paygistix Context Filtering](./implementation/PAYGISTIX_CONTEXT_FILTERING.md) - Context-based payment filtering
- [Paygistix Integration Complete](./implementation/PAYGISTIX_INTEGRATION_COMPLETE.md) - Final integration notes
- [Paygistix Callback Analysis](./implementation/paygistix-callback-analysis.md) - Callback parameter documentation
- [Customer Registration with Paygistix](./implementation/CUSTOMER_REGISTRATION_PAYGISTIX.md) - Customer payment setup
- [Window Detection Analysis](./implementation/WINDOW_DETECTION_ANALYSIS.md) - Payment window detection
- [Service Area Component](./implementation/service-area-component-complete.md) - Address validation implementation
- [Bag Fee Line Item](./implementation/BAG_FEE_LINE_ITEM.md) - Delivery fee structure
- [Admin Setup Changes](./implementation/ADMIN_SETUP_CHANGES.md) - Administrator configuration
- [Operator Scanning Workflow](./implementation/OPERATOR_SCANNING_WORKFLOW.md) - Three-stage QR code scanning process

### 📊 [System Monitoring](../monitoring/)
System health and connectivity monitoring:
- [Monitoring Dashboard](../monitoring-dashboard.html) - Real-time service health dashboard
- [Mailcow Email Setup](./mailcow-email-setup.md) - Self-hosted email server configuration
- [Mailcow Installation Guide](./mailcow-installation.md) - Email server installation steps

### 📚 [Integration Guides](./guides/)
Step-by-step guides for integrating and using the system:
- [Embed Integration Guide](./guides/embed-integration-guide.md) - How to embed the application
- [Mobile Parent Integration](./guides/mobile-parent-integration-guide.md) - Mobile-responsive iframe setup
- [Embed Test Pages Guide](./guides/embed-test-pages-guide.md) - Testing embedded implementations
- [i18n Best Practices](./guides/i18n-best-practices.md) - Internationalization guidelines
- [DocuSign W9 Migration Guide](./guides/docusign-w9-migration-guide.md) - Migrating to electronic W-9 signatures

### 🛠️ [Development](./development/)
Development tools, best practices, and ongoing work:
- [Operating Best Practices](./development/OPERATING_BEST_PRACTICES.md) - Known issues and workarounds
- [Backlog](./development/BACKLOG.md) - Pending work items and future features
- [DocuSign W9 Integration Plan](./development/docusign-w9-integration-plan.md) - Technical plan for DocuSign integration
- [Code Audit Report](./development/CODE_AUDIT_REPORT.md) - Code quality analysis
- [Test Coverage Summary](./development/test-coverage-final-summary-2025-01-07.md) - Test coverage analysis
- [Unused Functions Report](./development/unused-functions-report.md) - Dead code analysis
- [Claude Instructions](./development/CLAUDE.md) - AI assistant configuration

### 📜 [Project History](./project-history/)
Historical documentation and change tracking:
- [Changelog](./project-history/CHANGELOG.md) - Detailed change history
- [Recent Updates](./project-history/RECENT_UPDATES.md) - Major feature updates
- [Project Logs](../project-logs/) - Detailed implementation logs for major features

### 💡 [Examples](./examples/)
Working examples and implementation templates:
- [Iframe Embed Examples](./examples/README.md) - Complete embedding implementations
- [WaveMAX Laundry Integration](./examples/wavemaxlaundry-iframe-embed.html) - Full-featured embed
- [Simple Embed](./examples/wavemaxlaundry-simple-embed.html) - Basic implementation
- [Embed Code Snippet](./examples/wavemaxlaundry-iframe-code.txt) - Copy-paste ready code

### 🔍 [API Documentation](./paygistix/)
Detailed API and parameter documentation:
- [Paygistix Callback Parameters](./paygistix/paygistix-callback-parameters.md)
- [Paygistix Implementation](./paygistix/paygistix-implementation.md)
- [Paygistix Quick Reference](./paygistix/paygistix-quick-reference.md)

## 🚀 Quick Start

If you're new to the project, start with:
1. The main [README](../README.md) for project overview
2. [Embed Integration Guide](./guides/embed-integration-guide.md) for deployment
3. [Operating Best Practices](./development/OPERATING_BEST_PRACTICES.md) for known issues

## 📊 Test Documentation

For testing information, see:
- [Test Suite README](../tests/README.md) - How to run tests
- [Test Coverage Analysis](../public/coverage-analysis/README.md) - Coverage reports

## 🔐 Security Documentation

Security-related documentation is integrated throughout:
- W-9 document encryption details in the main README
- DocuSign W-9 integration security in [DocuSign Integration Plan](./development/docusign-w9-integration-plan.md)
- CSRF protection in [Operating Best Practices](./development/OPERATING_BEST_PRACTICES.md)
- Authentication flows in the API documentation section of the main README

## 📝 Contributing

When adding new documentation:
1. Place implementation details in `docs/implementation/`
2. Place user guides in `docs/guides/`
3. Place development tools in `docs/development/`
4. Update this index file with links to new documents
5. Keep the main README focused on project overview and setup

## 🔗 External Resources

- [Main Project README](../README.md)
- [Project Repository](https://github.com/yourusername/wavemax-affiliate-program)
- [WaveMAX Laundry Website](https://wavemaxlaundry.com)