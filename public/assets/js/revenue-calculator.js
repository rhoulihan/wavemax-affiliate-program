// Revenue Calculator for Affiliate Landing Page

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    let wdfRate = 1.25; // Default rate
    
    // Calculate earnings function
    function calculateEarnings() {
        try {
            const customers = parseFloat(document.getElementById('calc-customers').value) || 0;
            const weight = parseFloat(document.getElementById('calc-weight').value) || 0;
            const deliveryFee = parseFloat(document.getElementById('calc-delivery').value) || 0;
            
            console.log('Calculating with:', { customers, weight, deliveryFee, wdfRate });
            
            // Calculate weekly earnings
            const weeklyWdfRevenue = customers * weight * wdfRate;
            const weeklyWdfCommission = weeklyWdfRevenue * 0.10; // 10% commission
            const weeklyDeliveryEarnings = customers * deliveryFee;
            const weeklyTotal = weeklyWdfCommission + weeklyDeliveryEarnings;
            
            // Calculate monthly earnings (4 weeks)
            const monthlyTotal = weeklyTotal * 4;
            
            console.log('Results:', { weeklyTotal, monthlyTotal, weeklyWdfCommission, weeklyDeliveryEarnings });
            
            // Update display
            const weeklyEarningsEl = document.getElementById('weekly-earnings');
            const monthlyEarningsEl = document.getElementById('monthly-earnings');
            const wdfCommissionEl = document.getElementById('wdf-commission');
            const deliveryEarningsEl = document.getElementById('delivery-earnings');
            
            if (weeklyEarningsEl) weeklyEarningsEl.textContent = weeklyTotal.toFixed(2);
            if (monthlyEarningsEl) monthlyEarningsEl.textContent = monthlyTotal.toFixed(2);
            if (wdfCommissionEl) wdfCommissionEl.textContent = weeklyWdfCommission.toFixed(2);
            if (deliveryEarningsEl) deliveryEarningsEl.textContent = weeklyDeliveryEarnings.toFixed(2);
        } catch (error) {
            console.error('Error in calculateEarnings:', error);
        }
    }
    
    // Check if elements exist
    const calcCustomers = document.getElementById('calc-customers');
    const calcWeight = document.getElementById('calc-weight');
    const calcDelivery = document.getElementById('calc-delivery');
    
    if (!calcCustomers || !calcWeight || !calcDelivery) {
        console.error('Calculator input elements not found');
        return;
    }
    
    // Add event listeners
    calcCustomers.addEventListener('input', calculateEarnings);
    calcWeight.addEventListener('input', calculateEarnings);
    calcDelivery.addEventListener('input', calculateEarnings);
    
    // Run initial calculation with default values
    console.log('Running initial calculation...');
    calculateEarnings();
    
    // Fetch WDF rate from API and recalculate if needed
    try {
        // Use relative URL when embedded
        const baseUrl = window.location.origin.includes('wavemax.promo') 
            ? 'https://wavemax.promo' 
            : window.location.origin;
            
        const response = await fetch(`${baseUrl}/api/v1/system/config/public`);
        if (response.ok) {
            const configs = await response.json();
            const wdfConfig = configs.find(c => c.key === 'wdf_base_rate_per_pound');
            if (wdfConfig && wdfConfig.currentValue !== wdfRate) {
                wdfRate = wdfConfig.currentValue;
                const wdfRateDisplay = document.getElementById('wdf-rate-display');
                if (wdfRateDisplay) {
                    wdfRateDisplay.textContent = wdfRate.toFixed(2);
                }
                // Recalculate with the fetched rate
                console.log('Recalculating with new WDF rate:', wdfRate);
                calculateEarnings();
            }
        }
    } catch (error) {
        console.error('Error fetching WDF rate:', error);
    }
});