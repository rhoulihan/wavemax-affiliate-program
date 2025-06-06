// Inline Mobile Diagnostic - Paste this at the END of your page, before </body>
<script>
window.addEventListener('load', function() {
    // Only run on mobile
    if (window.innerWidth >= 768) return;
    
    setTimeout(function() {
        var results = [];
        
        // Basic info
        results.push('Width: ' + window.innerWidth);
        results.push('Bridge: ' + (window.WaveMaxBridge ? 'YES' : 'NO'));
        
        // Find iframe
        var iframe = document.querySelector('iframe');
        results.push('Iframe: ' + (iframe ? iframe.src.substring(0, 50) + '...' : 'NOT FOUND'));
        
        // Find header
        var headerFound = false;
        var headerSelectors = ['header', '.header', '#header', '.navbar', 'nav'];
        for (var i = 0; i < headerSelectors.length; i++) {
            var h = document.querySelector(headerSelectors[i]);
            if (h && h.offsetHeight > 20) {
                results.push('Header: ' + headerSelectors[i] + ' (#' + h.id + ')');
                headerFound = true;
                break;
            }
        }
        if (!headerFound) results.push('Header: NOT FOUND');
        
        // Find footer
        var footerFound = false;
        var footerSelectors = ['footer', '.footer', '#footer'];
        for (var i = 0; i < footerSelectors.length; i++) {
            var f = document.querySelector(footerSelectors[i]);
            if (f && f.offsetHeight > 20) {
                results.push('Footer: ' + footerSelectors[i] + ' (#' + f.id + ')');
                footerFound = true;
                break;
            }
        }
        if (!footerFound) results.push('Footer: NOT FOUND');
        
        // Try hide
        if (window.WaveMaxBridge) {
            results.push('Trying hide...');
            window.WaveMaxBridge.hideChrome();
        }
        
        alert('Mobile Diagnostic:\n\n' + results.join('\n'));
    }, 3000);
});
</script>