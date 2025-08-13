(function() {
  'use strict';

  // Translation helper
  function t(key, fallback) {
    return window.i18n && window.i18n.t ? window.i18n.t(key) : fallback;
  }

  // Generate UUID v4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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
      window.location.href = '/embed-app-v2.html?route=/administrator-login';
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
    logoutBtn.addEventListener('click', () => {
      // Show the logout modal
      const logoutModal = document.getElementById('logoutModal');
      if (logoutModal) {
        logoutModal.classList.remove('hidden');
        logoutModal.style.display = 'flex';
      }
    });
  }

  // Global logout functions
  window.closeLogoutModal = function() {
    const logoutModal = document.getElementById('logoutModal');
    if (logoutModal) {
      logoutModal.style.display = 'none';
      logoutModal.classList.add('hidden');
    }
  };

  // Close modal when clicking outside
  const logoutModal = document.getElementById('logoutModal');
  if (logoutModal) {
    logoutModal.addEventListener('click', function(e) {
      if (e.target === logoutModal) {
        closeLogoutModal();
      }
    });
  }

  window.confirmLogout = async function() {
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
    localStorage.removeItem('currentRoute');

    // Clear session manager data
    if (window.SessionManager) {
      window.SessionManager.clearAuth('administrator');
    }

    // Close modal
    closeLogoutModal();

    // Use embed navigation
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'navigate',
        data: { page: '/administrator-login' }
      }, '*');
    } else {
      window.location.href = '/embed-app-v2.html?route=/administrator-login';
    }
  };

  // Tab navigation
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Sub-tab navigation
  function initializeSubTabs() {
    const subTabs = document.querySelectorAll('.sub-nav-tab');
    const subTabContents = document.querySelectorAll('.sub-tab-content');
    
    subTabs.forEach(subTab => {
      subTab.addEventListener('click', () => {
        const targetSubTab = subTab.dataset.subtab;
        
        // Update active states
        subTabs.forEach(t => t.classList.remove('active'));
        subTabContents.forEach(tc => tc.classList.remove('active'));
        
        subTab.classList.add('active');
        const contentElement = document.getElementById(`${targetSubTab}-subtab`);
        if (contentElement) {
          contentElement.classList.add('active');
        }
        
        // Save current sub-tab to localStorage
        localStorage.setItem('adminCurrentSubTab', targetSubTab);
      });
    });
    
    // Restore saved sub-tab or default to overview
    const savedSubTab = localStorage.getItem('adminCurrentSubTab') || 'overview';
    const savedSubTabElement = Array.from(subTabs).find(t => t.dataset.subtab === savedSubTab);
    if (savedSubTabElement) {
      savedSubTabElement.click();
    }
  }

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

  // Create authenticated fetch with CSRF support
  const authenticatedFetch = window.CsrfUtils.createAuthenticatedFetch(() => token);

  // Add click handlers to tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      switchToTab(targetTab);
    });
  });

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
    const loadingContainers = ['dashboardStats', 'recentActivity', 'operatorsList', 'kpiOverview', 'orderAnalytics', 'affiliatesList', 'systemConfigForm'];
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
    case 'affiliates':
      await loadAffiliates();
      break;
    case 'quickbooks':
      await loadQuickBooksTab();
      break;
    case 'config':
      await loadSystemConfig();
      break;
    }
  }

  // Load dashboard
  async function loadDashboard() {
    // Initialize sub-tabs
    initializeSubTabs();
    
    // Initialize date range toggle for KPIs
    initializeDateRangeToggle();
    
    try {
      // Load dashboard stats
      const dashboardResponse = await adminFetch('/api/v1/administrators/dashboard');
      const dashboardData = await dashboardResponse.json();

      if (dashboardResponse.ok && dashboardData.success) {
        renderDashboardStats(dashboardData.dashboard);
        renderRecentActivity(dashboardData.dashboard.recentActivity || []);
      } else {
        console.error('Dashboard data not loaded:', dashboardData.message);
        document.getElementById('dashboardStats').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.dashboardLoadFailed', 'Failed to load dashboard data')}</p>`;
      }
      
      // Load analytics data with default period
      const defaultPeriod = localStorage.getItem('analyticsPeriod') || 'month';
      await loadAnalyticsForDashboard(defaultPeriod);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      document.getElementById('dashboardStats').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.dashboardLoadFailed', 'Error loading dashboard')}</p>`;
    }
  }

  // Render dashboard stats
  function renderDashboardStats(data) {
    const dashboardElement = document.getElementById('dashboardStats');

    if (!data) {
      dashboardElement.innerHTML = `<p class="p-20 text-center text-muted">${t('common.messages.noData', 'No dashboard data available')}</p>`;
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
      document.getElementById('recentActivity').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.recentActivity.noActivity', 'No recent activity')}</p>`;
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
  
  // Initialize date range toggle for dashboard analytics
  function initializeDateRangeToggle() {
    const toggleButtons = document.querySelectorAll('.date-range-toggle .toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        // Update active state
        toggleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Get selected range and save it
        const range = btn.dataset.range;
        localStorage.setItem('analyticsPeriod', range);
        
        // Reload analytics with new date range
        await loadAnalyticsForDashboard(range);
      });
    });
  }
  
  // Load analytics data for dashboard
  async function loadAnalyticsForDashboard(range = 'month') {
    try {
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
        console.log('Orders data structure:', ordersData);
        // Render KPI overview in overview tab
        renderKPIOverview(ordersData);
        
        // Create analytics data for charts
        const analyticsData = {
          ...ordersData,
          dashboardData: dashboardData.dashboard,
          dateRange: range
        };
        
        // Store data for charts
        currentAnalyticsData = analyticsData;
        currentDashboardData = dashboardData.dashboard;
        
        // Render charts in charts tab
        renderAnalyticsCharts(analyticsData, dashboardData.dashboard);
        
        // Render detailed analytics in charts tab
        renderDetailedAnalytics(ordersData);
      }
    } catch (error) {
      console.error('Error loading analytics for dashboard:', error);
      document.getElementById('kpiOverview').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.analyticsLoadFailed', 'Error loading analytics data')}</p>`;
    }
  }
  
  // Render KPI overview
  function renderKPIOverview(data) {
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;
    
    // Handle both direct summary and nested analytics.summary structures
    const summary = data.summary || (data.analytics && data.analytics.summary) || {};
    
    // Provide default values if data is missing
    const totalOrders = summary.totalOrders || 0;
    const completedOrders = summary.completedOrders || 0;
    const totalRevenue = summary.totalRevenue || 0;
    const avgOrderValue = summary.averageOrderValue || summary.avgOrderValue || 0;
    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
    
    // Format revenue to 2 decimal places
    const formattedRevenue = totalRevenue.toFixed(2);
    
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
                <div class="stat-value">$${formattedRevenue}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.thisMonth')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.avgOrderValue')}</h3>
                <div class="stat-value">$${avgOrderValue.toFixed(2)}</div>
                <div class="stat-change">${t('administrator.dashboard.analytics.perOrder')}</div>
            </div>
        `;
    document.getElementById('kpiOverview').innerHTML = overviewHtml;
  }
  
  // Render detailed analytics table
  function renderDetailedAnalytics(data) {
    const analyticsContainer = document.getElementById('orderAnalytics');
    
    if (!data || !data.analytics || !data.analytics.ordersByStatus) {
      analyticsContainer.innerHTML = `<p class="p-20 text-center text-muted">${t('common.messages.noData', 'No analytics data available')}</p>`;
      return;
    }
    
    const ordersByStatus = data.analytics.ordersByStatus;
    const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>${t('administrator.dashboard.analytics.status', 'Status')}</th>
                        <th>${t('administrator.dashboard.analytics.count', 'Count')}</th>
                        <th>${t('administrator.dashboard.analytics.percentage', 'Percentage')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(ordersByStatus).map(([status, count]) => {
                      const percentage = data.summary.totalOrders > 0 
                        ? ((count / data.summary.totalOrders) * 100).toFixed(1)
                        : 0;
                      return `
                            <tr>
                                <td>${status}</td>
                                <td>${count}</td>
                                <td>${percentage}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    analyticsContainer.innerHTML = tableHtml;
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
        document.getElementById('operatorsList').innerHTML = '<p class="p-20 text-center text-muted">Error: Invalid response format</p>';
        return;
      }

      if (response.ok && data.success) {
        renderOperatorsList(data.operators);
      } else {
        console.error('Operators load failed:', data);
        const errorMsg = data.message || data.error || 'Failed to load operators';
        document.getElementById('operatorsList').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.operatorsLoadFailed', errorMsg)}</p>`;
      }
    } catch (error) {
      console.error('Error loading operators:', error);
      document.getElementById('operatorsList').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.operatorsLoadFailed', 'Error loading operators')}</p>`;
    }
  }

  // Render operators list
  function renderOperatorsList(operators) {
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;
    
    if (!operators || operators.length === 0) {
      document.getElementById('operatorsList').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.operators.noOperators', 'No operators found')}</p>`;
      return;
    }
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
        document.getElementById('customersList').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.customersLoadFailed', 'Failed to load customers')}</p>`;
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      document.getElementById('customersList').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.customersLoadFailed', 'Error loading customers')}</p>`;
    }
    
    // Setup event handlers for customers tab
    setupCustomersEventHandlers();
  }
  
  // Render customers list
  function renderCustomersList(customers) {
    if (!customers || customers.length === 0) {
      document.getElementById('customersList').innerHTML = `<p class="p-20 text-center text-muted">${t('administrator.dashboard.customers.noCustomers', 'No customers found')}</p>`;
      return;
    }
    
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th class="w-50px">
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
                  ${customer.businessName ? `<div class="text-sm text-muted">${customer.businessName}</div>` : ''}
                  <div class="text-sm text-light">${customer.customerId}</div>
                </td>
                <td>
                  <div>${customer.email}</div>
                  <div class="text-sm text-muted">${customer.phone}</div>
                </td>
                <td>
                  <div>${customer.address}</div>
                  <div class="text-sm text-muted">${customer.city}, ${customer.state} ${customer.zipCode}</div>
                </td>
                <td>
                  <div>${customer.orderCount || 0}</div>
                  <div class="text-sm text-muted">${t('administrator.dashboard.customers.joined', 'Joined')}: ${new Date(customer.createdAt).toLocaleDateString()}</div>
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
    
    // Print new customer labels button
    const printNewLabelsBtn = document.getElementById('printNewCustomerLabelsBtn');
    if (printNewLabelsBtn && !printNewLabelsBtn.hasAttribute('data-initialized')) {
      printNewLabelsBtn.setAttribute('data-initialized', 'true');
      printNewLabelsBtn.addEventListener('click', printNewCustomerLabels);
    }
    
    // Check for new customers on load and periodically
    checkNewCustomers();
    setInterval(checkNewCustomers, 30000); // Check every 30 seconds
    
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
      
      // Generate QR code data with customer ID and unique bag ID
      // Format: {customerId}#{bagId}
      const bagId = generateUUID();
      const qrData = `${customer.id}#${bagId}`;
      
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
    
    // Create a temporary anchor element to force download/open in full window
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.target = '_blank';
    link.download = filename;
    
    // Check if we're in an iframe - if so, notify parent to open in new window
    if (window.parent !== window) {
      // Send message to parent to open PDF
      window.parent.postMessage({
        type: 'open-pdf',
        url: pdfUrl,
        filename: filename
      }, '*');
      
      // Also try to open directly
      link.click();
    } else {
      // Not in iframe, open directly
      link.click();
    }
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
      link.remove();
    }, 1000); // Slightly longer delay to ensure download starts
    
    console.log(`Generated PDF with ${customers.length} customer cards`);
  }
  
  // Check for new customers without bag labels
  async function checkNewCustomers() {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await csrfFetch(`${BASE_URL}/api/operators/new-customers/count`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const printNewLabelsBtn = document.getElementById('printNewCustomerLabelsBtn');
        const newCustomerBadge = document.getElementById('newCustomerBadge');
        
        if (data.count > 0) {
          if (printNewLabelsBtn) {
            printNewLabelsBtn.style.display = 'inline-flex';
          }
          if (newCustomerBadge) {
            newCustomerBadge.textContent = data.count;
            newCustomerBadge.style.display = 'inline-block';
          }
        } else {
          if (printNewLabelsBtn) {
            printNewLabelsBtn.style.display = 'none';
          }
          if (newCustomerBadge) {
            newCustomerBadge.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.error('Error checking new customers:', error);
    }
  }
  
  // Print labels for new customers
  async function printNewCustomerLabels() {
    try {
      const printNewLabelsBtn = document.getElementById('printNewCustomerLabelsBtn');
      if (printNewLabelsBtn) {
        printNewLabelsBtn.disabled = true;
      }
      
      const token = localStorage.getItem('adminToken');
      const response = await csrfFetch(`${BASE_URL}/api/operators/print-new-customer-labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.labelsGenerated > 0) {
          // Check if print utilities are loaded
          if (!window.LabelPrintUtils || !window.LabelPrintUtils.generateAndPrintBagLabels) {
            alert('Print system not ready. Please refresh the page and try again.');
            return;
          }
          
          // Generate and download PDF
          await window.LabelPrintUtils.generateAndPrintBagLabels(data.labelData);
          
          // Confirm labels were printed
          await confirmLabelsPrinted(data.customerIds);
          
          // Refresh the customer count
          checkNewCustomers();
          
          // Show success message
          showNotification('success', `Successfully generated ${data.labelsGenerated} labels`);
        } else {
          showNotification('info', 'No new customers requiring bag labels');
        }
      } else {
        const errorData = await response.json();
        showNotification('error', errorData.message || 'Failed to generate labels');
      }
    } catch (error) {
      console.error('Error printing labels:', error);
      showNotification('error', 'An error occurred while printing labels');
    } finally {
      const printNewLabelsBtn = document.getElementById('printNewCustomerLabelsBtn');
      if (printNewLabelsBtn) {
        printNewLabelsBtn.disabled = false;
      }
    }
  }
  
  // Confirm that labels were printed successfully
  async function confirmLabelsPrinted(customerIds) {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await csrfFetch(`${BASE_URL}/api/operators/confirm-labels-printed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customerIds })
      });
      
      if (!response.ok) {
        throw new Error('Failed to confirm label printing');
      }
      
      const data = await response.json();
      console.log('Labels confirmed:', data);
      return data;
    } catch (error) {
      console.error('Error confirming labels:', error);
      throw error;
    }
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
    
    // Create a complete timeline with all days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    
    const completeTimeline = [];
    const dataMap = new Map(timeline.map(item => [item._id, item]));
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayData = dataMap.get(dateStr) || { _id: dateStr, totalRevenue: 0 };
      completeTimeline.push(dayData);
    }
    
    const labels = completeTimeline.map(item => {
      const date = new Date(item._id);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const revenues = completeTimeline.map(item => item.totalRevenue || 0);

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
    
    // Create a complete timeline with all days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    
    const completeTimeline = [];
    const dataMap = new Map(timeline.map(item => [item._id, item]));
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayData = dataMap.get(dateStr) || { _id: dateStr, averageProcessingTime: null };
      completeTimeline.push(dayData);
    }
    
    const labels = completeTimeline.map(item => {
      const date = new Date(item._id);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Calculate average processing time in hours for each day
    const avgProcessingTimes = completeTimeline.map(item => {
      if (item.averageProcessingTime === null || item.averageProcessingTime === 0) {
        return null; // Return null for days without data
      }
      const avgMinutes = item.averageProcessingTime;
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
          pointHoverRadius: 6,
          spanGaps: true // Connect lines across null values
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
  function renderOrderStatusChart(data, range = 'month') {
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
    
    // Create a complete timeline with all days
    const endDate = new Date();
    const startDate = new Date();
    
    // Determine the date range based on the data's date range
    const dateRange = data.dateRange || 'month';
    switch(dateRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
      default:
        startDate.setDate(startDate.getDate() - 30);
        break;
    }
    
    // Create a map of existing data
    const dataMap = new Map(timeline.map(item => [item._id, item]));
    
    // Build complete timeline
    const completeTimeline = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayData = dataMap.get(dateStr) || { 
        _id: dateStr, 
        totalOrders: 0,
        completedOrders: 0 
      };
      completeTimeline.push(dayData);
    }
    
    const labels = completeTimeline.map(item => {
      const date = new Date(item._id);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const totalOrders = completeTimeline.map(item => item.totalOrders || 0);
    const completedOrders = completeTimeline.map(item => item.completedOrders || 0);

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

      console.log('Affiliates API response:', data);
      
      if (response.ok && data.success) {
        // Check different possible data structures
        const affiliatesData = data.topAffiliates || 
                               (data.analytics && data.analytics.affiliates) || 
                               data.affiliates || 
                               data;
        renderAffiliatesList(affiliatesData);
      } else {
        console.error('Affiliates API error:', data);
        document.getElementById('affiliatesList').innerHTML = `
          <p class="p-20 text-center text-danger">
            ${data.message || t('administrator.dashboard.affiliates.loadError', 'Error loading affiliates')}
          </p>
        `;
      }
    } catch (error) {
      console.error('Error loading affiliates:', error);
      document.getElementById('affiliatesList').innerHTML = `
        <p class="p-20 text-center text-danger">
          ${t('administrator.dashboard.affiliates.loadError', 'Error loading affiliates')}
        </p>
      `;
    }
  }

  // Render affiliates list
  function renderAffiliatesList(affiliates) {
    if (!affiliates || affiliates.length === 0) {
      const noDataText = window.i18n ? window.i18n.t('administrator.dashboard.affiliates.noData') : 'No affiliate data available';
      document.getElementById('affiliatesList').innerHTML = `<p class="p-20 text-center text-muted">${noDataText}</p>`;
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
                        <th>${t('administrator.dashboard.affiliates.w9Status')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${affiliates.map(aff => {
                        // Handle different data structures
                        const name = aff.name || `${aff.firstName || ''} ${aff.lastName || ''}`.trim() || 'N/A';
                        const metrics = aff.metrics || aff;
                        const totalCustomers = metrics.totalCustomers || 0;
                        const totalOrders = metrics.totalOrders || 0;
                        const totalRevenue = metrics.totalRevenue || 0;
                        const totalCommission = metrics.totalCommission || 0;
                        const w9Status = aff.w9Status || 'not_submitted';
                        
                        // Determine W9 status display
                        let w9StatusDisplay = '';
                        if (w9Status === 'pending_review') {
                            w9StatusDisplay = '<span class="status-badge pending">Pending Review</span>';
                        } else if (w9Status === 'verified') {
                            w9StatusDisplay = '<span class="status-badge active">Verified</span>';
                        } else if (w9Status === 'rejected') {
                            w9StatusDisplay = '<span class="status-badge inactive">Rejected</span>';
                        } else if (w9Status === 'expired') {
                            w9StatusDisplay = '<span class="status-badge inactive">Expired</span>';
                        } else if (totalRevenue >= 600) {
                            // Show Send W9 button for affiliates with >$600 revenue and no W9
                            w9StatusDisplay = `
                                <span class="status-badge inactive">Not Submitted</span>
                                <button class="btn btn-sm btn-primary mt-1 send-w9-btn" 
                                        data-affiliate-id="${aff.affiliateId}" 
                                        data-email="${aff.email}" 
                                        data-name="${name}">
                                    Send W9
                                </button>
                            `;
                        } else {
                            w9StatusDisplay = '<span class="status-badge inactive">Not Required</span>';
                        }
                        
                        return `
                        <tr>
                            <td>${aff.affiliateId}</td>
                            <td>${name}</td>
                            <td>${totalCustomers}</td>
                            <td>${totalOrders}</td>
                            <td>$${totalRevenue.toFixed(2)}</td>
                            <td>$${totalCommission.toFixed(2)}</td>
                            <td>${w9StatusDisplay}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
    document.getElementById('affiliatesList').innerHTML = tableHtml;
    
    // Add event listeners for Send W9 buttons using event delegation
    // Only add once to prevent duplicate handlers
    const affiliatesContainer = document.getElementById('affiliatesList');
    if (!affiliatesContainer.hasAttribute('data-w9-handler')) {
      affiliatesContainer.setAttribute('data-w9-handler', 'true');
      affiliatesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('send-w9-btn')) {
          e.preventDefault();
          e.stopPropagation();
          
          // Prevent double-clicks
          if (e.target.disabled) return;
          
          const affiliateId = e.target.getAttribute('data-affiliate-id');
          const email = e.target.getAttribute('data-email');
          const name = e.target.getAttribute('data-name');
          await handleSendW9Click(affiliateId, email, name, e.target);
        }
      });
    }
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
                    <p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.exportHistoryLoadFailed', 'Failed to load export history')}</p>
                `;
      }
    } catch (error) {
      console.error('Error loading export history:', error);
      document.getElementById('exportHistoryList').innerHTML = `
                <p class="p-20 text-center text-muted">${t('administrator.dashboard.errors.exportHistoryLoadFailed', 'Error loading export history')}</p>
            `;
    }
  }

  // Render export history
  function renderExportHistory() {
    if (exportHistory.length === 0) {
      document.getElementById('exportHistoryList').innerHTML = `
                <p class="p-20 text-center text-muted">${t('administrator.dashboard.quickbooks.noExports', 'No exports found')}</p>
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
        const paymentModal = document.getElementById('paymentSummaryModal');
        if (paymentModal) {
          paymentModal.classList.remove('hidden');
          paymentModal.style.display = 'flex';
        }
      });
    }

    // Commission detail button
    const openCommissionDetailBtn = document.getElementById('openCommissionDetailBtn');
    if (openCommissionDetailBtn && !openCommissionDetailBtn.hasAttribute('data-initialized')) {
      openCommissionDetailBtn.setAttribute('data-initialized', 'true');
      openCommissionDetailBtn.addEventListener('click', () => {
        const commissionModal = document.getElementById('commissionDetailModal');
        if (commissionModal) {
          commissionModal.classList.remove('hidden');
          commissionModal.style.display = 'flex';
        }
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
      resultsDiv.innerHTML = `<div class="p-10 text-muted">${t('administrator.dashboard.quickbooks.noAffiliatesFound', 'No affiliates found')}</div>`;
    } else {
      resultsDiv.innerHTML = affiliateSearchResults.map(affiliate => `
                <div class="p-10 clickable border-bottom" 
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
    const paymentModal = document.getElementById('paymentSummaryModal');
    if (paymentModal) {
      paymentModal.style.display = 'none';
      paymentModal.classList.add('hidden');
    }
    document.getElementById('paymentSummaryForm').reset();
  };

  window.closeCommissionDetailModal = function() {
    const commissionModal = document.getElementById('commissionDetailModal');
    if (commissionModal) {
      commissionModal.style.display = 'none';
      commissionModal.classList.add('hidden');
    }
    document.getElementById('commissionDetailForm').reset();
    document.getElementById('detailAffiliateId').value = '';
    document.getElementById('selectedAffiliate').style.display = 'none';
    document.getElementById('affiliateSearchResults').style.display = 'none';
  };


  // Load system config
  async function loadSystemConfig() {
    // Set up sub-tab handlers for config tab
    setupConfigSubTabs();
    
    // Load system settings by default
    await loadSystemSettings();
  }

  // Set up config sub-tab handlers
  function setupConfigSubTabs() {
    const subTabButtons = document.querySelectorAll('#config-tab .sub-nav-tab');
    subTabButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        // Remove active class from all sub-tabs and sub-tab contents
        document.querySelectorAll('#config-tab .sub-nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('#config-tab .sub-tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab
        button.classList.add('active');
        
        // Show corresponding sub-tab content
        const subtab = button.getAttribute('data-subtab');
        const subtabContent = document.getElementById(`${subtab}-subtab`);
        if (subtabContent) {
          subtabContent.classList.add('active');
        }
        
        // Load appropriate content
        if (subtab === 'system-settings') {
          await loadSystemSettings();
        } else if (subtab === 'env-variables') {
          await loadEnvironmentVariables();
        }
      });
    });
  }

  // Load system settings
  async function loadSystemSettings() {
    try {
      const response = await adminFetch('/api/v1/administrators/config');
      const data = await response.json();

      console.log('System config response:', data);
      
      if (response.ok) {
        // Check if data has configurations or configs array, or if data itself is the array
        const configs = data.configurations || data.configs || data;
        renderSystemConfig(configs);
      } else {
        console.error('Config API error:', data);
        document.getElementById('systemConfig').innerHTML = `
          <p class="p-20 text-center text-danger">
            ${data.message || t('administrator.dashboard.config.loadError', 'Error loading configuration')}
          </p>
        `;
      }
    } catch (error) {
      console.error('Error loading system config:', error);
      document.getElementById('systemConfig').innerHTML = `
        <p class="p-20 text-center text-danger">
          ${t('administrator.dashboard.config.loadError', 'Error loading configuration')}
        </p>
      `;
    }
  }

  // Load environment variables
  async function loadEnvironmentVariables() {
    const container = document.getElementById('envVariables');
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>${t('administrator.dashboard.config.loadingEnv', 'Loading environment variables...')}</p>
      </div>
    `;

    try {
      const response = await adminFetch('/api/v1/administrators/env-variables');
      const data = await response.json();

      if (response.ok) {
        renderEnvironmentVariables(data.variables || data, data.sensitiveValues || {}, data.isSuperAdmin || false);
      } else {
        container.innerHTML = `
          <p class="p-20 text-center text-danger">
            ${data.message || t('administrator.dashboard.config.envLoadError', 'Error loading environment variables')}
          </p>
        `;
      }
    } catch (error) {
      console.error('Error loading environment variables:', error);
      container.innerHTML = `
        <p class="p-20 text-center text-danger">
          ${t('administrator.dashboard.config.envLoadError', 'Error loading environment variables')}
        </p>
      `;
    }
  }

  // Render environment variables
  function renderEnvironmentVariables(variables, sensitiveValues, isSuperAdmin) {
    const container = document.getElementById('envVariables');
    
    if (!variables || Object.keys(variables).length === 0) {
      container.innerHTML = `
        <p class="p-20 text-center text-muted">
          ${t('administrator.dashboard.config.noEnvVars', 'No environment variables found')}
        </p>
      `;
      return;
    }

    // Store sensitive values for toggle functionality
    window.envSensitiveValues = sensitiveValues || {};
    window.envVisibleStates = {};

    // Group variables by category
    const categories = {
      'Application': ['NODE_ENV', 'PORT', 'BASE_URL', 'FRONTEND_URL', 'BACKEND_URL', 'CORS_ORIGIN', 'OAUTH_CALLBACK_URI', 'TRUST_PROXY', 'COOKIE_SECURE'],
      'Database': ['MONGODB_URI'],
      'Security & Authentication': ['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY'],
      'Email': ['EMAIL_PROVIDER', 'EMAIL_FROM', 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_SECURE'],
      'DocuSign': ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_BASE_URL', 'DOCUSIGN_OAUTH_BASE_URL', 'DOCUSIGN_CLIENT_SECRET', 'DOCUSIGN_REDIRECT_URI', 'DOCUSIGN_PRIVATE_KEY', 'DOCUSIGN_WEBHOOK_SECRET', 'DOCUSIGN_W9_TEMPLATE_ID'],
      'Payment - Paygistix': ['PAYGISTIX_MERCHANT_ID', 'PAYGISTIX_FORM_ID', 'PAYGISTIX_FORM_HASH', 'PAYGISTIX_FORM_ACTION_URL', 'PAYGISTIX_RETURN_URL', 'PAYGISTIX_ENVIRONMENT'],
      'AWS (Optional)': ['AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
      'Stripe (Deprecated)': ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY'],
      'Features': ['SHOW_DOCS', 'ENABLE_TEST_PAYMENT_FORM', 'ENABLE_DELETE_DATA_FEATURE', 'CSRF_PHASE', 'RELAX_RATE_LIMITING'],
      'Rate Limiting': ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS', 'AUTH_RATE_LIMIT_MAX'],
      'Social Login': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      'Logging': ['LOG_LEVEL', 'LOG_DIR'],
      'Business Configuration': ['BAG_FEE'],
      'Default Accounts': ['DEFAULT_ADMIN_EMAIL'],
      'Other': []
    };

    // Sort variables into categories
    const sortedVars = {};
    Object.keys(variables).forEach(key => {
      let placed = false;
      for (const [category, patterns] of Object.entries(categories)) {
        if (category !== 'Other' && patterns.some(pattern => key.includes(pattern))) {
          if (!sortedVars[category]) sortedVars[category] = {};
          sortedVars[category][key] = variables[key];
          placed = true;
          break;
        }
      }
      if (!placed) {
        if (!sortedVars['Other']) sortedVars['Other'] = {};
        sortedVars['Other'][key] = variables[key];
      }
    });

    let html = '<div class="p-20">';
    
    if (isSuperAdmin) {
      html += `
        <div class="alert alert-warning mb-20">
          <p class="m-0 text-warning-dark">
            <strong>Super Admin Mode:</strong> You can view sensitive values by clicking the eye icon next to masked values.
          </p>
        </div>
      `;
    }
    
    for (const [category, vars] of Object.entries(sortedVars)) {
      if (Object.keys(vars).length === 0) continue;
      
      html += `
        <div class="form-section">
          <h3 class="section-title">${category}</h3>
          <table class="w-100 table-collapsed">
            <thead>
              <tr class="bg-light">
                <th class="p-10 text-left border-bottom-2">Variable</th>
                <th class="p-10 text-left border-bottom-2">Value</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      for (const [key, value] of Object.entries(vars)) {
        const isSensitive = key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY') || key.includes('TOKEN');
        const hasSensitiveValue = isSuperAdmin && sensitiveValues[key];
        
        // Mask sensitive values
        let displayValue = value;
        if (isSensitive && value) {
          displayValue = '••••••••';
        } else if (!value) {
          displayValue = '(not set)';
        }
        
        html += `
          <tr>
            <td class="p-8 border-bottom font-mono text-sm">${key}</td>
            <td class="p-8 border-bottom font-mono text-sm">
              <div class="d-flex align-center gap-10">
                <span id="env-value-${key}" class="${value ? 'text-dark' : 'text-muted'}">${displayValue}</span>
                ${hasSensitiveValue ? `
                  <button 
                    type="button" 
                    class="btn btn-sm" 
                    onclick="toggleEnvValue('${key}')"
                    class="btn btn-sm btn-secondary"
                    title="Toggle visibility"
                  >
                    <span id="env-toggle-icon-${key}">👁️</span>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }
      
      html += `
            </tbody>
          </table>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Set up refresh button handler
    const refreshBtn = document.getElementById('refreshEnvBtn');
    if (refreshBtn) {
      refreshBtn.onclick = () => loadEnvironmentVariables();
    }
  }

  // Toggle environment variable visibility
  window.toggleEnvValue = function(key) {
    const valueSpan = document.getElementById(`env-value-${key}`);
    const iconSpan = document.getElementById(`env-toggle-icon-${key}`);
    
    if (!valueSpan || !window.envSensitiveValues[key]) return;
    
    // Toggle visibility state
    window.envVisibleStates[key] = !window.envVisibleStates[key];
    
    if (window.envVisibleStates[key]) {
      // Show actual value
      valueSpan.textContent = window.envSensitiveValues[key];
      iconSpan.textContent = '🙈';
    } else {
      // Hide value
      valueSpan.textContent = '••••••••';
      iconSpan.textContent = '👁️';
    }
  };

  // Render system config
  function renderSystemConfig(configs) {
    // Check if configs is valid
    if (!configs || !Array.isArray(configs)) {
      document.getElementById('systemConfig').innerHTML = `
        <p class="p-20 text-center text-muted">
          ${t('administrator.dashboard.config.noConfigData', 'No configuration data available')}
        </p>
      `;
      return;
    }
    
    const groupedConfigs = configs.reduce((acc, config) => {
      if (!acc[config.category]) acc[config.category] = [];
      acc[config.category].push(config);
      return acc;
    }, {});

    let configHtml = '<form id="configForm" class="p-20">';

    for (const [category, items] of Object.entries(groupedConfigs)) {
      configHtml += `
        <div class="form-section">
          <h3 class="section-title text-capitalize">${category}</h3>
          <div class="form-row">
      `;

      items.forEach((config, index) => {
        // Use full width for textareas (object/array types)
        const isFullWidth = config.dataType === 'object' || config.dataType === 'array';
        
        if (isFullWidth && index % 2 === 1) {
          // Close the current row and start a new one for full-width items
          configHtml += '</div><div class="form-row">';
        }
        
        configHtml += `<div class="form-group ${isFullWidth ? 'full-width' : ''}">`;
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
          configHtml += `<textarea id="config_${config.key}" name="${config.key}" data-type="${config.dataType}" rows="3" class="font-mono text-xs">${JSON.stringify(config.value, null, 2)}</textarea>`;
        } else {
          configHtml += `<input type="text" id="config_${config.key}" name="${config.key}" value="${config.value}" data-type="${config.dataType}">`;
        }

        configHtml += '</div>';
        
        if (isFullWidth && index < items.length - 1) {
          // Start a new row after full-width items
          configHtml += '</div><div class="form-row">';
        }
      });
      
      configHtml += `
          </div>
        </div>
      `;
    }

    configHtml += '</form>';
    
    // Add DocuSign Authorization section
    configHtml += `
      <div class="docusign-auth-section mt-40 p-20 border rounded bg-light">
        <h3 class="m-0 mb-15">${t('administrator.dashboard.config.docusignTitle', 'DocuSign Integration')}</h3>
        <p class="mb-15">${t('administrator.dashboard.config.docusignDesc', 'Authorize DocuSign to enable W9 form sending to affiliates.')}</p>
        <div id="docusignAuthStatus" class="mb-15">
          <span class="spinner d-inline-block mr-10"></span>
          ${t('administrator.dashboard.config.checkingAuth', 'Checking authorization status...')}
        </div>
        <button id="authorizeDocuSignBtn" class="btn btn-primary d-none">
          ${t('administrator.dashboard.config.authorizeDocuSign', 'Authorize DocuSign')}
        </button>
      </div>
    `;
    
    document.getElementById('systemConfig').innerHTML = configHtml;
    
    // Check DocuSign authorization status
    checkDocuSignAuth();
  }

  // Check DocuSign authorization status
  async function checkDocuSignAuth() {
    try {
      const response = await adminFetch('/api/v1/w9/check-auth');
      const data = await response.json();
      
      const statusDiv = document.getElementById('docusignAuthStatus');
      const authBtn = document.getElementById('authorizeDocuSignBtn');
      
      if (data.authorized) {
        statusDiv.innerHTML = `
          <span class="text-success">✓</span> 
          ${t('administrator.dashboard.config.docusignAuthorized', 'DocuSign is authorized and ready to use.')}
        `;
        authBtn.style.display = 'none';
      } else {
        statusDiv.innerHTML = `
          <span class="text-danger">✗</span> 
          ${t('administrator.dashboard.config.docusignNotAuthorized', 'DocuSign is not authorized. Click the button below to authorize.')}
        `;
        authBtn.style.display = 'inline-block';
        
        // Store authorization URL and state
        authBtn.dataset.authUrl = data.authorizationUrl;
        authBtn.dataset.authState = data.state;
        
        // Add click handler
        authBtn.onclick = () => authorizeDocuSign(data.authorizationUrl, data.state);
      }
    } catch (error) {
      console.error('Error checking DocuSign auth:', error);
      const statusDiv = document.getElementById('docusignAuthStatus');
      statusDiv.innerHTML = `
        <span class="text-danger">✗</span> 
        ${t('administrator.dashboard.config.docusignCheckError', 'Error checking authorization status.')}
      `;
    }
  }
  
  // Authorize DocuSign
  function authorizeDocuSign(authUrl, state) {
    // Open DocuSign authorization in a new window
    const authWindow = window.open(authUrl, 'DocuSignAuth', 'width=600,height=700');
    
    // Store state for verification
    localStorage.setItem('docusign-auth-state', state);
    
    // Poll for completion
    const pollInterval = setInterval(async () => {
      // Check if window is closed
      if (authWindow.closed) {
        clearInterval(pollInterval);
        
        // Check if authorization was successful
        const storedAuth = localStorage.getItem('docusign-auth-success');
        if (storedAuth) {
          const authData = JSON.parse(storedAuth);
          if (authData.state === state) {
            // Authorization successful
            localStorage.removeItem('docusign-auth-success');
            localStorage.removeItem('docusign-auth-state');
            
            // Recheck authorization status
            await checkDocuSignAuth();
            
            alert(t('administrator.dashboard.config.docusignAuthSuccess', 'DocuSign authorization successful!'));
          }
        }
      }
      
      // Also check authorization status periodically
      try {
        const response = await adminFetch('/api/v1/w9/authorization-status');
        const data = await response.json();
        if (data.authorized) {
          clearInterval(pollInterval);
          if (!authWindow.closed) authWindow.close();
          await checkDocuSignAuth();
          alert(t('administrator.dashboard.config.docusignAuthSuccess', 'DocuSign authorization successful!'));
        }
      } catch (error) {
        // Ignore errors during polling
      }
    }, 2000);
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

  // Handle Send W9 button click
  async function handleSendW9Click(affiliateId, email, name, button) {
    try {
      const confirmMessage = t('administrator.dashboard.affiliates.confirmSendW9', 
        `Send W9 form to ${name} at ${email}?`);
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Show loading state
      button.disabled = true;
      button.textContent = t('administrator.dashboard.affiliates.sending', 'Sending...');
      
      const response = await adminFetch('/api/v1/w9/send-docusign', {
        method: 'POST',
        body: JSON.stringify({ affiliateId })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        alert(t('administrator.dashboard.affiliates.w9Sent', 'W9 form sent successfully!'));
        // Reload the affiliates table to update status
        await loadAffiliates();
      } else {
        // Show more specific error message based on response
        let errorMessage = data.message || t('administrator.dashboard.affiliates.w9SendFailed', 'Failed to send W9 form');
        
        // Add specific guidance for common errors
        if (response.status === 401 || data.error === 'Authorization required') {
          errorMessage = t('administrator.dashboard.affiliates.docusignAuthRequired', 
            'DocuSign authorization required. Please authorize DocuSign integration in system settings.');
        } else if (data.error === 'Template configuration error') {
          errorMessage = t('administrator.dashboard.affiliates.docusignTemplateError', 
            'DocuSign W9 template not configured. Please check template ID in system settings.');
        }
        
        alert(errorMessage);
        // Re-enable button
        button.disabled = false;
        button.textContent = t('administrator.dashboard.affiliates.sendW9', 'Send W9');
      }
    } catch (error) {
      console.error('Error sending W9:', error);
      alert(t('administrator.dashboard.affiliates.w9SendError', 'Error sending W9 form. Please try again.'));
      // Re-enable button
      if (button) {
        button.disabled = false;
        button.textContent = t('administrator.dashboard.affiliates.sendW9', 'Send W9');
      }
    }
  }

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
    
    // Select affiliate link
    if (e.target.closest('.select-affiliate-link')) {
      const link = e.target.closest('.select-affiliate-link');
      const affiliateId = link.getAttribute('data-affiliate-id');
      const affiliateName = link.getAttribute('data-affiliate-name');
      selectAffiliate(affiliateId, affiliateName);
    }
  });
  
  // Hover effect for affiliate search items is now handled in CSS file

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
    
    // Handle tab restore messages from browser navigation
    if (event.data && event.data.type === 'restore-tab' && event.data.tab) {
      console.log('[Admin Dashboard] Restoring tab from browser navigation:', event.data.tab);
      // Don't update history when restoring from popstate
      switchToTab(event.data.tab, false);
    }
  });
  
  // Modal functions (moved from inline event handlers)
  window.closePaymentSummaryModal = function() {
    const modal = document.getElementById('paymentSummaryModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  };

  window.closeCommissionDetailModal = function() {
    const modal = document.getElementById('commissionDetailModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  };

  window.closeLogoutModal = function() {
    const modal = document.getElementById('logoutModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  };

  window.confirmLogout = function() {
    // Clear admin session
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('adminData');
    
    // Clear session if SessionManager is available
    if (window.SessionManager) {
      window.SessionManager.logout('administrator');
    }
    
    // Redirect to login
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'navigate',
        data: { page: '/administrator-login' }
      }, '*');
    } else {
      window.location.href = '/embed-app-v2.html?route=/administrator-login';
    }
  };

  // Add event listeners for modal buttons
  document.addEventListener('DOMContentLoaded', function() {
    // Payment Summary Modal
    const closePaymentSummaryBtn = document.getElementById('closePaymentSummaryModal');
    if (closePaymentSummaryBtn) {
      closePaymentSummaryBtn.addEventListener('click', window.closePaymentSummaryModal);
    }
    
    const cancelPaymentSummaryBtn = document.getElementById('cancelPaymentSummaryModal');
    if (cancelPaymentSummaryBtn) {
      cancelPaymentSummaryBtn.addEventListener('click', window.closePaymentSummaryModal);
    }

    // Commission Detail Modal
    const closeCommissionDetailBtn = document.getElementById('closeCommissionDetailModal');
    if (closeCommissionDetailBtn) {
      closeCommissionDetailBtn.addEventListener('click', window.closeCommissionDetailModal);
    }
    
    const cancelCommissionDetailBtn = document.getElementById('cancelCommissionDetailModal');
    if (cancelCommissionDetailBtn) {
      cancelCommissionDetailBtn.addEventListener('click', window.closeCommissionDetailModal);
    }

    // Logout Modal
    const closeLogoutBtn = document.getElementById('closeLogoutModal');
    if (closeLogoutBtn) {
      closeLogoutBtn.addEventListener('click', window.closeLogoutModal);
    }
    
    const cancelLogoutBtn = document.getElementById('cancelLogoutModal');
    if (cancelLogoutBtn) {
      cancelLogoutBtn.addEventListener('click', window.closeLogoutModal);
    }
    
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener('click', window.confirmLogout);
    }

    // Click outside modal to close
    const modals = ['paymentSummaryModal', 'commissionDetailModal', 'logoutModal'];
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
          }
        });
      }
    });
  });

  // Initialize i18n and language switcher (moved from inline script)
  document.addEventListener('DOMContentLoaded', async function() {
    await window.i18n.init({ debugMode: false });
    
    // Only create language switcher if container exists
    if (document.getElementById('language-switcher-container')) {
      window.LanguageSwitcher.createSwitcher('language-switcher-container', {
        style: 'dropdown',
        showLabel: false
      });
    }
  });

  // Initialize the dashboard by loading the default tab
  // Check URL for tab parameter first, then localStorage, then default
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get('tab');
  const savedTab = urlTab || localStorage.getItem('adminCurrentTab') || 'dashboard';
  switchToTab(savedTab);
})();