// Debug from IFRAME console - Run this in the iframe console

console.log('=== IFRAME SIDE DEBUG ===');

// 1. Check current location
console.log('1. Current iframe URL:', window.location.href);
console.log('   Current route:', window.location.search);

// 2. Check if we have viewport info
console.log('2. Looking for viewport info...');
if (typeof viewportInfo !== 'undefined') {
  console.log('   Viewport info:', viewportInfo);
} else {
  console.log('   No viewportInfo variable found');
}

// 3. Test sending hide-chrome message
console.log('3. Sending hide-chrome message to parent...');
window.parent.postMessage({
  type: 'hide-chrome',
  data: {}
}, '*');
console.log('   Message sent');

// 4. Test sending viewport-info request
console.log('4. Requesting viewport info from parent...');
window.parent.postMessage({
  type: 'request-viewport-info',
  data: {}
}, '*');

// 5. Listen for messages from parent
console.log('5. Setting up message listener...');
window.addEventListener('message', function(e) {
  console.log('[IFRAME RECEIVED MESSAGE]', {
    origin: e.origin,
    type: e.data?.type,
    data: e.data
  });
});

console.log('=== END IFRAME DEBUG ===');