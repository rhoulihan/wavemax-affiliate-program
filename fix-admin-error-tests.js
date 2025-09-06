const fs = require('fs');

let content = fs.readFileSync('/var/www/wavemax/wavemax-affiliate-program/tests/unit/administratorController.test.js', 'utf8');

// Replace all instances of expect(next).toHaveBeenCalledWith(expect.any(Error))
// with checking for 500 status code
content = content.replace(
  /expect\(next\)\.toHaveBeenCalledWith\(expect\.any\(Error\)\);/g,
  `expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.any(String)
      }));`
);

fs.writeFileSync('/var/www/wavemax/wavemax-affiliate-program/tests/unit/administratorController.test.js', content);

console.log('Fixed all error handling tests in administratorController.test.js');