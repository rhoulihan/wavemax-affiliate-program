const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, '../server/controllers/administratorController.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the audit log calls
// Pattern 1: logAuditEvent('something', { ... })
content = content.replace(/logAuditEvent\('([^']+)',\s*{/g, (match, eventName) => {
  return `logAuditEvent(AuditEvents.DATA_MODIFICATION, {\n      action: '${eventName}',`;
});

// Pattern 2: logAuditEvent(AuditEvents.DATA_MODIFICATION, { action: 'something', { ... })
// This is a broken pattern that needs fixing
content = content.replace(/logAuditEvent\(AuditEvents\.DATA_MODIFICATION,\s*{\s*action:\s*'([^']+)',\s*{/g, (match, action) => {
  return `logAuditEvent(AuditEvents.DATA_MODIFICATION, {\n      action: '${action}',`;
});

// Pattern 3: logAuditEvent({ ... }) without event type
content = content.replace(/logAuditEvent\({/g, 'logAuditEvent(AuditEvents.DATA_MODIFICATION, {');

// Write the fixed content back
fs.writeFileSync(filePath, content);

console.log('Fixed audit log calls in administratorController.js');