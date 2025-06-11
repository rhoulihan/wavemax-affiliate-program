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

    // Redirect to login if no token or if password change is still required
    if (!token || requirePasswordChange === 'true') {
        // Clear everything and redirect to login
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminRefreshToken');
        localStorage.removeItem('adminData');
        localStorage.removeItem('requirePasswordChange');
        window.location.href = '/administrator-login-embed.html';
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
                
                // Redirect to login
                window.location.href = '/administrator-login-embed.html';
            }
        });
    }

    // Tab navigation
    const tabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update active states
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Load tab data
            loadTabData(targetTab);
        });
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
            case 'analytics':
                await loadAnalytics();
                break;
            case 'affiliates':
                await loadAffiliates();
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
                <h3>${t('administrator.dashboard.stats.todaysOrders', "Today's Orders")}</h3>
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
                document.getElementById('operatorsList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">Error: Invalid response format</p>`;
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
                                <button class="btn btn-sm" onclick="editOperator('${op._id}')">${t('administrator.dashboard.operators.edit')}</button>
                                <button class="btn btn-sm btn-secondary" onclick="resetPin('${op._id}')">${t('administrator.dashboard.operators.resetPin')}</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        document.getElementById('operatorsList').innerHTML = tableHtml;
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
                configHtml += `<div class="form-group">`;
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
                
                configHtml += `</div>`;
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
    
    // Load initial data
    removeLoadingSpinners();
    loadDashboard();

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
        
        // Update dynamic content in the active tab
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('data-tab');
            loadTabData(tabName);
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