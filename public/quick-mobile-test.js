// Quick Mobile Test - Paste this in console on mobile

// Find all visible elements at top and bottom of page
const topElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < 150 && rect.height > 30 && rect.width > 200;
});

const bottomElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const rect = el.getBoundingClientRect();
    const viewHeight = window.innerHeight;
    return rect.bottom > viewHeight - 200 && rect.height > 30 && rect.width > 200;
});

console.log('Top elements:', topElements.length);
console.log('Bottom elements:', bottomElements.length);

// Show first few
console.log('\nLikely header:');
topElements.slice(0, 3).forEach(el => {
    console.log({
        tag: el.tagName,
        id: el.id,
        class: el.className,
        text: el.innerText?.substring(0, 50)
    });
});

console.log('\nLikely footer:');
bottomElements.slice(0, 3).forEach(el => {
    console.log({
        tag: el.tagName,
        id: el.id,
        class: el.className,
        text: el.innerText?.substring(0, 50)
    });
});

// Try to hide them
if (window.innerWidth < 768) {
    console.log('\nHiding elements...');
    
    // Hide top element
    if (topElements[0]) {
        topElements[0].style.display = 'none';
        console.log('Hidden:', topElements[0].tagName, topElements[0].className);
    }
    
    // Hide bottom element
    if (bottomElements[0]) {
        bottomElements[0].style.display = 'none';
        console.log('Hidden:', bottomElements[0].tagName, bottomElements[0].className);
    }
}