(function() {
    'use strict';

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

    if (!token) {
        window.location.href = '/administrator-login-embed.html';
        return;
    }

    // Update user info
    document.getElementById('userName').textContent = `${adminData.firstName} ${adminData.lastName}`;

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

    // Load tab data
    async function loadTabData(tab) {
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

            if (response.ok) {
                renderDashboardStats(data);
                renderRecentActivity(data.recentActivity);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    // Render dashboard stats
    function renderDashboardStats(data) {
        const statsHtml = `
            <div class="stat-card">
                <h3>Active Operators</h3>
                <div class="stat-value">${data.operators.active}</div>
                <div class="stat-change">Total: ${data.operators.total}</div>
            </div>
            <div class="stat-card">
                <h3>Today's Orders</h3>
                <div class="stat-value">${data.orders.today}</div>
                <div class="stat-change ${data.orders.todayChange < 0 ? 'negative' : ''}">
                    ${data.orders.todayChange > 0 ? '+' : ''}${data.orders.todayChange}% vs yesterday
                </div>
            </div>
            <div class="stat-card">
                <h3>Processing Time</h3>
                <div class="stat-value">${data.metrics.avgProcessingTime}m</div>
                <div class="stat-change">Target: ${data.metrics.targetProcessingTime}m</div>
            </div>
            <div class="stat-card">
                <h3>Quality Score</h3>
                <div class="stat-value">${data.metrics.qualityScore}%</div>
                <div class="stat-change ${data.metrics.qualityScore < 85 ? 'negative' : ''}">
                    Target: 85%
                </div>
            </div>
        `;
        document.getElementById('dashboardStats').innerHTML = statsHtml;
    }

    // Render recent activity
    function renderRecentActivity(activities) {
        if (!activities || activities.length === 0) {
            document.getElementById('recentActivity').innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No recent activity</p>';
            return;
        }

        const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>User</th>
                        <th>Action</th>
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

            if (response.ok) {
                renderOperatorsList(data.operators);
            }
        } catch (error) {
            console.error('Error loading operators:', error);
        }
    }

    // Render operators list
    function renderOperatorsList(operators) {
        if (!operators || operators.length === 0) {
            document.getElementById('operatorsList').innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No operators found</p>';
            return;
        }

        const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Employee ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Shift</th>
                        <th>Status</th>
                        <th>Actions</th>
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
                                    ${op.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm" onclick="editOperator('${op._id}')">Edit</button>
                                <button class="btn btn-sm btn-secondary" onclick="resetPin('${op._id}')">Reset PIN</button>
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
        const overviewHtml = `
            <div class="stat-card">
                <h3>Total Orders</h3>
                <div class="stat-value">${data.summary.totalOrders}</div>
                <div class="stat-change">This week</div>
            </div>
            <div class="stat-card">
                <h3>Completed</h3>
                <div class="stat-value">${data.summary.completedOrders}</div>
                <div class="stat-change">${Math.round((data.summary.completedOrders / data.summary.totalOrders) * 100)}% completion rate</div>
            </div>
            <div class="stat-card">
                <h3>Revenue</h3>
                <div class="stat-value">$${data.summary.totalRevenue.toFixed(2)}</div>
                <div class="stat-change">This week</div>
            </div>
            <div class="stat-card">
                <h3>Avg Order Value</h3>
                <div class="stat-value">$${data.summary.avgOrderValue.toFixed(2)}</div>
                <div class="stat-change">Per order</div>
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
            document.getElementById('affiliatesList').innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No affiliate data available</p>';
            return;
        }

        const tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Affiliate ID</th>
                        <th>Name</th>
                        <th>Customers</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                        <th>Commission</th>
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
                    configHtml += `
                        <select id="config_${config.key}" name="${config.key}" data-type="${config.dataType}">
                            <option value="true" ${config.value === true ? 'selected' : ''}>Enabled</option>
                            <option value="false" ${config.value === false ? 'selected' : ''}>Disabled</option>
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
        document.getElementById('operatorModalTitle').textContent = 'Add Operator';
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
                alert(editingOperatorId ? 'Operator updated successfully' : 'Operator created successfully');
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to save operator');
            }
        } catch (error) {
            console.error('Error saving operator:', error);
            alert('Network error. Please try again.');
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
                        alert(`Invalid JSON for ${input.name}`);
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
                alert('Configuration saved successfully');
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Network error. Please try again.');
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
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
                document.getElementById('operatorModalTitle').textContent = 'Edit Operator';
                
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
            alert('Failed to load operator details');
        }
    };

    window.resetPin = async (operatorId) => {
        if (!confirm('Reset PIN for this operator? They will receive a new PIN via email.')) {
            return;
        }

        try {
            const response = await adminFetch(`/api/v1/administrators/operators/${operatorId}/reset-pin`, {
                method: 'POST',
                body: JSON.stringify({})
            });

            if (response.ok) {
                alert('PIN reset successfully. New PIN has been sent to the operator.');
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to reset PIN');
            }
        } catch (error) {
            console.error('Error resetting PIN:', error);
            alert('Network error. Please try again.');
        }
    };

    // Load initial data
    loadDashboard();
})();