(function() {
  'use strict';

  // Translation helper
  function t(key, fallback) {
    return window.i18n && window.i18n.t ? window.i18n.t(key) : fallback;
  }


  // Load CSRF utilities
  if (!window.CsrfUtils) {
    console.error('CSRF utilities not loaded. Please include csrf-utils.js before this script.');
    return;
  }

  // Configuration
  const config = window.EMBED_CONFIG || {
    baseUrl: 'https://wavemax.promo'
  };
  const BASE_URL = config.baseUrl;

  // Authentication check
  const token = localStorage.getItem('adminToken');
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
  const requirePasswordChange = localStorage.getItem('requirePasswordChange');

  // Update session activity if authenticated
  if (token && window.SessionManager) {
    window.SessionManager.updateActivity('administrator');
  }

  // Redirect to login if no token or if password change is still required
  if (!token || requirePasswordChange === 'true') {
    // Clear everything and redirect to login
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('requirePasswordChange');
    
    // Use embed navigation if available
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'navigate',
        data: { page: '/administrator-login' }
      }, '*');
    } else {
      window.location.href = '/embed-app.html?route=/administrator-login';
    }
    return;
  }

  // Update user info
  const userName = `${adminData.firstName} ${adminData.lastName}`;
  const userNameElement = document.getElementById('userName');
  if (userNameElement) {
    userNameElement.textContent = userName;
  }

  // Logout functionality
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm(t('administrator.dashboard.confirmLogout', 'Are you sure you want to logout?'))) {
        try {
          // Call logout endpoint
          await adminFetch('/api/v1/auth/logout', { method: 'POST' });
        } catch (error) {
          console.error('Logout error:', error);
        }

        // Clear local storage
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminRefreshToken');
        localStorage.removeItem('adminData');
        localStorage.removeItem('requirePasswordChange');
        localStorage.removeItem('adminCurrentTab');

        // Clear session manager data
        if (window.SessionManager) {
          window.SessionManager.clearAuth('administrator');
        }

        // Use embed navigation
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'navigate',
            data: { page: '/administrator-login' }
          }, '*');
        } else {
          window.location.href = '/embed-app.html?route=/administrator-login';
        }
      }
    });
  }

  // Tab navigation
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Function to switch to a specific tab
  function switchToTab(targetTab, updateHistory = true) {
    // Find the tab element
    const tabElement = Array.from(tabs).find(t => t.dataset.tab === targetTab);
    if (!tabElement) return;

    // Update active states
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(tc => tc.classList.remove('active'));

    tabElement.classList.add('active');
    const contentElement = document.getElementById(`${targetTab}-tab`);
    if (contentElement) {
      contentElement.classList.add('active');
    }

    // Save current tab to localStorage
    localStorage.setItem('adminCurrentTab', targetTab);

    // Update URL with tab parameter for browser history (only if not from popstate)
    if (updateHistory && window.updateTabInUrl) {
      window.updateTabInUrl(targetTab);
    }

    // Always load tab data
    console.log('[Admin Dashboard] Loading data for tab:', targetTab);
    loadTabData(targetTab);
  }

  // Add click handlers to tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      switchToTab(targetTab);
    });
  });

  // Check URL for tab parameter first, then localStorage, then default
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get('tab');
  const savedTab = urlTab || localStorage.getItem('adminCurrentTab') || 'dashboard';
  switchToTab(savedTab);

  // Listen for tab restore messages from browser navigation
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'restore-tab' && event.data.tab) {
      console.log('[Admin Dashboard] Restoring tab from browser navigation:', event.data.tab);
      // Don't update history when restoring from popstate
      switchToTab(event.data.tab, false);
    }
  });

  // Create authenticated fetch with CSRF support
  const authenticatedFetch = window.CsrfUtils.createAuthenticatedFetch(() => token);

  // Wrapper to handle 401 responses
  async function adminFetch(url, options = {}) {
    // Add base URL and ensure headers
    const fullUrl = `${BASE_URL}${url}`;
    options.headers = options.headers || {};
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';

    const response = await authenticatedFetch(fullUrl, options);

    if (response.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminRefreshToken');
      localStorage.removeItem('adminData');
      window.location.href = '/administrator-login-embed.html';
      return;
    }

    return response;
  }

  // Clear loading states from all containers
  function clearLoadingStates() {
    const loadingContainers = ['dashboardStats', 'recentActivity', 'operatorsList', 'analyticsOverview', 'affiliatesList', 'systemConfigForm'];
    loadingContainers.forEach(id => {
      const element = document.getElementById(id);
      if (element && element.querySelector('.loading')) {
        // Only clear if it still has loading state
        const loadingDiv = element.querySelector('.loading');
        if (loadingDiv) {
          element.innerHTML = '';
        }
      }
    });
  }

  // Load tab data
  async function loadTabData(tab) {
    // Clear any remaining loading states
    clearLoadingStates();

    switch(tab) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'operators':
      await loadOperators();
      break;
    case 'customers':
      await loadCustomers();
      break;
    case 'analytics':
      await loadAnalytics();
      break;
    case 'affiliates':
      await loadAffiliates();
      break;
    case 'w9review':
      await loadW9Documents();
      break;
    case 'quickbooks':
      await loadQuickBooksTab();
      break;
    case 'auditlog':
      await loadAuditLog();
      break;
    case 'config':
      await loadSystemConfig();
      break;
    }
  }

  // Load dashboard
  async function loadDashboard() {
    try {
      const response = await adminFetch('/api/v1/administrators/dashboard');
      const data = await response.json();

      if (response.ok && data.success) {
        renderDashboardStats(data.dashboard);
        renderRecentActivity(data.dashboard.recentActivity || []);
      } else {
        console.error('Dashboard data not loaded:', data.message);
        document.getElementById('dashboardStats').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.dashboardLoadFailed', 'Failed to load dashboard data')}</p>`;
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      document.getElementById('dashboardStats').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.dashboardLoadFailed', 'Error loading dashboard')}</p>`;
    }
  }

  // Render dashboard stats
  function renderDashboardStats(data) {
    const dashboardElement = document.getElementById('dashboardStats');

    if (!data) {
      dashboardElement.innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('common.messages.noData', 'No dashboard data available')}</p>`;
      return;
    }

    const orderStats = data.orderStats || {};
    const systemHealth = data.systemHealth || {};
    const avgProcessingTime = Math.round(orderStats.averageProcessingTime || 0);
    const avgProcessingHours = Math.floor(avgProcessingTime / 60);
    const avgProcessingMins = Math.round(avgProcessingTime % 60);
    const processingTimeDisplay = avgProcessingHours > 0 ?
      `${avgProcessingHours}h ${avgProcessingMins}m` :
      `${avgProcessingMins}m`;

    const statsHtml = `
            <div class="stat-card">
                <h3>${t('administrator.dashboard.stats.activeOperators', 'Active Operators')}</h3>
                <div class="stat-value">${systemHealth.onShiftOperators || 0}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.total', 'Total')}: ${systemHealth.activeOperators || 0}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.stats.todaysOrders', 'Today\'s Orders')}</h3>
                <div class="stat-value">${orderStats.today || 0}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.thisWeek', 'This week')}: ${orderStats.thisWeek || 0}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.stats.processingTime', 'Avg Processing Time')}</h3>
                <div class="stat-value">${processingTimeDisplay}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.target', 'Target')}: 24h</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.stats.ordersInProgress', 'Orders in Progress')}</h3>
                <div class="stat-value">${systemHealth.ordersInProgress || 0}</div>
                <div class="stat-change ${systemHealth.processingDelays > 0 ? 'negative' : ''}">
                    ${t('administrator.dashboard.stats.delays', 'Delays (>24h)')}: ${systemHealth.processingDelays || 0}
                </div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.stats.completedOrders', 'Completed Orders')}</h3>
                <div class="stat-value">${systemHealth.completedOrders || 0}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.thisMonth', 'This month')}: ${orderStats.thisMonth || 0}</div>
            </div>
        `;
    dashboardElement.innerHTML = statsHtml;
  }

  // Render recent activity
  function renderRecentActivity(activities) {
    if (!activities || activities.length === 0) {
      document.getElementById('recentActivity').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.recentActivity.noActivity', 'No recent activity')}</p>`;
      return;
    }

    const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>${t('administrator.dashboard.recentActivity.time', 'Time')}</th>
                        <th>${t('administrator.dashboard.recentActivity.type', 'Type')}</th>
                        <th>${t('administrator.dashboard.recentActivity.user', 'User')}</th>
                        <th>${t('administrator.dashboard.recentActivity.action', 'Action')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${activities.map(activity => `
                        <tr>
                            <td>${new Date(activity.timestamp).toLocaleString()}</td>
                            <td>${activity.type}</td>
                            <td>${activity.userName}</td>
                            <td>${activity.action}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    document.getElementById('recentActivity').innerHTML = tableHtml;
  }

  // Load operators
  async function loadOperators() {
    try {
      const response = await adminFetch('/api/v1/administrators/operators');

      // Log the response for debugging
      console.log('Operators endpoint response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      const text = await response.text();
      console.log('Response body:', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        document.getElementById('operatorsList').innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">Error: Invalid response format</p>';
        return;
      }

      if (response.ok && data.success) {
        renderOperatorsList(data.operators);
      } else {
        console.error('Operators load failed:', data);
        const errorMsg = data.message || data.error || 'Failed to load operators';
        document.getElementById('operatorsList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.operatorsLoadFailed', errorMsg)}</p>`;
      }
    } catch (error) {
      console.error('Error loading operators:', error);
      document.getElementById('operatorsList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.operatorsLoadFailed', 'Error loading operators')}</p>`;
    }
  }

  // Render operators list
  function renderOperatorsList(operators) {
    if (!operators || operators.length === 0) {
      document.getElementById('operatorsList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.operators.noOperators', 'No operators found')}</p>`;
      return;
    }

    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;
    const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>${t('administrator.dashboard.operators.employeeId')}</th>
                        <th>${t('administrator.dashboard.operators.name')}</th>
                        <th>${t('administrator.dashboard.operators.email')}</th>
                        <th>${t('administrator.dashboard.operators.shift')}</th>
                        <th>${t('administrator.dashboard.operators.status')}</th>
                        <th>${t('administrator.dashboard.operators.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${operators.map(op => `
                        <tr>
                            <td>${op.operatorId}</td>
                            <td>${op.firstName} ${op.lastName}</td>
                            <td>${op.email}</td>
                            <td>${op.shiftStart} - ${op.shiftEnd}</td>
                            <td>
                                <span class="status-badge ${op.isActive ? 'active' : 'inactive'}">
                                    ${op.isActive ? t('administrator.dashboard.operators.active') : t('administrator.dashboard.operators.inactive')}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm edit-operator-btn" data-operator-id="${op._id}">${t('administrator.dashboard.operators.edit')}</button>
                                <button class="btn btn-sm btn-secondary reset-pin-btn" data-operator-id="${op._id}">${t('administrator.dashboard.operators.resetPin')}</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    document.getElementById('operatorsList').innerHTML = tableHtml;
  }

  // Load customers
  async function loadCustomers() {
    try {
      // Get filter values
      const search = document.getElementById('customerSearchInput')?.value || '';
      const affiliateFilter = document.getElementById('customerAffiliateFilter')?.value || 'all';
      const statusFilter = document.getElementById('customerStatusFilter')?.value || 'all';
      
      // Build query params
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (affiliateFilter !== 'all') params.append('affiliateId', affiliateFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await adminFetch(`/api/v1/customers/admin/list?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        renderCustomersList(data.customers);
        
        // Load affiliates for filter if not already loaded
        if (document.getElementById('customerAffiliateFilter').options.length === 1) {
          await loadAffiliatesForFilter();
        }
      } else {
        console.error('Customers load failed:', data);
        document.getElementById('customersList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.customersLoadFailed', 'Failed to load customers')}</p>`;
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      document.getElementById('customersList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.customersLoadFailed', 'Error loading customers')}</p>`;
    }
    
    // Setup event handlers for customers tab
    setupCustomersEventHandlers();
  }
  
  // Render customers list
  function renderCustomersList(customers) {
    if (!customers || customers.length === 0) {
      document.getElementById('customersList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.customers.noCustomers', 'No customers found')}</p>`;
      return;
    }
    
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">
              <input type="checkbox" id="selectAllCustomers">
            </th>
            <th>${t('administrator.dashboard.customers.name', 'Name')}</th>
            <th>${t('administrator.dashboard.customers.contact', 'Contact')}</th>
            <th>${t('administrator.dashboard.customers.address', 'Address')}</th>
            <th>${t('administrator.dashboard.customers.orders', 'Orders')}</th>
            <th>${t('administrator.dashboard.customers.status', 'Status')}</th>
            <th>${t('administrator.dashboard.customers.actions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(customer => {
            // Determine status based on order count
            const statusText = customer.orderCount === 0 ? 'NEW' : 'ACTIVE';
            const statusClass = customer.orderCount === 0 ? 'pending' : 'active';
            const statusBadge = `<span class="status-badge ${statusClass}">${t(`administrator.dashboard.customers.status${statusText}`, statusText)}</span>`;
            
            return `
              <tr>
                <td>
                  <input type="checkbox" class="customer-checkbox" data-customer-id="${customer._id}" 
                         data-customer-data='${JSON.stringify({
                           id: customer.customerId,
                           name: `${customer.firstName} ${customer.lastName}`,
                           address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
                           phone: customer.phone,
                           email: customer.email
                         }).replace(/'/g, '&apos;')}'>
                </td>
                <td>
                  <div>${customer.firstName} ${customer.lastName}</div>
                  ${customer.businessName ? `<div style="font-size: 0.875rem; color: #666;">${customer.businessName}</div>` : ''}
                  <div style="font-size: 0.875rem; color: #999;">${customer.customerId}</div>
                </td>
                <td>
                  <div>${customer.email}</div>
                  <div style="font-size: 0.875rem; color: #666;">${customer.phone}</div>
                </td>
                <td>
                  <div>${customer.address}</div>
                  <div style="font-size: 0.875rem; color: #666;">${customer.city}, ${customer.state} ${customer.zipCode}</div>
                </td>
                <td>
                  <div>${customer.orderCount || 0}</div>
                  <div style="font-size: 0.875rem; color: #666;">${t('administrator.dashboard.customers.joined', 'Joined')}: ${new Date(customer.createdAt).toLocaleDateString()}</div>
                </td>
                <td>${statusBadge}</td>
                <td>
                  <button class="btn btn-sm print-card-btn" data-customer-id="${customer._id}">${t('administrator.dashboard.customers.printCard', 'Print Card')}</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    
    document.getElementById('customersList').innerHTML = tableHtml;
    
    // Update selected count
    updateSelectedCustomersCount();
  }
  
  // Load affiliates for filter dropdown
  async function loadAffiliatesForFilter() {
    try {
      const response = await adminFetch('/api/v1/administrators/affiliates');
      const data = await response.json();
      
      if (response.ok && data.success) {
        const select = document.getElementById('customerAffiliateFilter');
        data.affiliates.forEach(affiliate => {
          const option = document.createElement('option');
          option.value = affiliate._id;
          option.textContent = `${affiliate.businessName} (${affiliate.affiliateId})`;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading affiliates for filter:', error);
    }
  }
  
  // Setup event handlers for customers tab
  function setupCustomersEventHandlers() {
    // Search input
    const searchInput = document.getElementById('customerSearchInput');
    if (searchInput && !searchInput.hasAttribute('data-initialized')) {
      searchInput.setAttribute('data-initialized', 'true');
      searchInput.addEventListener('input', debounce(() => {
        loadCustomers();
      }, 500));
    }
    
    // Apply filters button
    const applyFiltersBtn = document.getElementById('applyCustomerFiltersBtn');
    if (applyFiltersBtn && !applyFiltersBtn.hasAttribute('data-initialized')) {
      applyFiltersBtn.setAttribute('data-initialized', 'true');
      applyFiltersBtn.addEventListener('click', loadCustomers);
    }
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearCustomerFiltersBtn');
    if (clearFiltersBtn && !clearFiltersBtn.hasAttribute('data-initialized')) {
      clearFiltersBtn.setAttribute('data-initialized', 'true');
      clearFiltersBtn.addEventListener('click', () => {
        document.getElementById('customerSearchInput').value = '';
        document.getElementById('customerAffiliateFilter').value = 'all';
        document.getElementById('customerStatusFilter').value = 'all';
        loadCustomers();
      });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshCustomersBtn');
    if (refreshBtn && !refreshBtn.hasAttribute('data-initialized')) {
      refreshBtn.setAttribute('data-initialized', 'true');
      refreshBtn.addEventListener('click', loadCustomers);
    }
    
    // Print selected cards button
    const printSelectedBtn = document.getElementById('printSelectedCardsBtn');
    if (printSelectedBtn && !printSelectedBtn.hasAttribute('data-initialized')) {
      printSelectedBtn.setAttribute('data-initialized', 'true');
      printSelectedBtn.addEventListener('click', printSelectedCustomerCards);
    }
    
    // Select all checkbox
    setTimeout(() => {
      const selectAllCheckbox = document.getElementById('selectAllCustomers');
      if (selectAllCheckbox && !selectAllCheckbox.hasAttribute('data-initialized')) {
        selectAllCheckbox.setAttribute('data-initialized', 'true');
        selectAllCheckbox.addEventListener('change', function() {
          const checkboxes = document.querySelectorAll('.customer-checkbox');
          checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
          });
          updateSelectedCustomersCount();
        });
      }
      
      // Individual checkboxes
      document.querySelectorAll('.customer-checkbox').forEach(checkbox => {
        if (!checkbox.hasAttribute('data-initialized')) {
          checkbox.setAttribute('data-initialized', 'true');
          checkbox.addEventListener('change', updateSelectedCustomersCount);
        }
      });
    }, 100);
  }
  
  // Update selected customers count
  function updateSelectedCustomersCount() {
    const selectedCount = document.querySelectorAll('.customer-checkbox:checked').length;
    const printButton = document.getElementById('printSelectedCardsBtn');
    if (printButton) {
      if (selectedCount > 0) {
        printButton.style.display = 'block';
        printButton.textContent = t('administrator.dashboard.customers.printSelectedCount', `Print ${selectedCount} Selected Cards`).replace('${count}', selectedCount);
      } else {
        printButton.style.display = 'none';
      }
    }
  }
  
  // Print single customer card
  window.printCustomerCard = async function(customerId) {
    const checkbox = document.querySelector(`.customer-checkbox[data-customer-id="${customerId}"]`);
    if (checkbox) {
      const customerData = JSON.parse(checkbox.getAttribute('data-customer-data'));
      await generateAndPrintCards([customerData]);
    }
  };
  
  // Print selected customer cards
  async function printSelectedCustomerCards() {
    const selectedCheckboxes = document.querySelectorAll('.customer-checkbox:checked');
    const customers = [];
    
    selectedCheckboxes.forEach(checkbox => {
      const customerData = JSON.parse(checkbox.getAttribute('data-customer-data'));
      customers.push(customerData);
    });
    
    if (customers.length > 0) {
      await generateAndPrintCards(customers);
    }
  }
  
  // Generate and print customer cards
  async function generateAndPrintCards(customers) {
    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
      console.error('jsPDF library not loaded');
      alert('PDF generation library not loaded. Please refresh the page and try again.');
      return;
    }
    
    // Create new PDF with 4x6 inch dimensions
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: [4, 6]
    });
    
    let isFirstCard = true;
    
    for (const customer of customers) {
      // Add new page for each card except the first
      if (!isFirstCard) {
        pdf.addPage();
      }
      isFirstCard = false;
      
      // Set margins and positions
      const margin = 0.375;
      const pageWidth = 4;
      const pageHeight = 6;
      const contentWidth = pageWidth - (margin * 2);
      
      // Add WaveMAX Laundry logo/title
      pdf.setFontSize(18);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(74, 144, 226); // #4A90E2
      pdf.text('WaveMAX Laundry', margin, margin + 0.3);
      
      // Add customer name
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(customer.name, margin, margin + 0.7);
      
      // Add customer address
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'normal');
      const addressLines = [
        customer.address,
        customer.phone,
        customer.email || ''
      ].filter(line => line);
      
      let yPosition = margin + 1;
      addressLines.forEach(line => {
        pdf.text(line, margin, yPosition);
        yPosition += 0.2;
      });
      
      // Generate QR code URL
      const qrData = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program/customer?cust=${customer.id}`;
      
      // Create QR code
      try {
        const qrImageUrl = await QRCode.toDataURL(qrData, {
          width: 150,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        // Add QR code to PDF (bottom right)
        const qrSize = 1.25;
        const qrX = pageWidth - margin - qrSize;
        const qrY = pageHeight - margin - qrSize;
        pdf.addImage(qrImageUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } catch (err) {
        console.error('QR Code generation failed:', err);
      }
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `customer-cards-${timestamp}.pdf`;
    
    // Save the PDF and open in new window for printing
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Open PDF in new window
    const printWindow = window.open(pdfUrl, '_blank');
    
    // Clean up the URL immediately after opening
    // The browser will have already loaded the PDF data
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 100); // Very short delay to ensure window has opened
    
    console.log(`Generated PDF with ${customers.length} customer cards`);
  }
  
  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Store current analytics data
  let currentAnalyticsData = null;
  let currentDashboardData = null;
  let currentDateRange = 'month'; // Default to last 30 days

  // Load analytics with date range
  async function loadAnalytics(range = currentDateRange) {
    try {
      // Update current range
      currentDateRange = range;

      // Determine period for API call
      let period = 'month';
      switch(range) {
      case 'today':
        period = 'day';
        break;
      case 'week':
        period = 'week';
        break;
      case 'month':
        period = 'month';
        break;
      }

      const [ordersResponse, dashboardResponse] = await Promise.all([
        adminFetch(`/api/v1/administrators/analytics/orders?period=${period}`),
        adminFetch('/api/v1/administrators/dashboard')
      ]);

      // Check response status before parsing
      if (!ordersResponse.ok || !dashboardResponse.ok) {
        console.error('One or more API calls failed:', {
          orders: ordersResponse.ok ? 'OK' : `Failed (${ordersResponse.status})`,
          dashboard: dashboardResponse.ok ? 'OK' : `Failed (${dashboardResponse.status})`
        });
        return;
      }

      const ordersData = await ordersResponse.json();
      const dashboardData = await dashboardResponse.json();

      if (ordersData && dashboardData) {
        // Create analytics data
        const analyticsData = {
          ...ordersData,
          dashboardData: dashboardData.dashboard,
          dateRange: range
        };

        // Store data for re-rendering
        currentAnalyticsData = analyticsData;
        currentDashboardData = dashboardData.dashboard;

        renderAnalyticsOverview(ordersData);
        renderAnalyticsCharts(analyticsData, dashboardData.dashboard);

        // Set up date range toggle handlers
        setupDateRangeToggle();
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  // Set up date range toggle handlers
  function setupDateRangeToggle() {
    const toggleButtons = document.querySelectorAll('.date-range-toggle .toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        // Update active state
        toggleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Get selected range
        const range = btn.dataset.range;

        // Reload all analytics with new date range
        await loadAnalytics(range);
      });
    });
  }


  // Render analytics overview
  function renderAnalyticsOverview(data) {
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;

    // Handle both direct summary and nested analytics.summary structures
    const summary = data.summary || (data.analytics && data.analytics.summary) || {};

    // Provide default values if data is missing
    const totalOrders = summary.totalOrders || 0;
    const completedOrders = summary.completedOrders || 0;
    const totalRevenue = summary.totalRevenue || 0;
    const avgOrderValue = summary.averageOrderValue || summary.avgOrderValue || 0;
    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    const overviewHtml = `
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.totalOrders')}</h3>
                <div class="stat-value">${totalOrders}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.thisWeek')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.completed')}</h3>
                <div class="stat-value">${completedOrders}</div>
                <div class="stat-change">${completionRate}% ${t('administrator.dashboard.analytics.completionRate')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.revenue')}</h3>
                <div class="stat-value">$${totalRevenue.toFixed(2)}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.thisWeek')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.avgOrderValue')}</h3>
                <div class="stat-value">$${avgOrderValue.toFixed(2)}</div>
                <div class="stat-change">${t('administrator.dashboard.analytics.perOrder')}</div>
            </div>
        `;
    document.getElementById('analyticsOverview').innerHTML = overviewHtml;
  }

  // Chart instances storage
  let chartInstances = {
    revenue: null,
    processingTime: null,
    orderStatus: null,
    dailyOrders: null
  };

  // Render analytics charts
  function renderAnalyticsCharts(ordersData, dashboardData) {
    // Destroy existing charts before creating new ones
    Object.values(chartInstances).forEach(chart => {
      if (chart) chart.destroy();
    });

    // Revenue Chart
    renderRevenueChart(ordersData);

    // Processing Time Distribution Chart
    renderProcessingTimeChart(ordersData);

    // Order Status Distribution Chart
    renderOrderStatusChart(dashboardData);

    // Daily Orders Trend Chart
    renderDailyOrdersChart(ordersData);
  }

  // Render revenue chart
  function renderRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    const timeline = data.analytics?.timeline || [];
    const labels = timeline.map(item => item._id);
    const revenues = timeline.map(item => item.totalRevenue || 0);

    chartInstances.revenue = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: t('administrator.dashboard.analytics.revenue', 'Revenue'),
          data: revenues,
          borderColor: '#4A90E2',
          backgroundColor: 'rgba(74, 144, 226, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return '$' + context.parsed.y.toFixed(2);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value;
              }
            }
          }
        }
      }
    });
  }

  // Render processing time chart (daily average scheduled to completion time)
  function renderProcessingTimeChart(data) {
    const ctx = document.getElementById('processingTimeChart');
    if (!ctx) return;

    // Use timeline data to show daily average completion times
    const timeline = data.analytics?.timeline || [];
    const labels = timeline.map(item => {
      const date = new Date(item._id);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Calculate average processing time in hours for each day
    const avgProcessingTimes = timeline.map(item => {
      const avgMinutes = item.averageProcessingTime || 0;
      return Math.round(avgMinutes / 60 * 10) / 10; // Convert to hours with 1 decimal place
    });

    chartInstances.processingTime = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: t('administrator.dashboard.analytics.avgProcessingHours', 'Avg Hours to Complete'),
          data: avgProcessingTimes,
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          borderColor: '#28a745',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#28a745',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.y.toFixed(1) + ' hours';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value + 'h';
              }
            },
            suggestedMax: 48, // 48 hours max
            grid: {
              drawBorder: false
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  // Render order status distribution chart
  function renderOrderStatusChart(data, range = currentOrderStatusRange) {
    const ctx = document.getElementById('orderStatusChart');
    if (!ctx) return;

    // Use dashboard data for status distribution
    const statusDistribution = data.orderStats?.statusDistribution || [];
    const statusCounts = {};

    // Build status counts from dashboard data
    statusDistribution.forEach(item => {
      statusCounts[item._id] = item.count;
    });

    // Convert to array format for chart
    const statusArray = Object.entries(statusCounts)
      .filter(([status, count]) => count > 0) // Only show statuses with orders
      .map(([status, count]) => ({ status, count }));

    const labels = statusArray.map(item => {
      const statusLabels = {
        'pending': t('administrator.dashboard.orderStatus.pending', 'Pending'),
        'scheduled': t('administrator.dashboard.orderStatus.scheduled', 'Scheduled'),
        'processing': t('administrator.dashboard.orderStatus.processing', 'Processing'),
        'processed': t('administrator.dashboard.orderStatus.processed', 'Processed'),
        'complete': t('administrator.dashboard.orderStatus.complete', 'Complete'),
        'cancelled': t('administrator.dashboard.orderStatus.cancelled', 'Cancelled')
      };
      return statusLabels[item.status] || item.status;
    });
    const counts = statusArray.map(item => item.count);

    const colors = {
      'pending': '#ffc107',
      'scheduled': '#17a2b8',
      'processing': '#007bff',
      'processed': '#28a745',
      'complete': '#20c997',
      'cancelled': '#dc3545'
    };

    const backgroundColors = statusArray.map(item => colors[item.status] || '#6c757d');

    chartInstances.orderStatus = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 15,
              usePointStyle: true
            }
          },
          title: {
            display: false
          }
        }
      }
    });
  }

  // Render daily orders trend chart
  function renderDailyOrdersChart(data) {
    const ctx = document.getElementById('dailyOrdersChart');
    if (!ctx) return;

    const timeline = data.analytics?.timeline || [];
    const labels = timeline.map(item => {
      const date = new Date(item._id);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const totalOrders = timeline.map(item => item.totalOrders || 0);
    const completedOrders = timeline.map(item => item.completedOrders || 0);

    chartInstances.dailyOrders = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: t('administrator.dashboard.analytics.totalOrders', 'Total Orders'),
            data: totalOrders,
            backgroundColor: 'rgba(74, 144, 226, 0.6)',
            borderColor: '#4A90E2',
            borderWidth: 1
          },
          {
            label: t('administrator.dashboard.analytics.completedOrders', 'Completed Orders'),
            data: completedOrders,
            backgroundColor: 'rgba(40, 167, 69, 0.6)',
            borderColor: '#28a745',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  // Load affiliates
  async function loadAffiliates() {
    try {
      const response = await adminFetch('/api/v1/administrators/analytics/affiliates?period=month');
      const data = await response.json();

      if (response.ok) {
        renderAffiliatesList(data.topAffiliates);
      }
    } catch (error) {
      console.error('Error loading affiliates:', error);
    }
  }

  // Render affiliates list
  function renderAffiliatesList(affiliates) {
    if (!affiliates || affiliates.length === 0) {
      const noDataText = window.i18n ? window.i18n.t('administrator.dashboard.affiliates.noData') : 'No affiliate data available';
      document.getElementById('affiliatesList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${noDataText}</p>`;
      return;
    }

    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;
    const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>${t('administrator.dashboard.affiliates.affiliateId')}</th>
                        <th>${t('administrator.dashboard.affiliates.name')}</th>
                        <th>${t('administrator.dashboard.affiliates.customers')}</th>
                        <th>${t('administrator.dashboard.affiliates.orders')}</th>
                        <th>${t('administrator.dashboard.affiliates.revenue')}</th>
                        <th>${t('administrator.dashboard.affiliates.commission')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${affiliates.map(aff => `
                        <tr>
                            <td>${aff.affiliateId}</td>
                            <td>${aff.name}</td>
                            <td>${aff.totalCustomers}</td>
                            <td>${aff.totalOrders}</td>
                            <td>$${aff.totalRevenue.toFixed(2)}</td>
                            <td>$${aff.totalCommission.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    document.getElementById('affiliatesList').innerHTML = tableHtml;
  }

  // Store current W-9 filter state
  let currentW9Filter = 'pending';
  let currentW9Search = '';
  let w9Documents = [];

  // Load W-9 documents
  async function loadW9Documents() {
    try {
      const response = await adminFetch('/api/v1/w9/admin/pending?status=' + currentW9Filter);
      const data = await response.json();

      if (response.ok) {
        w9Documents = data.documents || [];
        updateW9Count();
        renderW9DocumentsList();
      } else {
        document.getElementById('w9DocumentsList').innerHTML = `
                    <p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.w9LoadFailed', 'Failed to load W-9 documents')}</p>
                `;
      }
    } catch (error) {
      console.error('Error loading W-9 documents:', error);
      document.getElementById('w9DocumentsList').innerHTML = `
                <p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.w9LoadFailed', 'Error loading W-9 documents')}</p>
            `;
    }
  }

  // Update W-9 pending count
  function updateW9Count() {
    const pendingCount = w9Documents.filter(doc => doc.w9Status === 'pending_review').length;
    const badge = document.getElementById('pendingW9Count');
    if (badge) {
      badge.textContent = `${pendingCount} ${t('administrator.dashboard.w9review.pending', 'Pending')}`;
      badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Render W-9 documents list
  function renderW9DocumentsList() {
    const filteredDocs = w9Documents.filter(doc => {
      // Apply status filter
      if (currentW9Filter !== 'all' && doc.w9Status !== currentW9Filter) {
        return false;
      }

      // Apply search filter
      if (currentW9Search) {
        const search = currentW9Search.toLowerCase();
        return (
          doc.affiliateName.toLowerCase().includes(search) ||
                    doc.affiliateEmail.toLowerCase().includes(search) ||
                    doc.affiliateId.toLowerCase().includes(search)
        );
      }

      return true;
    });

    if (filteredDocs.length === 0) {
      document.getElementById('w9DocumentsList').innerHTML = `
                <p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.w9review.noDocuments', 'No W-9 documents found')}</p>
            `;
      return;
    }

    const docsHtml = filteredDocs.map(doc => `
            <div class="w9-row">
                <div class="w9-info">
                    <div class="w9-affiliate-name">${doc.affiliateName}</div>
                    <div class="w9-affiliate-details">
                        ${doc.affiliateEmail} | ID: ${doc.affiliateId}
                        ${doc.submittedAt ? ` | Submitted: ${new Date(doc.submittedAt).toLocaleDateString()}` : ''}
                    </div>
                </div>
                <div class="w9-status">
                    <span class="status-badge status-${doc.w9Status === 'pending_review' ? 'pending' : doc.w9Status}">
                        ${getW9StatusLabel(doc.w9Status)}
                    </span>
                </div>
                <div class="w9-actions">
                    <button class="btn btn-sm download-w9-btn" data-affiliate-id="${doc.affiliateId}">${t('administrator.dashboard.w9review.download', 'Download')}</button>
                    ${doc.w9Status === 'pending_review' ? `
                        <button class="btn btn-sm btn-primary verify-w9-btn" data-affiliate-id="${doc.affiliateId}">${t('administrator.dashboard.w9review.verify', 'Verify')}</button>
                        <button class="btn btn-sm btn-secondary reject-w9-btn" data-affiliate-id="${doc.affiliateId}">${t('administrator.dashboard.w9review.reject', 'Reject')}</button>
                    ` : ''}
                </div>
            </div>
        `).join('');

    document.getElementById('w9DocumentsList').innerHTML = docsHtml;
  }

  // Get W-9 status label
  function getW9StatusLabel(status) {
    const labels = {
      'pending_review': t('administrator.dashboard.w9review.pendingReview', 'Pending Review'),
      'verified': t('administrator.dashboard.w9review.verified', 'Verified'),
      'rejected': t('administrator.dashboard.w9review.rejected', 'Rejected')
    };
    return labels[status] || status;
  }

  // Download W-9 document
  window.downloadW9 = async function(affiliateId) {
    try {
      const response = await adminFetch(`/api/v1/w9/admin/${affiliateId}/download`);

      if (response.ok) {
        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `W9_${affiliateId}.pdf`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/);
          if (match) filename = match[1];
        }

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.w9review.downloadFailed', 'Failed to download W-9 document'));
      }
    } catch (error) {
      console.error('Error downloading W-9:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  };

  // Open W-9 verification modal
  window.openW9VerificationModal = function(affiliateId) {
    const doc = w9Documents.find(d => d.affiliateId === affiliateId);
    if (!doc) return;

    // Populate modal fields
    document.getElementById('verifyAffiliateId').value = affiliateId;
    document.getElementById('verifyAffiliateName').textContent = doc.affiliateName;
    document.getElementById('verifyAffiliateEmail').textContent = doc.affiliateEmail;
    document.getElementById('verifyAffiliateIdDisplay').textContent = affiliateId;

    // Reset form
    document.getElementById('w9VerificationForm').reset();
    document.getElementById('verifyAffiliateId').value = affiliateId;

    // Show modal
    document.getElementById('w9VerificationModal').style.display = 'flex';
  };

  // Close W-9 verification modal
  window.closeW9VerificationModal = function() {
    document.getElementById('w9VerificationModal').style.display = 'none';
  };

  // Open W-9 rejection modal
  window.openW9RejectionModal = function(affiliateId) {
    document.getElementById('rejectAffiliateId').value = affiliateId;
    document.getElementById('w9RejectionForm').reset();
    document.getElementById('rejectAffiliateId').value = affiliateId;
    document.getElementById('w9RejectionModal').style.display = 'flex';
  };

  // Close W-9 rejection modal
  window.closeW9RejectionModal = function() {
    document.getElementById('w9RejectionModal').style.display = 'none';
  };

  // Handle W-9 verification form submission
  document.getElementById('w9VerificationForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const affiliateId = document.getElementById('verifyAffiliateId').value;
    const verificationData = {
      taxIdType: document.getElementById('taxIdType').value,
      taxIdLast4: document.getElementById('taxIdLast4').value,
      businessName: document.getElementById('businessName').value,
      quickbooksVendorId: document.getElementById('quickbooksVendorId').value,
      notes: document.getElementById('verificationNotes').value
    };

    try {
      const response = await adminFetch(`/api/v1/w9/admin/${affiliateId}/verify`, {
        method: 'POST',
        body: JSON.stringify(verificationData)
      });

      if (response.ok) {
        alert(t('administrator.dashboard.w9review.verifySuccess', 'W-9 document verified successfully'));
        closeW9VerificationModal();
        loadW9Documents(); // Reload the list
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.w9review.verifyFailed', 'Failed to verify W-9 document'));
      }
    } catch (error) {
      console.error('Error verifying W-9:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  });

  // Handle W-9 rejection form submission
  document.getElementById('w9RejectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const affiliateId = document.getElementById('rejectAffiliateId').value;
    const rejectionData = {
      reason: document.getElementById('rejectionReason').value
    };

    try {
      const response = await adminFetch(`/api/v1/w9/admin/${affiliateId}/reject`, {
        method: 'POST',
        body: JSON.stringify(rejectionData)
      });

      if (response.ok) {
        alert(t('administrator.dashboard.w9review.rejectSuccess', 'W-9 document rejected successfully'));
        closeW9RejectionModal();
        loadW9Documents(); // Reload the list
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.w9review.rejectFailed', 'Failed to reject W-9 document'));
      }
    } catch (error) {
      console.error('Error rejecting W-9:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  });

  // W-9 filter and search handlers
  const w9StatusFilter = document.getElementById('w9StatusFilter');
  const w9SearchInput = document.getElementById('w9SearchInput');
  const refreshW9ListBtn = document.getElementById('refreshW9ListBtn');

  if (w9StatusFilter) {
    w9StatusFilter.addEventListener('change', (e) => {
      currentW9Filter = e.target.value;
      loadW9Documents();
    });
  }

  if (w9SearchInput) {
    w9SearchInput.addEventListener('input', (e) => {
      currentW9Search = e.target.value;
      renderW9DocumentsList();
    });
  }

  if (refreshW9ListBtn) {
    refreshW9ListBtn.addEventListener('click', () => {
      loadW9Documents();
    });
  }

  // QuickBooks Export functionality
  let exportHistory = [];
  let searchTimeout = null;
  let affiliateSearchResults = [];

  // Load QuickBooks tab
  async function loadQuickBooksTab() {
    await loadExportHistory();
    setupQuickBooksEventHandlers();
  }

  // Load export history
  async function loadExportHistory() {
    try {
      const response = await adminFetch('/api/v1/quickbooks/history?limit=20');
      const data = await response.json();

      if (response.ok) {
        exportHistory = data.exports || [];
        renderExportHistory();
      } else {
        document.getElementById('exportHistoryList').innerHTML = `
                    <p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.exportHistoryLoadFailed', 'Failed to load export history')}</p>
                `;
      }
    } catch (error) {
      console.error('Error loading export history:', error);
      document.getElementById('exportHistoryList').innerHTML = `
                <p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.exportHistoryLoadFailed', 'Error loading export history')}</p>
            `;
    }
  }

  // Render export history
  function renderExportHistory() {
    if (exportHistory.length === 0) {
      document.getElementById('exportHistoryList').innerHTML = `
                <p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.quickbooks.noExports', 'No exports found')}</p>
            `;
      return;
    }

    const historyHtml = `
            <table>
                <thead>
                    <tr>
                        <th>${t('administrator.dashboard.quickbooks.exportId', 'Export ID')}</th>
                        <th>${t('administrator.dashboard.quickbooks.type', 'Type')}</th>
                        <th>${t('administrator.dashboard.quickbooks.date', 'Date')}</th>
                        <th>${t('administrator.dashboard.quickbooks.exportedBy', 'Exported By')}</th>
                        <th>${t('administrator.dashboard.quickbooks.details', 'Details')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${exportHistory.map(exp => {
    const typeLabels = {
      'vendor': t('administrator.dashboard.quickbooks.vendorExport', 'Vendor Export'),
      'payment_summary': t('administrator.dashboard.quickbooks.paymentSummary', 'Payment Summary'),
      'commission_detail': t('administrator.dashboard.quickbooks.commissionDetail', 'Commission Detail')
    };

    let details = '';
    if (exp.type === 'vendor') {
      details = `${exp.affiliateIds.length} vendors`;
    } else if (exp.type === 'payment_summary') {
      const start = new Date(exp.periodStart).toLocaleDateString();
      const end = new Date(exp.periodEnd).toLocaleDateString();
      details = `${start} - ${end}`;
    } else if (exp.type === 'commission_detail') {
      details = `Affiliate: ${exp.affiliateIds[0]}`;
    }

    return `
                            <tr>
                                <td>${exp.exportId}</td>
                                <td>${typeLabels[exp.type] || exp.type}</td>
                                <td>${new Date(exp.createdAt).toLocaleString()}</td>
                                <td>${exp.exportedBy?.firstName || ''} ${exp.exportedBy?.lastName || ''}</td>
                                <td>${details}</td>
                            </tr>
                        `;
  }).join('')}
                </tbody>
            </table>
        `;

    document.getElementById('exportHistoryList').innerHTML = historyHtml;
  }

  // Setup QuickBooks event handlers
  function setupQuickBooksEventHandlers() {
    // Export vendors button
    const exportVendorsBtn = document.getElementById('exportVendorsBtn');
    if (exportVendorsBtn && !exportVendorsBtn.hasAttribute('data-initialized')) {
      exportVendorsBtn.setAttribute('data-initialized', 'true');
      exportVendorsBtn.addEventListener('click', exportVendors);
    }

    // Payment summary button
    const openPaymentSummaryBtn = document.getElementById('openPaymentSummaryBtn');
    if (openPaymentSummaryBtn && !openPaymentSummaryBtn.hasAttribute('data-initialized')) {
      openPaymentSummaryBtn.setAttribute('data-initialized', 'true');
      openPaymentSummaryBtn.addEventListener('click', () => {
        document.getElementById('paymentSummaryModal').style.display = 'flex';
      });
    }

    // Commission detail button
    const openCommissionDetailBtn = document.getElementById('openCommissionDetailBtn');
    if (openCommissionDetailBtn && !openCommissionDetailBtn.hasAttribute('data-initialized')) {
      openCommissionDetailBtn.setAttribute('data-initialized', 'true');
      openCommissionDetailBtn.addEventListener('click', () => {
        document.getElementById('commissionDetailModal').style.display = 'flex';
      });
    }

    // Refresh export history button
    const refreshExportHistoryBtn = document.getElementById('refreshExportHistoryBtn');
    if (refreshExportHistoryBtn && !refreshExportHistoryBtn.hasAttribute('data-initialized')) {
      refreshExportHistoryBtn.setAttribute('data-initialized', 'true');
      refreshExportHistoryBtn.addEventListener('click', loadExportHistory);
    }

    // Payment summary form
    const paymentSummaryForm = document.getElementById('paymentSummaryForm');
    if (paymentSummaryForm && !paymentSummaryForm.hasAttribute('data-initialized')) {
      paymentSummaryForm.setAttribute('data-initialized', 'true');
      paymentSummaryForm.addEventListener('submit', handlePaymentSummaryExport);
    }

    // Commission detail form
    const commissionDetailForm = document.getElementById('commissionDetailForm');
    if (commissionDetailForm && !commissionDetailForm.hasAttribute('data-initialized')) {
      commissionDetailForm.setAttribute('data-initialized', 'true');
      commissionDetailForm.addEventListener('submit', handleCommissionDetailExport);
    }

    // Affiliate search
    const detailAffiliateSearch = document.getElementById('detailAffiliateSearch');
    if (detailAffiliateSearch && !detailAffiliateSearch.hasAttribute('data-initialized')) {
      detailAffiliateSearch.setAttribute('data-initialized', 'true');
      detailAffiliateSearch.addEventListener('input', handleAffiliateSearch);
    }
  }

  // Export vendors
  async function exportVendors() {
    try {
      const response = await adminFetch('/api/v1/quickbooks/vendors?format=csv');

      if (response.ok) {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wavemax-vendors-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Reload export history
        await loadExportHistory();
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.quickbooks.exportFailed', 'Export failed'));
      }
    } catch (error) {
      console.error('Error exporting vendors:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  }

  // Handle payment summary export
  async function handlePaymentSummaryExport(e) {
    e.preventDefault();

    const startDate = document.getElementById('summaryStartDate').value;
    const endDate = document.getElementById('summaryEndDate').value;
    const format = document.getElementById('summaryFormat').value;

    try {
      const response = await adminFetch(`/api/v1/quickbooks/payment-summary?startDate=${startDate}&endDate=${endDate}&format=${format}`);

      if (response.ok) {
        if (format === 'csv') {
          // Download CSV file
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wavemax-payments-${startDate}-to-${endDate}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          // Show JSON response
          const data = await response.json();
          alert(t('administrator.dashboard.quickbooks.exportSuccess', 'Export successful! Check export history for details.'));
        }

        closePaymentSummaryModal();
        await loadExportHistory();
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.quickbooks.exportFailed', 'Export failed'));
      }
    } catch (error) {
      console.error('Error exporting payment summary:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  }

  // Handle commission detail export
  async function handleCommissionDetailExport(e) {
    e.preventDefault();

    const affiliateId = document.getElementById('detailAffiliateId').value;
    const startDate = document.getElementById('detailStartDate').value;
    const endDate = document.getElementById('detailEndDate').value;
    const format = document.getElementById('detailFormat').value;

    if (!affiliateId) {
      alert(t('administrator.dashboard.quickbooks.selectAffiliateError', 'Please select an affiliate'));
      return;
    }

    try {
      const response = await adminFetch(`/api/v1/quickbooks/commission-detail?affiliateId=${affiliateId}&startDate=${startDate}&endDate=${endDate}&format=${format}`);

      if (response.ok) {
        if (format === 'csv') {
          // Download CSV file
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wavemax-commission-${affiliateId}-${startDate}-to-${endDate}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          // Show JSON response
          const data = await response.json();
          alert(t('administrator.dashboard.quickbooks.exportSuccess', 'Export successful! Check export history for details.'));
        }

        closeCommissionDetailModal();
        await loadExportHistory();
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.quickbooks.exportFailed', 'Export failed'));
      }
    } catch (error) {
      console.error('Error exporting commission detail:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  }

  // Handle affiliate search
  async function handleAffiliateSearch(e) {
    const searchTerm = e.target.value.trim();

    if (searchTerm.length < 2) {
      document.getElementById('affiliateSearchResults').style.display = 'none';
      return;
    }

    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);

    // Debounce search
    searchTimeout = setTimeout(async () => {
      try {
        const response = await adminFetch(`/api/v1/affiliates?search=${encodeURIComponent(searchTerm)}&status=active&limit=10`);
        const data = await response.json();

        if (response.ok && data.affiliates) {
          affiliateSearchResults = data.affiliates;
          renderAffiliateSearchResults();
        }
      } catch (error) {
        console.error('Error searching affiliates:', error);
      }
    }, 300);
  }

  // Render affiliate search results
  function renderAffiliateSearchResults() {
    const resultsDiv = document.getElementById('affiliateSearchResults');

    if (affiliateSearchResults.length === 0) {
      resultsDiv.innerHTML = `<div style="padding: 10px; color: #666;">${t('administrator.dashboard.quickbooks.noAffiliatesFound', 'No affiliates found')}</div>`;
    } else {
      resultsDiv.innerHTML = affiliateSearchResults.map(affiliate => `
                <div style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" 
                     data-affiliate-id="${affiliate.affiliateId}" data-affiliate-name="${affiliate.firstName} ${affiliate.lastName}" class="select-affiliate-link affiliate-search-item">
                    <strong>${affiliate.firstName} ${affiliate.lastName}</strong><br>
                    <small>${affiliate.email} | ID: ${affiliate.affiliateId}</small>
                </div>
            `).join('');
    }

    resultsDiv.style.display = 'block';
  }

  // Select affiliate
  window.selectAffiliate = function(affiliateId, affiliateName) {
    document.getElementById('detailAffiliateId').value = affiliateId;
    document.getElementById('selectedAffiliateName').textContent = affiliateName;
    document.getElementById('selectedAffiliate').style.display = 'block';
    document.getElementById('affiliateSearchResults').style.display = 'none';
    document.getElementById('detailAffiliateSearch').value = '';
  };

  // Modal close functions
  window.closePaymentSummaryModal = function() {
    document.getElementById('paymentSummaryModal').style.display = 'none';
    document.getElementById('paymentSummaryForm').reset();
  };

  window.closeCommissionDetailModal = function() {
    document.getElementById('commissionDetailModal').style.display = 'none';
    document.getElementById('commissionDetailForm').reset();
    document.getElementById('detailAffiliateId').value = '';
    document.getElementById('selectedAffiliate').style.display = 'none';
    document.getElementById('affiliateSearchResults').style.display = 'none';
  };

  // Audit Log functionality
  let currentAuditFilters = {
    action: '',
    affiliateId: '',
    dateFrom: '',
    dateTo: ''
  };

  // Load audit log
  async function loadAuditLog() {
    try {
      // Set up event listeners
      setupAuditLogEventListeners();

      // Load initial data
      await loadAuditLogData();
    } catch (error) {
      console.error('Error loading audit log:', error);
      document.getElementById('auditLogContent').innerHTML = `
                <p style="padding: 20px; text-align: center; color: #dc3545;">
                    ${t('administrator.dashboard.auditlog.loadError', 'Error loading audit logs')}
                </p>
            `;
    }
  }

  // Set up audit log event listeners
  function setupAuditLogEventListeners() {
    // Apply filters button
    const applyFiltersBtn = document.getElementById('applyAuditFiltersBtn');
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', async () => {
        currentAuditFilters = {
          action: document.getElementById('auditActionFilter').value,
          affiliateId: document.getElementById('auditAffiliateFilter').value,
          dateFrom: document.getElementById('auditDateFromFilter').value,
          dateTo: document.getElementById('auditDateToFilter').value
        };
        await loadAuditLogData();
      });
    }

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearAuditFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', async () => {
        // Clear filter inputs
        document.getElementById('auditActionFilter').value = '';
        document.getElementById('auditAffiliateFilter').value = '';
        document.getElementById('auditDateFromFilter').value = '';
        document.getElementById('auditDateToFilter').value = '';

        // Reset current filters
        currentAuditFilters = {
          action: '',
          affiliateId: '',
          dateFrom: '',
          dateTo: ''
        };

        await loadAuditLogData();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshAuditLogBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await loadAuditLogData();
      });
    }

    // Export button
    const exportBtn = document.getElementById('exportAuditLogBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        await exportAuditLog();
      });
    }
  }

  // Load audit log data
  async function loadAuditLogData() {
    const container = document.getElementById('auditLogContent');
    container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>${t('administrator.dashboard.auditlog.loading', 'Loading audit logs...')}</p>
            </div>
        `;

    try {
      // Build query string
      const params = new URLSearchParams();
      if (currentAuditFilters.action) params.append('action', currentAuditFilters.action);
      if (currentAuditFilters.affiliateId) params.append('affiliateId', currentAuditFilters.affiliateId);
      if (currentAuditFilters.dateFrom) params.append('startDate', currentAuditFilters.dateFrom);
      if (currentAuditFilters.dateTo) params.append('endDate', currentAuditFilters.dateTo);
      params.append('limit', '100');

      const response = await adminFetch(`/api/v1/w9/admin/audit-logs?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data.success) {
        renderAuditLogTable(data.logs);
      } else {
        container.innerHTML = `
                    <p style="padding: 20px; text-align: center; color: #dc3545;">
                        ${data.message || t('administrator.dashboard.auditlog.loadError', 'Failed to load audit logs')}
                    </p>
                `;
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
      container.innerHTML = `
                <p style="padding: 20px; text-align: center; color: #dc3545;">
                    ${t('administrator.dashboard.auditlog.loadError', 'Error loading audit logs')}
                </p>
            `;
    }
  }

  // Render audit log table
  function renderAuditLogTable(logs) {
    const container = document.getElementById('auditLogContent');

    if (!logs || logs.length === 0) {
      container.innerHTML = `
                <p style="padding: 20px; text-align: center; color: #666;">
                    ${t('administrator.dashboard.auditlog.noLogs', 'No audit logs found')}
                </p>
            `;
      return;
    }

    const actionLabels = {
      'upload_attempt': 'Upload Attempt',
      'upload_success': 'Upload Success',
      'upload_failure': 'Upload Failure',
      'download_affiliate': 'Download (Affiliate)',
      'download_admin': 'Download (Admin)',
      'verify_attempt': 'Verify Attempt',
      'verify_success': 'Verify Success',
      'reject': 'Reject',
      'expire': 'Expire',
      'delete': 'Delete',
      'quickbooks_export': 'QuickBooks Export',
      'legal_hold': 'Legal Hold'
    };

    const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>${t('administrator.dashboard.auditlog.timestamp', 'Timestamp')}</th>
                        <th>${t('administrator.dashboard.auditlog.action', 'Action')}</th>
                        <th>${t('administrator.dashboard.auditlog.user', 'User')}</th>
                        <th>${t('administrator.dashboard.auditlog.affiliate', 'Affiliate')}</th>
                        <th>${t('administrator.dashboard.auditlog.details', 'Details')}</th>
                        <th>${t('administrator.dashboard.auditlog.ipAddress', 'IP Address')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => {
    // Format timestamp
    const timestamp = new Date(log.timestamp).toLocaleString();

    // Format user info
    const user = log.userInfo ?
      `${log.userInfo.userName} (${log.userInfo.userType})` :
      'System';

    // Format details
    let detailsHtml = '';
    if (log.details) {
      if (log.details.success !== undefined) {
        detailsHtml += `<span class="status-badge ${log.details.success ? 'active' : 'inactive'}">
                                    ${log.details.success ? 'Success' : 'Failed'}
                                </span>`;
      }
      if (log.details.reason) {
        detailsHtml += `<br><small>${log.details.reason}</small>`;
      }
      if (log.details.error) {
        detailsHtml += `<br><small class="text-danger">${log.details.error}</small>`;
      }
    }

    return `
                            <tr>
                                <td>${timestamp}</td>
                                <td>${actionLabels[log.action] || log.action}</td>
                                <td>${user}</td>
                                <td>${log.targetInfo?.affiliateId || '-'}</td>
                                <td>${detailsHtml || '-'}</td>
                                <td>${log.metadata?.ipAddress || '-'}</td>
                            </tr>
                        `;
  }).join('')}
                </tbody>
            </table>
        `;

    container.innerHTML = tableHtml;
  }

  // Export audit log
  async function exportAuditLog() {
    try {
      // Build query string with current filters
      const params = new URLSearchParams();
      if (currentAuditFilters.action) params.append('action', currentAuditFilters.action);
      if (currentAuditFilters.affiliateId) params.append('affiliateId', currentAuditFilters.affiliateId);
      if (currentAuditFilters.dateFrom) params.append('startDate', currentAuditFilters.dateFrom);
      if (currentAuditFilters.dateTo) params.append('endDate', currentAuditFilters.dateTo);
      params.append('format', 'csv');

      const response = await adminFetch(`/api/v1/w9/admin/audit-logs/export?${params.toString()}`);

      if (response.ok) {
        // Get the filename from the Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : 'audit-log-export.csv';

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.auditlog.exportFailed', 'Export failed'));
      }
    } catch (error) {
      console.error('Error exporting audit log:', error);
      alert(t('administrator.dashboard.auditlog.exportError', 'Error exporting audit log'));
    }
  }

  // Load system config
  async function loadSystemConfig() {
    try {
      const response = await adminFetch('/api/v1/administrators/config');
      const data = await response.json();

      if (response.ok) {
        renderSystemConfig(data.configs);
      }
    } catch (error) {
      console.error('Error loading system config:', error);
    }
  }

  // Render system config
  function renderSystemConfig(configs) {
    const groupedConfigs = configs.reduce((acc, config) => {
      if (!acc[config.category]) acc[config.category] = [];
      acc[config.category].push(config);
      return acc;
    }, {});

    let configHtml = '<form id="configForm">';

    for (const [category, items] of Object.entries(groupedConfigs)) {
      configHtml += `<h3 style="margin: 20px 0 10px; text-transform: capitalize;">${category}</h3>`;

      items.forEach(config => {
        configHtml += '<div class="form-group">';
        configHtml += `<label for="config_${config.key}">${config.description}</label>`;

        if (config.dataType === 'boolean') {
          const enabledText = window.i18n ? window.i18n.t('administrator.dashboard.config.enabled') : 'Enabled';
          const disabledText = window.i18n ? window.i18n.t('administrator.dashboard.config.disabled') : 'Disabled';
          configHtml += `
                        <select id="config_${config.key}" name="${config.key}" data-type="${config.dataType}">
                            <option value="true" ${config.value === true ? 'selected' : ''}>${enabledText}</option>
                            <option value="false" ${config.value === false ? 'selected' : ''}>${disabledText}</option>
                        </select>
                    `;
        } else if (config.dataType === 'number') {
          configHtml += `<input type="number" id="config_${config.key}" name="${config.key}" value="${config.value}" data-type="${config.dataType}">`;
        } else if (config.dataType === 'object' || config.dataType === 'array') {
          configHtml += `<textarea id="config_${config.key}" name="${config.key}" data-type="${config.dataType}" rows="3">${JSON.stringify(config.value, null, 2)}</textarea>`;
        } else {
          configHtml += `<input type="text" id="config_${config.key}" name="${config.key}" value="${config.value}" data-type="${config.dataType}">`;
        }

        configHtml += '</div>';
      });
    }

    configHtml += '</form>';
    document.getElementById('systemConfig').innerHTML = configHtml;
  }

  // Modal handling
  const operatorModal = document.getElementById('operatorModal');
  const operatorForm = document.getElementById('operatorForm');
  let editingOperatorId = null;
  let passwordValidator = null;

  // Initialize password validator component
  function initPasswordValidator() {
    const container = document.getElementById('operatorPasswordValidator');
    if (container && window.PasswordValidatorComponent) {
      passwordValidator = new window.PasswordValidatorComponent('operatorPasswordValidator', {
        showUsername: true,
        showConfirmPassword: true,
        showStrengthIndicator: true,
        showRequirements: true,
        usernameRequired: true,
        passwordRequired: true
      });

      // Listen for email changes to update validation
      const emailField = document.getElementById('email');
      if (emailField) {
        emailField.addEventListener('input', (e) => {
          if (passwordValidator) {
            passwordValidator.options.email = e.target.value;
            passwordValidator.updatePasswordRequirements();
          }
        });
      }
    }
  }

  document.getElementById('addOperatorBtn').addEventListener('click', () => {
    editingOperatorId = null;
    const titleText = window.i18n ? window.i18n.t('administrator.dashboard.operators.addOperator') : 'Add Operator';
    document.getElementById('operatorModalTitle').textContent = titleText;
    operatorForm.reset();

    // Show password container for new operators
    const passwordContainer = document.getElementById('operatorPasswordContainer');
    if (passwordContainer) {
      passwordContainer.style.display = 'block';
      if (!passwordValidator) {
        initPasswordValidator();
      } else {
        passwordValidator.reset();
      }
    }

    operatorModal.classList.add('active');
  });

  document.getElementById('closeOperatorModal').addEventListener('click', () => {
    operatorModal.classList.remove('active');
  });

  document.getElementById('cancelOperatorBtn').addEventListener('click', () => {
    operatorModal.classList.remove('active');
  });

  // Handle operator form submission
  operatorForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(operatorForm);
    const operatorData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      shiftStart: formData.get('shiftStart'),
      shiftEnd: formData.get('shiftEnd')
    };

    // Add username and password for new operators
    if (!editingOperatorId) {
      if (!passwordValidator || !passwordValidator.isValid()) {
        alert('Please fill in all required fields and ensure the password meets all requirements.');
        return;
      }

      const credentials = passwordValidator.getValues();
      operatorData.username = credentials.username;
      operatorData.password = credentials.password;
    }

    try {
      const url = editingOperatorId
        ? `/api/v1/administrators/operators/${editingOperatorId}`
        : '/api/v1/administrators/operators';

      const method = editingOperatorId ? 'PUT' : 'POST';

      const response = await adminFetch(url, {
        method,
        body: JSON.stringify(operatorData)
      });

      if (response.ok) {
        operatorModal.classList.remove('active');
        loadOperators();
        alert(editingOperatorId ? t('administrator.dashboard.operators.operatorUpdated', 'Operator updated successfully') : t('administrator.dashboard.operators.operatorCreated', 'Operator created successfully'));
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.operators.operatorSaveFailed', 'Failed to save operator'));
      }
    } catch (error) {
      console.error('Error saving operator:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  });

  // Save config
  document.getElementById('saveConfigBtn').addEventListener('click', async () => {
    const form = document.getElementById('configForm');
    const updates = [];

    for (const input of form.elements) {
      if (input.name) {
        let value = input.value;
        const dataType = input.dataset.type;

        // Parse value based on type
        if (dataType === 'boolean') {
          value = value === 'true';
        } else if (dataType === 'number') {
          value = parseFloat(value);
        } else if (dataType === 'object' || dataType === 'array') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            alert(t('administrator.dashboard.config.invalidJson', 'Invalid JSON for') + ` ${input.name}`);
            return;
          }
        }

        updates.push({ key: input.name, value });
      }
    }

    try {
      const response = await adminFetch('/api/v1/administrators/config', {
        method: 'PUT',
        body: JSON.stringify({ updates })
      });

      if (response.ok) {
        alert(t('administrator.dashboard.config.configSaved', 'Configuration saved successfully'));
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.config.configSaveFailed', 'Failed to save configuration'));
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm(t('administrator.dashboard.confirmLogout', 'Are you sure you want to logout?'))) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminRefreshToken');
      localStorage.removeItem('adminData');
      window.location.href = '/administrator-login-embed.html';
    }
  });

  // Global functions for inline handlers
  window.editOperator = async (operatorId) => {
    try {
      const response = await adminFetch(`/api/v1/administrators/operators/${operatorId}`);
      const data = await response.json();

      if (response.ok) {
        editingOperatorId = operatorId;
        const titleText = window.i18n ? window.i18n.t('administrator.dashboard.operators.editOperator') : 'Edit Operator';
        document.getElementById('operatorModalTitle').textContent = titleText;

        // Hide password container for editing
        const passwordContainer = document.getElementById('operatorPasswordContainer');
        if (passwordContainer) {
          passwordContainer.style.display = 'none';
        }

        // Fill form with operator data
        document.getElementById('firstName').value = data.operator.firstName;
        document.getElementById('lastName').value = data.operator.lastName;
        document.getElementById('email').value = data.operator.email;
        document.getElementById('shiftStart').value = data.operator.shiftStart || '';
        document.getElementById('shiftEnd').value = data.operator.shiftEnd || '';

        operatorModal.classList.add('active');
      }
    } catch (error) {
      console.error('Error loading operator:', error);
      alert(t('administrator.dashboard.errors.operatorsLoadFailed', 'Failed to load operator details'));
    }
  };

  window.resetPin = async (operatorId) => {
    if (!confirm(t('administrator.dashboard.operators.confirmResetPin', 'Reset PIN for this operator? They will receive a new PIN via email.'))) {
      return;
    }

    try {
      const response = await adminFetch(`/api/v1/administrators/operators/${operatorId}/reset-pin`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      if (response.ok) {
        alert(t('administrator.dashboard.operators.pinResetSuccess', 'PIN reset successfully. New PIN has been sent to the operator.'));
      } else {
        const error = await response.json();
        alert(error.message || t('administrator.dashboard.operators.pinResetFailed', 'Failed to reset PIN'));
      }
    } catch (error) {
      console.error('Error resetting PIN:', error);
      alert(t('administrator.dashboard.errors.networkError', 'Network error. Please try again.'));
    }
  };

  // Remove loading spinners before loading data
  function removeLoadingSpinners() {
    // Remove any swirl spinners
    const swirlSpinners = document.querySelectorAll('.swirl-spinner-container');
    swirlSpinners.forEach(spinner => spinner.remove());

    // Also remove standard loading divs
    const loadingDivs = document.querySelectorAll('.loading');
    loadingDivs.forEach(div => {
      if (div.querySelector('.spinner')) {
        div.remove();
      }
    });
  }

  // Set up event delegation for dynamic buttons
  document.addEventListener('click', function(e) {
    // Edit operator button
    if (e.target.classList.contains('edit-operator-btn')) {
      const operatorId = e.target.getAttribute('data-operator-id');
      editOperator(operatorId);
    }
    
    // Reset PIN button
    if (e.target.classList.contains('reset-pin-btn')) {
      const operatorId = e.target.getAttribute('data-operator-id');
      resetPin(operatorId);
    }
    
    // Print customer card button
    if (e.target.classList.contains('print-card-btn')) {
      const customerId = e.target.getAttribute('data-customer-id');
      printCustomerCard(customerId);
    }
    
    // Download W9 button
    if (e.target.classList.contains('download-w9-btn')) {
      const affiliateId = e.target.getAttribute('data-affiliate-id');
      downloadW9(affiliateId);
    }
    
    // Verify W9 button
    if (e.target.classList.contains('verify-w9-btn')) {
      const affiliateId = e.target.getAttribute('data-affiliate-id');
      openW9VerificationModal(affiliateId);
    }
    
    // Reject W9 button
    if (e.target.classList.contains('reject-w9-btn')) {
      const affiliateId = e.target.getAttribute('data-affiliate-id');
      openW9RejectionModal(affiliateId);
    }
    
    // Select affiliate link
    if (e.target.closest('.select-affiliate-link')) {
      const link = e.target.closest('.select-affiliate-link');
      const affiliateId = link.getAttribute('data-affiliate-id');
      const affiliateName = link.getAttribute('data-affiliate-name');
      selectAffiliate(affiliateId, affiliateName);
    }
  });
  
  // Add hover effect for affiliate search items via CSS class
  const style = document.createElement('style');
  style.textContent = `
    .affiliate-search-item:hover {
      background-color: #f8f9fa !important;
    }
  `;
  document.head.appendChild(style);

  // Load initial data
  removeLoadingSpinners();
  // Dashboard is loaded when we restore the saved tab above

  // Refresh current tab when translations are ready
  window.addEventListener('i18nReady', function() {
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
      const tabName = activeTab.getAttribute('data-tab');
      loadTabData(tabName);
    }
  });

  // Listen for language changes
  window.addEventListener('languageChanged', function(event) {
    console.log('Language changed to:', event.detail.language);

    // Re-translate the page
    if (window.i18n && window.i18n.translatePage) {
      window.i18n.translatePage();
    }

    // Refresh password validator translations if it exists
    if (passwordValidator && passwordValidator.refreshTranslations) {
      passwordValidator.refreshTranslations();
    }

    // Tab content is already loaded when we restore the saved tab
    // Just refresh translations for the current content
    if (window.i18n && window.i18n.translatePage) {
      window.i18n.translatePage();
    }
  });

  // Listen for language changes from parent iframe bridge
  // This is how the affiliate dashboard handles language changes
  window.addEventListener('message', function(event) {
    // Handle language change messages from parent iframe
    if (event.data && event.data.type === 'language-change') {
      const language = event.data.data?.language;
      if (language && window.i18n && window.i18n.setLanguage) {
        console.log('[Admin Dashboard] Received language change from parent:', language);
        window.i18n.setLanguage(language);
      }
    }
  });
})();