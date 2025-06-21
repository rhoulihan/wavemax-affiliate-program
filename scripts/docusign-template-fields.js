#!/usr/bin/env node

// DocuSign W9 Template Field Reference
console.log(`
DocuSign W9 Template Field Configuration Guide
=============================================

The SSN/EIN fields in DocuSign W9 templates require special handling:

1. COMMON FIELD TYPES IN W9 TEMPLATES:
   
   Text Fields (populated by our code):
   - "Owner's First Name" / "First Name"
   - "Owner's Last Name" / "Last Name"
   - "Business name" / "Business Name" / "DBA"
   - "Street Address" / "Address Line 1"
   - "City"
   - "State 1" / "State"
   - "5-Digit Zip Code" / "Zip"

   Checkbox Fields (user must select):
   - "Individual" - Check if using SSN
   - "Business" - Check if using EIN
   - Other entity type checkboxes

   SSN/EIN Fields (user must fill):
   - SSN fields: Usually 3 separate fields or 1 SSN field
   - EIN fields: Usually 1 field for the full EIN

2. WHY SSN/EIN FIELDS AREN'T ACCEPTING INPUT:

   a) Security: DocuSign templates often have SSN/EIN fields configured as:
      - "Secure fields" that cannot be pre-populated
      - Fields that require manual entry by the signer
      - Fields with validation rules

   b) Field Types: The template might be using:
      - ssnTabs (special SSN field type)
      - Custom validation fields
      - Conditional fields based on entity type selection

3. RECOMMENDED APPROACH:

   - Do NOT attempt to pre-fill SSN/EIN data
   - Let the signer enter this information directly
   - The signer should:
     1. Select their entity type (Individual/Business)
     2. Enter their SSN or EIN accordingly
     3. Complete other required fields

4. TEMPLATE CONFIGURATION IN DOCUSIGN:

   To fix input issues, check in DocuSign template:
   - Field properties: Ensure SSN/EIN fields are not locked
   - Validation rules: Check if validation is preventing input
   - Conditional logic: Ensure fields show based on entity type
   - Field types: Use appropriate field types (SSN vs Text)

5. COMMON W9 TEMPLATE FIELD LABELS:

   Entity Type Checkboxes:
   - "Individual/Sole proprietor"
   - "C Corporation"
   - "S Corporation"
   - "Partnership"
   - "Trust/estate"
   - "Limited liability company"
   - "Other"

   Tax ID Fields:
   - "SSN" or "Social Security Number"
   - "EIN" or "Employer Identification Number"
   - "Tax ID" or "Federal Tax ID"

If the template still doesn't accept input, the issue is likely in the 
DocuSign template configuration itself, not the API integration.
`);

// Show current field mapping
console.log('\nCurrent fields being populated by the system:');
console.log('- Owner\'s First Name');
console.log('- Owner\'s Last Name');
console.log('- Street Address');
console.log('- City');
console.log('- State 1');
console.log('- 5-Digit Zip Code');
console.log('- Business name (if applicable)');
console.log('\nSSN/EIN fields are left for manual entry by the signer.');