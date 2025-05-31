#!/bin/bash

# Script to update test passwords to use strong passwords

# Update auth tests
sed -i "s/password: 'password123'/password: getStrongPassword('affiliate', 1)/g" tests/integration/auth.test.js
sed -i "s/password: 'wrongpassword'/password: 'WrongPassword123!@#'/g" tests/integration/auth.test.js  
sed -i "s/password: 'customerpass'/password: getStrongPassword('customer', 1)/g" tests/integration/auth.test.js
sed -i "s/password: 'Admin123!'/password: getStrongPassword('admin', 1)/g" tests/integration/auth.test.js
sed -i "s/password: 'Operator123!'/password: getStrongPassword('operator', 1)/g" tests/integration/auth.test.js

# Update customer tests
sed -i "s/password: 'password123'/password: getStrongPassword('customer', 1)/g" tests/integration/customer.test.js

# Update administrator tests  
sed -i "s/password: 'admin123'/password: getStrongPassword('admin', 1)/g" tests/integration/administrator.test.js

# Update operator tests
sed -i "s/password: 'operator123'/password: getStrongPassword('operator', 1)/g" tests/integration/operator.test.js

echo "Test passwords updated successfully!"