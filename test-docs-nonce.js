// Test script to verify CSP nonce injection in documentation files

const axios = require('axios');
const cheerio = require('cheerio');

async function testDocsNonce() {
  try {
    // Make sure the server is running and docs are enabled
    const response = await axios.get('http://localhost:3000/docs/index.html');
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Check if nonce attributes are present
    const styleWithNonce = $('style[nonce]').length;
    const scriptWithNonce = $('script[nonce]').length;
    
    console.log('Testing documentation nonce injection:');
    console.log(`- Found ${styleWithNonce} <style> tags with nonce attribute`);
    console.log(`- Found ${scriptWithNonce} <script> tags with nonce attribute`);
    
    // Check CSP header
    const cspHeader = response.headers['content-security-policy'];
    console.log('\nCSP Header:', cspHeader);
    
    // Check if nonce is in CSP
    const hasNonceInCSP = cspHeader && cspHeader.includes("'nonce-");
    console.log(`\nCSP includes nonce directive: ${hasNonceInCSP}`);
    
    // Extract nonce value from first style tag
    const firstStyleNonce = $('style[nonce]').first().attr('nonce');
    if (firstStyleNonce) {
      console.log(`\nNonce value found: ${firstStyleNonce}`);
      
      // Check if this nonce is in the CSP header
      const nonceInCSP = cspHeader.includes(`'nonce-${firstStyleNonce}'`);
      console.log(`Nonce matches CSP: ${nonceInCSP}`);
    }
    
  } catch (error) {
    console.error('Error testing docs:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Check if required modules are installed
try {
  require('axios');
  require('cheerio');
  testDocsNonce();
} catch (error) {
  console.log('Please install required modules: npm install axios cheerio');
}