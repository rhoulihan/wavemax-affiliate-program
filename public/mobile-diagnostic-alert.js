// Mobile Diagnostic with Alerts - For when console access isn't available
(function() {
    let diagnosticResults = [];
    
    function log(message) {
        diagnosticResults.push(message);
    }
    
    function runDiagnostics() {
        log('=== WaveMAX Mobile Diagnostic ===');
        log('Window width: ' + window.innerWidth);
        log('Is mobile: ' + (window.innerWidth < 768 ? 'YES' : 'NO'));
        
        // 1. Check if bridge is loaded
        log('\n--- Bridge Status ---');
        const bridgeExists = typeof window.WaveMaxBridge !== 'undefined';
        log('Bridge loaded: ' + (bridgeExists ? 'YES' : 'NO'));
        
        if (bridgeExists) {
            const info = window.WaveMaxBridge.getViewportInfo();
            log('isMobile: ' + info.isMobile);
            log('chromeHidden: ' + info.chromeHidden);
        }
        
        // 2. Find iframe
        log('\n--- Iframe Detection ---');
        const iframes = document.querySelectorAll('iframe');
        log('Iframes found: ' + iframes.length);
        
        if (iframes.length > 0) {
            iframes.forEach((iframe, i) => {
                log('Iframe ' + i + ': ' + (iframe.src || 'no src'));
            });
        }
        
        // 3. Find header elements
        log('\n--- Header Search ---');
        const headerSelectors = [
            'header', '.header', '#header', '.navbar',
            '.site-header', '.main-header', '.top-header',
            'nav', '.navigation', '.nav-wrapper'
        ];
        
        let headerFound = null;
        for (let selector of headerSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.height > 20 && rect.top < 200) {
                    headerFound = selector;
                    log('Header found: ' + selector);
                    log('Header ID: ' + (el.id || 'none'));
                    log('Header classes: ' + (el.className || 'none'));
                    break;
                }
            }
        }
        
        if (!headerFound) {
            log('No header found with standard selectors');
        }
        
        // 4. Find footer elements
        log('\n--- Footer Search ---');
        const footerSelectors = [
            'footer', '.footer', '#footer',
            '.site-footer', '.main-footer', '.bottom-footer'
        ];
        
        let footerFound = null;
        for (let selector of footerSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.height > 20) {
                    footerFound = selector;
                    log('Footer found: ' + selector);
                    log('Footer ID: ' + (el.id || 'none'));
                    log('Footer classes: ' + (el.className || 'none'));
                    break;
                }
            }
        }
        
        if (!footerFound) {
            log('No footer found with standard selectors');
        }
        
        // 5. Test hiding (if mobile)
        if (window.innerWidth < 768 && window.WaveMaxBridge) {
            log('\n--- Testing Hide Chrome ---');
            log('Calling WaveMaxBridge.hideChrome()...');
            try {
                window.WaveMaxBridge.hideChrome();
                log('Hide command sent');
            } catch (e) {
                log('Error: ' + e.message);
            }
        }
        
        // Show results in alert
        showResults();
    }
    
    function showResults() {
        // Split into smaller chunks for mobile alerts
        const chunks = [];
        let currentChunk = '';
        
        diagnosticResults.forEach(line => {
            if (currentChunk.length + line.length > 300) {
                chunks.push(currentChunk);
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
            }
        });
        
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        // Show alerts
        alert('Mobile Diagnostic Results (' + chunks.length + ' parts)\n\nTap OK to see each part.');
        
        chunks.forEach((chunk, index) => {
            alert('Part ' + (index + 1) + ' of ' + chunks.length + ':\n\n' + chunk);
        });
        
        // Final summary
        let summary = 'SUMMARY:\n';
        summary += 'Mobile: ' + (window.innerWidth < 768 ? 'YES' : 'NO') + '\n';
        summary += 'Bridge: ' + (typeof window.WaveMaxBridge !== 'undefined' ? 'LOADED' : 'NOT LOADED') + '\n';
        summary += 'Iframe: ' + (document.querySelector('iframe') ? 'FOUND' : 'NOT FOUND') + '\n';
        
        alert(summary);
    }
    
    // Run diagnostics after a short delay
    setTimeout(runDiagnostics, 2000);
})();