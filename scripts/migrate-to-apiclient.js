#!/usr/bin/env node

/**
 * Script to help migrate fetch() calls to ApiClient
 * This script identifies fetch patterns and suggests ApiClient replacements
 */

const fs = require('fs');
const path = require('path');

// Common fetch patterns and their ApiClient replacements
const migrationPatterns = [
    {
        name: 'POST with CSRF',
        pattern: /fetch\([^,]+,\s*{\s*method:\s*['"]POST['"]/,
        example: {
            before: `
fetch('/api/endpoint', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
    },
    credentials: 'include',
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(result => {
    if (result.success) {
        // handle success
    } else {
        showError(result.message);
    }
})
.catch(error => {
    console.error('Error:', error);
    showError('Request failed');
});`,
            after: `
await ApiClient.post('/api/endpoint', data, {
    showLoading: true,
    showSuccess: true,
    csrf: true  // Automatically handles CSRF
});
// Errors are handled automatically`
        }
    },
    {
        name: 'GET request',
        pattern: /fetch\([^)]+\)(?!\s*{\s*method)/,
        example: {
            before: `
fetch('/api/endpoint')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // handle data
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });`,
            after: `
const data = await ApiClient.get('/api/endpoint', {
    showError: true
});
// Error handling is automatic`
        }
    },
    {
        name: 'Form submission',
        pattern: /new FormData\(.*?\);[\s\S]*?fetch/,
        example: {
            before: `
const formData = new FormData(form);
fetch('/api/submit', {
    method: 'POST',
    body: formData
})`,
            after: `
await ApiClient.submitForm('/api/submit', form, {
    showLoading: true,
    showSuccess: true
});`
        }
    }
];

// Files to migrate
const filesToMigrate = [
    'public/assets/js/customer-register-v2.js',
    'public/assets/js/operator-scan-init.js',
    'public/assets/js/affiliate-register-init.js',
    'public/assets/js/customer-dashboard.js',
    'public/assets/js/schedule-pickup-v2-embed.js',
    'public/assets/js/affiliate-dashboard-init.js'
];

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fetchCalls = content.match(/fetch\([^}]+\}/g) || [];
    
    console.log(`\n📄 ${path.basename(filePath)}`);
    console.log(`   Found ${fetchCalls.length} fetch calls`);
    
    // Identify patterns
    const foundPatterns = [];
    migrationPatterns.forEach(pattern => {
        if (pattern.pattern.test(content)) {
            foundPatterns.push(pattern.name);
        }
    });
    
    if (foundPatterns.length > 0) {
        console.log(`   Patterns: ${foundPatterns.join(', ')}`);
    }
    
    return {
        file: filePath,
        fetchCount: fetchCalls.length,
        patterns: foundPatterns
    };
}

function generateMigrationGuide() {
    console.log('\n' + '='.repeat(60));
    console.log('FRONTEND MIGRATION GUIDE: fetch() to ApiClient');
    console.log('='.repeat(60));
    
    console.log('\n1️⃣  ADD ApiClient to page scripts in embed-app-v2.js:');
    console.log(`   '/your-route': ['/assets/js/api-client.js', ...other scripts]`);
    
    console.log('\n2️⃣  MIGRATION PATTERNS:\n');
    
    migrationPatterns.forEach((pattern, index) => {
        console.log(`Pattern ${index + 1}: ${pattern.name}`);
        console.log('\nBEFORE:');
        console.log('```javascript' + pattern.example.before + '\n```');
        console.log('\nAFTER:');
        console.log('```javascript' + pattern.example.after + '\n```');
        console.log('\n' + '-'.repeat(60) + '\n');
    });
    
    console.log('3️⃣  BENEFITS:');
    console.log('   ✅ Automatic CSRF token handling');
    console.log('   ✅ Built-in loading spinners');
    console.log('   ✅ Consistent error display');
    console.log('   ✅ Automatic success messages');
    console.log('   ✅ Request retry capability');
    console.log('   ✅ Batch request support');
    console.log('   ✅ Polling functionality');
    
    console.log('\n4️⃣  ApiClient FEATURES:');
    console.log('   • get(endpoint, options)');
    console.log('   • post(endpoint, data, options)');
    console.log('   • put(endpoint, data, options)');
    console.log('   • delete(endpoint, options)');
    console.log('   • upload(endpoint, file, data, options)');
    console.log('   • submitForm(endpoint, formElement, options)');
    console.log('   • getPaginated(endpoint, page, limit, filters, options)');
    console.log('   • poll(endpoint, checkFn, options)');
    console.log('   • batch(requests, options)');
    console.log('   • retry(fn, options)');
    
    console.log('\n5️⃣  OPTIONS:');
    console.log('   • showLoading: Show spinner (default: true)');
    console.log('   • showError: Show error messages (default: true)');
    console.log('   • showSuccess: Show success message (default: false)');
    console.log('   • csrf: Include CSRF token (default: true for POST/PUT/DELETE)');
    console.log('   • loadingMessage: Custom spinner message');
    console.log('   • credentials: Fetch credentials option (default: "same-origin")');
}

// Main execution
console.log('🔍 Analyzing frontend files for fetch() usage...\n');

const results = [];
filesToMigrate.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        results.push(analyzeFile(filePath));
    } else {
        console.log(`   ⚠️  File not found: ${file}`);
    }
});

// Summary
const totalFetchCalls = results.reduce((sum, r) => sum + r.fetchCount, 0);
console.log('\n' + '='.repeat(60));
console.log(`📊 SUMMARY: ${totalFetchCalls} total fetch calls across ${results.length} files`);
console.log('='.repeat(60));

// Generate migration guide
generateMigrationGuide();

// Create a simple migration helper function
console.log('\n' + '='.repeat(60));
console.log('QUICK MIGRATION HELPER');
console.log('='.repeat(60));
console.log('\nAdd this to the top of your file:\n');
console.log(`// Ensure ApiClient is available
if (typeof ApiClient === 'undefined') {
    console.error('ApiClient not loaded. Add /assets/js/api-client.js to page scripts');
}

// Initialize CSRF token on page load
document.addEventListener('DOMContentLoaded', function() {
    if (window.ApiClient) {
        ApiClient.initCSRF();
    }
});`);

console.log('\n✨ Migration script complete!\n');