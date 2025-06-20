// Mobile Diagnostic Script for WaveMAX Site
// Run this in the browser console on https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program

console.log('=== WaveMAX Mobile Diagnostic ===');
console.log('Window width:', window.innerWidth);
console.log('Is mobile (< 768px):', window.innerWidth < 768);

// 1. Check if bridge is loaded
console.log('\n1. Bridge Status:');
console.log('WaveMaxBridge exists:', typeof window.WaveMaxBridge !== 'undefined');
if (window.WaveMaxBridge) {
  console.log('Bridge state:', window.WaveMaxBridge.getViewportInfo());
}

// 2. Find the iframe
console.log('\n2. Iframe Detection:');
const iframes = document.querySelectorAll('iframe');
console.log('Total iframes found:', iframes.length);
iframes.forEach((iframe, index) => {
  console.log(`Iframe ${index}:`, {
    src: iframe.src,
    id: iframe.id,
    class: iframe.className,
    width: iframe.width,
    height: iframe.height
  });
});

// 3. Find ALL potential header elements
console.log('\n3. Header Elements:');
const headerCandidates = [
  // By tag
  ...Array.from(document.querySelectorAll('header')),
  ...Array.from(document.querySelectorAll('nav')),
  // By ID
  ...Array.from(document.querySelectorAll('[id*="header"]')),
  ...Array.from(document.querySelectorAll('[id*="nav"]')),
  ...Array.from(document.querySelectorAll('[id*="menu"]')),
  // By class
  ...Array.from(document.querySelectorAll('[class*="header"]')),
  ...Array.from(document.querySelectorAll('[class*="nav"]')),
  ...Array.from(document.querySelectorAll('[class*="menu"]')),
  ...Array.from(document.querySelectorAll('[class*="top"]'))
];

// Remove duplicates and filter
const uniqueHeaders = [...new Set(headerCandidates)].filter(el => {
  const rect = el.getBoundingClientRect();
  // Must be visible and at top of page
  return rect.height > 20 && rect.top < 200 && rect.width > 100;
});

console.log('Potential headers found:', uniqueHeaders.length);
uniqueHeaders.forEach((el, index) => {
  console.log(`Header candidate ${index}:`, {
    tag: el.tagName,
    id: el.id,
    classes: el.className,
    position: el.getBoundingClientRect(),
    selector: el.id ? `#${el.id}` : `.${el.className.split(' ')[0]}`
  });
});

// 4. Find ALL potential footer elements
console.log('\n4. Footer Elements:');
const footerCandidates = [
  // By tag
  ...Array.from(document.querySelectorAll('footer')),
  // By ID
  ...Array.from(document.querySelectorAll('[id*="footer"]')),
  // By class
  ...Array.from(document.querySelectorAll('[class*="footer"]')),
  ...Array.from(document.querySelectorAll('[class*="bottom"]'))
];

// Remove duplicates and filter
const uniqueFooters = [...new Set(footerCandidates)].filter(el => {
  const rect = el.getBoundingClientRect();
  // Must be visible and near bottom
  return rect.height > 20 && rect.width > 100;
});

console.log('Potential footers found:', uniqueFooters.length);
uniqueFooters.forEach((el, index) => {
  console.log(`Footer candidate ${index}:`, {
    tag: el.tagName,
    id: el.id,
    classes: el.className,
    position: el.getBoundingClientRect(),
    selector: el.id ? `#${el.id}` : `.${el.className.split(' ')[0]}`
  });
});

// 5. Test message flow
console.log('\n5. Testing Message Flow:');
window.addEventListener('message', function(e) {
  console.log('Message received:', {
    origin: e.origin,
    type: e.data?.type,
    data: e.data
  });
});

// 6. Try to manually hide elements (if mobile)
if (window.innerWidth < 768) {
  console.log('\n6. Attempting Manual Hide:');

  // Try the most likely header
  const likelyHeader = uniqueHeaders[0];
  if (likelyHeader) {
    console.log('Hiding header:', likelyHeader);
    likelyHeader.style.transition = 'transform 0.3s ease-in-out';
    likelyHeader.style.transform = 'translateY(-100%)';
    likelyHeader.setAttribute('data-mobile-hidden', 'true');
  }

  // Try the most likely footer
  const likelyFooter = uniqueFooters[0];
  if (likelyFooter) {
    console.log('Hiding footer:', likelyFooter);
    likelyFooter.style.transition = 'transform 0.3s ease-in-out';
    likelyFooter.style.transform = 'translateY(100%)';
    likelyFooter.setAttribute('data-mobile-hidden', 'true');
  }
}

// 7. Generate updated script selectors
console.log('\n7. Recommended Script Update:');
if (uniqueHeaders.length > 0) {
  const headerSelectors = uniqueHeaders.map(el =>
    el.id ? `#${el.id}` : `.${el.className.split(' ')[0]}`
  ).filter(Boolean).join(', ');
  console.log('Header selectors:', headerSelectors);
}

if (uniqueFooters.length > 0) {
  const footerSelectors = uniqueFooters.map(el =>
    el.id ? `#${el.id}` : `.${el.className.split(' ')[0]}`
  ).filter(Boolean).join(', ');
  console.log('Footer selectors:', footerSelectors);
}

console.log('\n=== End Diagnostic ===');