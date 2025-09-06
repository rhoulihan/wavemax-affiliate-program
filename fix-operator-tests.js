const fs = require('fs');

// Read the test file
let content = fs.readFileSync('/var/www/wavemax/wavemax-affiliate-program/tests/unit/operatorController.test.js', 'utf8');

// Fix claimOrder success response
content = content.replace(
  /expect\(res\.json\)\.toHaveBeenCalledWith\(\{\s+message: 'Order claimed successfully',\s+order: expect\.any\(Object\)\s+\}\)/g,
  `expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order claimed successfully',
        order: expect.any(Object)
      })`
);

// Fix error responses from ControllerHelpers.sendError
content = content.replace(
  /expect\(res\.json\)\.toHaveBeenCalledWith\(\{\s+error: 'Order already assigned'\s+\}\)/g,
  `expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order already assigned'
      })`
);

content = content.replace(
  /expect\(res\.json\)\.toHaveBeenCalledWith\(\{\s+error: 'Maximum concurrent orders reached'\s+\}\)/g,
  `expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Maximum concurrent orders reached'
      })`
);

// Fix getMyOrders response format
content = content.replace(
  /expect\(res\.json\)\.toHaveBeenCalledWith\(\{\s+orders: mockOrders,\s+pagination: expect\.any\(Object\)\s+\}\)/g,
  `expect(res.json).toHaveBeenCalledWith({
        orders: mockOrders,
        pagination: expect.any(Object)
      })`
);

// Fix getTodayStats response
content = content.replace(
  /expect\(res\.json\)\.toHaveBeenCalledWith\(\{\s+ordersProcessed: (\d+),\s+bagsScanned: (\d+),\s+ordersReady: (\d+)\s+\}\)/g,
  `expect(res.json).toHaveBeenCalledWith({
        ordersProcessed: $1,
        bagsScanned: $2,
        ordersReady: $3
      })`
);

// Write back
fs.writeFileSync('/var/www/wavemax/wavemax-affiliate-program/tests/unit/operatorController.test.js', content);
console.log('Fixed operator controller tests');