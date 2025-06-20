// Debug Mobile Hiding - Run this in the PARENT page console

console.log('=== MOBILE HIDING DEBUG ===');

// 1. Check if WaveMaxBridge exists
console.log('1. WaveMaxBridge exists?', typeof window.WaveMaxBridge !== 'undefined');
if (window.WaveMaxBridge) {
  console.log('   Bridge API:', Object.keys(window.WaveMaxBridge));
  console.log('   Current state:', window.WaveMaxBridge.getViewportInfo());
}

// 2. Check viewport
console.log('2. Viewport width:', window.innerWidth);
console.log('   Is mobile (<768)?', window.innerWidth < 768);
console.log('   Is tablet (768-1024)?', window.innerWidth >= 768 && window.innerWidth < 1024);

// 3. Check iframe
const iframe = document.getElementById('wavemax-iframe');
console.log('3. Iframe found?', !!iframe);
if (iframe) {
  console.log('   Iframe src:', iframe.src);
  console.log('   Iframe ID:', iframe.id);
}

// 4. Check elements to hide
const elements = {
  '.topbar': document.querySelector('.topbar'),
  '.wrapper': document.querySelector('.wrapper'),
  '.navbar': document.querySelector('.navbar'),
  '.page-header': document.querySelector('.page-header'),
  '.footer': document.querySelector('.footer')
};
console.log('4. Elements found:');
Object.entries(elements).forEach(([selector, el]) => {
  console.log(`   ${selector}:`, !!el, el ? `(${el.className})` : '');
});

// 5. Test manual hide
console.log('5. Testing manual hide...');
if (window.WaveMaxBridge) {
  console.log('   Calling WaveMaxBridge.hideChrome()');
  window.WaveMaxBridge.hideChrome();
  console.log('   Check if elements are hidden now');
} else {
  console.log('   ERROR: WaveMaxBridge not found!');
}

// 6. Test sending viewport info
console.log('6. Testing viewport info send...');
if (window.WaveMaxBridge) {
  window.WaveMaxBridge.sendViewportInfo();
  console.log('   Viewport info sent');
}

// 7. Listen for messages
console.log('7. Setting up message listener...');
window.addEventListener('message', function(e) {
  console.log('[MESSAGE RECEIVED]', {
    origin: e.origin,
    type: e.data?.type,
    data: e.data
  });
});

console.log('=== END DEBUG ===');
console.log('Now try navigating in the iframe and watch for messages');