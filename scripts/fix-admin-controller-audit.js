const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, '../server/controllers/administratorController.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of await auditLogger.log({ ... }) with logAuditEvent(AuditEvents.DATA_MODIFICATION, { ... }, req);
content = content.replace(/await auditLogger\.log\(\{/g, 'logAuditEvent(AuditEvents.DATA_MODIFICATION, {');

// Remove await from any logAuditEvent calls
content = content.replace(/await logAuditEvent\(/g, 'logAuditEvent(');

// Add req parameter to all logAuditEvent calls that don't have it
// Find lines ending with });
content = content.replace(/logAuditEvent\(AuditEvents\.DATA_MODIFICATION, \{([^}]+)\}\);/g, (match, inner) => {
  // Check if it already has req parameter
  if (match.includes(', req);')) {
    return match;
  }
  return `logAuditEvent(AuditEvents.DATA_MODIFICATION, {${inner}}, req);`;
});

// Write the fixed content back
fs.writeFileSync(filePath, content);

console.log('Fixed audit log calls in administratorController.js');