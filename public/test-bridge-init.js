// Test script to manually initialize the bridge
// Run this in the parent page console to test

console.log('=== TESTING BRIDGE INITIALIZATION ===');

// Check if the script exists
console.log('1. Checking for iframe...');
const iframe = document.getElementById('wavemax-iframe');
console.log('   Iframe found?', !!iframe);
if (iframe) {
  console.log('   Iframe src:', iframe.src);
  console.log('   Iframe id:', iframe.id);
}

// Check if DOM is ready
console.log('2. DOM ready state:', document.readyState);

// Try to manually run the init
console.log('3. Attempting manual initialization...');

// Configuration
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const ALLOWED_ORIGINS = [
  'https://affiliate.wavemax.promo',
  'http://affiliate.wavemax.promo',
  'https://wavemax.promo',
  'http://wavemax.promo',
  'http://localhost:3000'
];

// State
let isMobile = window.innerWidth < MOBILE_BREAKPOINT;
let isTablet = window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT;

console.log('4. Viewport detection:');
console.log('   Width:', window.innerWidth);
console.log('   Is mobile?', isMobile);
console.log('   Is tablet?', isTablet);

// Test message sending
console.log('5. Testing message send to iframe...');
if (iframe && iframe.contentWindow) {
  try {
    const testMessage = {
      type: 'viewport-info',
      data: {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: isMobile,
        isTablet: isTablet,
        isDesktop: !isMobile && !isTablet
      }
    };
    iframe.contentWindow.postMessage(testMessage, '*');
    console.log('   Message sent successfully:', testMessage);
  } catch (e) {
    console.error('   Failed to send message:', e);
  }
} else {
  console.log('   Cannot send - no iframe or contentWindow');
}

// Check for existing scripts
console.log('6. Checking for duplicate scripts...');
const scripts = document.querySelectorAll('script');
let bridgeScriptCount = 0;
scripts.forEach(script => {
  if (script.textContent && script.textContent.includes('Parent-Iframe Communication Bridge')) {
    bridgeScriptCount++;
    console.log('   Found bridge script at:', script);
  }
});
console.log('   Total bridge scripts found:', bridgeScriptCount);

console.log('=== END TEST ===');