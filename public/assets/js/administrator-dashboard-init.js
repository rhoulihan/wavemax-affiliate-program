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
                <h3>${t('administrator.dashboard.stats.processingTime', 'Processing Time')}</h3>
                <div class="stat-value">${avgProcessingTime}${t('administrator.dashboard.stats.minutes', 'm')}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.target', 'Target')}: 60${t('administrator.dashboard.stats.minutes', 'm')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.stats.pendingOrders', 'Pending Orders')}</h3>
                <div class="stat-value">${systemHealth.pendingOrders || 0}</div>
                <div class="stat-change ${systemHealth.processingDelays > 0 ? 'negative' : ''}">
                    ${t('administrator.dashboard.stats.delays', 'Delays')}: ${systemHealth.processingDelays || 0}
                </div>
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
            const data = await response.json();

            if (response.ok && data.success) {
                renderOperatorsList(data.operators);
            } else {
                document.getElementById('operatorsList').innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">${t('administrator.dashboard.errors.operatorsLoadFailed', 'Failed to load operators')}</p>`;
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
                            <td>${op.employeeId}</td>
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

    // Load analytics
    async function loadAnalytics() {
        try {
            const response = await adminFetch('/api/v1/administrators/analytics/orders?period=week');
            const data = await response.json();

            if (response.ok) {
                renderAnalyticsOverview(data);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    // Render analytics overview
    function renderAnalyticsOverview(data) {
        const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;
        const overviewHtml = `
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.totalOrders')}</h3>
                <div class="stat-value">${data.summary.totalOrders}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.thisWeek')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.completed')}</h3>
                <div class="stat-value">${data.summary.completedOrders}</div>
                <div class="stat-change">${Math.round((data.summary.completedOrders / data.summary.totalOrders) * 100)}% ${t('administrator.dashboard.analytics.completionRate')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.revenue')}</h3>
                <div class="stat-value">$${data.summary.totalRevenue.toFixed(2)}</div>
                <div class="stat-change">${t('administrator.dashboard.stats.thisWeek')}</div>
            </div>
            <div class="stat-card">
                <h3>${t('administrator.dashboard.analytics.avgOrderValue')}</h3>
                <div class="stat-value">$${data.summary.avgOrderValue.toFixed(2)}</div>
                <div class="stat-change">${t('administrator.dashboard.analytics.perOrder')}</div>
            </div>
        `;
        document.getElementById('analyticsOverview').innerHTML = overviewHtml;
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

    document.getElementById('addOperatorBtn').addEventListener('click', () => {
        editingOperatorId = null;
        const titleText = window.i18n ? window.i18n.t('administrator.dashboard.operators.addOperator') : 'Add Operator';
        document.getElementById('operatorModalTitle').textContent = titleText;
        operatorForm.reset();
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
            phone: formData.get('phone'),
            shiftStart: formData.get('shiftStart'),
            shiftEnd: formData.get('shiftEnd'),
            specializations: formData.getAll('specializations')
        };

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
                
                // Fill form with operator data
                document.getElementById('firstName').value = data.operator.firstName;
                document.getElementById('lastName').value = data.operator.lastName;
                document.getElementById('email').value = data.operator.email;
                document.getElementById('phone').value = data.operator.phone;
                document.getElementById('shiftStart').value = data.operator.shiftStart;
                document.getElementById('shiftEnd').value = data.operator.shiftEnd;
                
                // Set specializations
                document.querySelectorAll('input[name="specializations"]').forEach(checkbox => {
                    checkbox.checked = data.operator.specializations.includes(checkbox.value);
                });
                
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
        
        // Update dynamic content in the active tab
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('data-tab');
            loadTabData(tabName);
        }
    });
})();