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
  const token = localStorage.getItem('operatorToken');
  const operatorData = JSON.parse(localStorage.getItem('operatorData') || '{}');

  if (!token) {
    window.location.href = '/operator-login-embed.html';
    return;
  }

  // State
  let shiftStartTime = Date.now();
  let currentFilter = 'all';
  let myActiveOrders = [];
  let availableOrders = [];
  let selectedOrderId = null;
  let currentOrderStatus = null;

  // Create authenticated fetch with CSRF support
  const authenticatedFetch = window.CsrfUtils.createAuthenticatedFetch(() => token);

  // Wrapper to handle 401 responses
  async function operatorFetch(url, options = {}) {
    // Add base URL and ensure headers
    const fullUrl = `${BASE_URL}${url}`;
    options.headers = options.headers || {};
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';

    const response = await authenticatedFetch(fullUrl, options);

    if (response.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('operatorToken');
      localStorage.removeItem('operatorRefreshToken');
      localStorage.removeItem('operatorData');
      window.location.href = '/operator-login-embed.html';
      return;
    }

    return response;
  }

  // Update shift timer
  function updateShiftTimer() {
    const elapsed = Date.now() - shiftStartTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    document.getElementById('shiftTimer').textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  setInterval(updateShiftTimer, 1000);

  // Load dashboard data
  async function loadDashboard() {
    try {
      const response = await operatorFetch('/api/v1/operators/dashboard');
      const data = await response.json();

      if (response.ok) {
        // Update operator info
        document.getElementById('workstationInfo').textContent =
                    `Workstation: ${data.operator.workStation || 'Not Assigned'}`;

        // Update stats
        document.getElementById('todayOrders').textContent = data.todayStats.totalOrders;
        document.getElementById('avgTime').textContent = `${Math.round(data.todayStats.avgProcessingTime || 0)}m`;
        document.getElementById('qualityScore').textContent = `${data.performance.qualityScore || 0}%`;
        document.getElementById('activeOrders').textContent = data.currentShiftOrders.length;

        // Update my orders
        myActiveOrders = data.currentShiftOrders;
        renderMyOrders();

        // Load available orders
        await loadOrderQueue();
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  // Load order queue
  async function loadOrderQueue() {
    try {
      const response = await operatorFetch('/api/v1/operators/orders/queue?status=pending');
      const data = await response.json();

      if (response.ok) {
        availableOrders = data.orders;
        renderOrderQueue();
      }
    } catch (error) {
      console.error('Error loading order queue:', error);
    }
  }

  // Render my orders
  function renderMyOrders() {
    const container = document.getElementById('myOrders');

    if (myActiveOrders.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <p>No active orders</p>
                </div>
            `;
      return;
    }

    container.innerHTML = myActiveOrders.map(order => `
            <div class="order-card my-order" data-order-id="${order._id}">
                <div class="order-header">
                    <span class="order-number">#${order.orderNumber}</span>
                    <span class="order-priority priority-${order.priority || 'standard'}">${order.priority || 'Standard'}</span>
                </div>
                ${renderProcessStatus(order.orderProcessingStatus)}
                <div class="order-details">
                    <div><strong>Customer:</strong> ${order.customer.firstName} ${order.customer.lastName}</div>
                    <div><strong>Weight:</strong> ${order.weight} lbs</div>
                    <div><strong>Items:</strong> ${order.items?.join(', ') || 'Standard wash'}</div>
                </div>
                <div class="order-actions">
                    ${getOrderActions(order)}
                </div>
            </div>
        `).join('');

    // Add event listeners
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', handleOrderAction);
    });
  }

  // Render order queue
  function renderOrderQueue() {
    const container = document.getElementById('orderQueue');

    // Filter orders
    let filteredOrders = availableOrders;
    if (currentFilter !== 'all') {
      filteredOrders = availableOrders.filter(order =>
        (order.priority || 'standard') === currentFilter
      );
    }

    if (filteredOrders.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>No available orders</p>
                </div>
            `;
      return;
    }

    container.innerHTML = filteredOrders.map(order => `
            <div class="order-card" data-order-id="${order._id}">
                <div class="order-header">
                    <span class="order-number">#${order.orderNumber}</span>
                    <span class="order-priority priority-${order.priority || 'standard'}">${order.priority || 'Standard'}</span>
                </div>
                <div class="order-details">
                    <div><strong>Customer:</strong> ${order.customer.firstName} ${order.customer.lastName}</div>
                    <div><strong>Weight:</strong> ${order.weight} lbs</div>
                    <div><strong>Pickup:</strong> ${new Date(order.scheduledPickup).toLocaleString()}</div>
                </div>
                <div class="order-actions">
                    <button class="btn btn-primary" data-action="claim" data-order-id="${order._id}">
                        Claim Order
                    </button>
                </div>
            </div>
        `).join('');

    // Add event listeners
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', handleOrderAction);
    });
  }

  // Render process status
  function renderProcessStatus(status) {
    const steps = [
      { key: 'assigned', label: 'Assigned', icon: '👤' },
      { key: 'washing', label: 'Washing', icon: '🌊' },
      { key: 'drying', label: 'Drying', icon: '🌞' },
      { key: 'folding', label: 'Folding', icon: '👔' },
      { key: 'quality_check', label: 'QC', icon: '✓' },
      { key: 'ready', label: 'Ready', icon: '✅' }
    ];

    const currentIndex = steps.findIndex(step => step.key === status);

    return `
            <div class="process-status">
                ${steps.map((step, index) => `
                    <div class="status-step ${index < currentIndex ? 'completed' : ''} ${index === currentIndex ? 'active' : ''}">
                        <div class="status-circle">${step.icon}</div>
                        <div class="status-label">${step.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
  }

  // Get order actions based on status
  function getOrderActions(order) {
    const status = order.orderProcessingStatus;

    switch(status) {
    case 'assigned':
      return `<button class="btn btn-primary" data-action="start-washing" data-order-id="${order._id}">Start Washing</button>`;
    case 'washing':
      return `<button class="btn btn-primary" data-action="start-drying" data-order-id="${order._id}">Start Drying</button>`;
    case 'drying':
      return `<button class="btn btn-primary" data-action="start-folding" data-order-id="${order._id}">Start Folding</button>`;
    case 'folding':
      return `<button class="btn btn-primary" data-action="quality-check" data-order-id="${order._id}">Quality Check</button>`;
    case 'quality_check':
      return `<button class="btn" data-action="perform-qc" data-order-id="${order._id}">Perform QC</button>`;
    default:
      return '';
    }
  }

  // Handle order actions
  async function handleOrderAction(e) {
    const action = e.target.dataset.action;
    const orderId = e.target.dataset.orderId;

    switch(action) {
    case 'claim':
      await claimOrder(orderId);
      break;
    case 'start-washing':
      await updateOrderStatus(orderId, 'washing');
      break;
    case 'start-drying':
      await updateOrderStatus(orderId, 'drying');
      break;
    case 'start-folding':
      await updateOrderStatus(orderId, 'folding');
      break;
    case 'quality-check':
      await updateOrderStatus(orderId, 'quality_check');
      break;
    case 'perform-qc':
      showQualityCheckModal(orderId);
      break;
    }
  }

  // Claim order
  async function claimOrder(orderId) {
    try {
      const response = await operatorFetch(`/api/v1/operators/orders/${orderId}/claim`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (response.ok) {
        alert('Order claimed successfully!');
        await loadDashboard();
      } else {
        alert(data.error || 'Failed to claim order');
      }
    } catch (error) {
      console.error('Error claiming order:', error);
      alert('Network error. Please try again.');
    }
  }

  // Update order status
  async function updateOrderStatus(orderId, newStatus) {
    selectedOrderId = orderId;
    currentOrderStatus = newStatus;

    const order = myActiveOrders.find(o => o._id === orderId);
    if (!order) return;

    // Check if we need workstation selection
    if (newStatus === 'washing' && !operatorData.workStation) {
      const workstation = prompt('Select workstation (W1-W5):');
      if (!workstation || !['W1', 'W2', 'W3', 'W4', 'W5'].includes(workstation)) {
        alert('Invalid workstation');
        return;
      }

      try {
        const response = await operatorFetch(`/api/v1/operators/orders/${orderId}/status`, {
          method: 'PUT',
          body: JSON.stringify({
            status: newStatus,
            workstation: workstation
          })
        });

        if (response.ok) {
          operatorData.workStation = workstation;
          localStorage.setItem('operatorData', JSON.stringify(operatorData));
          document.getElementById('workstationInfo').textContent = `Workstation: ${workstation}`;
          await loadDashboard();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to update status');
        }
      } catch (error) {
        console.error('Error updating status:', error);
        alert('Network error. Please try again.');
      }
    } else {
      // Show update modal for notes
      showUpdateStatusModal(order, newStatus);
    }
  }

  // Show update status modal
  function showUpdateStatusModal(order, newStatus) {
    const modal = document.getElementById('updateStatusModal');
    const modalInfo = document.getElementById('modalOrderInfo');

    modalInfo.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4>Order #${order.orderNumber}</h4>
                <p>Customer: ${order.customer.firstName} ${order.customer.lastName}</p>
                <p>Current Status: ${order.orderProcessingStatus}</p>
                <p>New Status: <strong>${newStatus}</strong></p>
            </div>
        `;

    modal.classList.add('active');
  }

  // Show quality check modal
  function showQualityCheckModal(orderId) {
    selectedOrderId = orderId;
    const order = myActiveOrders.find(o => o._id === orderId);
    if (!order) return;

    const modal = document.getElementById('qualityCheckModal');
    const modalInfo = document.getElementById('qualityOrderInfo');

    modalInfo.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4>Order #${order.orderNumber}</h4>
                <p>Customer: ${order.customer.firstName} ${order.customer.lastName}</p>
                <p>Weight: ${order.weight} lbs</p>
                <p>Items: ${order.items?.join(', ') || 'Standard wash'}</p>
            </div>
        `;

    modal.classList.add('active');
  }

  // Update status form submission
  document.getElementById('updateStatusForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const notes = document.getElementById('statusNotes').value;

    try {
      const response = await operatorFetch(`/api/v1/operators/orders/${selectedOrderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: currentOrderStatus,
          notes: notes
        })
      });

      if (response.ok) {
        document.getElementById('updateStatusModal').classList.remove('active');
        document.getElementById('statusNotes').value = '';
        await loadDashboard();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Network error. Please try again.');
    }
  });

  // Quality check form submission
  document.getElementById('qualityCheckForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const result = document.querySelector('input[name="qualityResult"]:checked').value;
    const notes = document.getElementById('qualityNotes').value;

    try {
      const response = await operatorFetch(`/api/v1/operators/orders/${selectedOrderId}/quality-check`, {
        method: 'POST',
        body: JSON.stringify({
          passed: result === 'pass',
          notes: notes,
          issues: result === 'fail' ? notes : undefined
        })
      });

      if (response.ok) {
        document.getElementById('qualityCheckModal').classList.remove('active');
        document.getElementById('qualityCheckForm').reset();
        await loadDashboard();
        alert(result === 'pass' ? 'Quality check passed!' : 'Order sent back for reprocessing');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit quality check');
      }
    } catch (error) {
      console.error('Error submitting quality check:', error);
      alert('Network error. Please try again.');
    }
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderOrderQueue();
    });
  });

  // Modal close buttons
  document.getElementById('closeStatusModal').addEventListener('click', () => {
    document.getElementById('updateStatusModal').classList.remove('active');
  });

  document.getElementById('cancelStatusBtn').addEventListener('click', () => {
    document.getElementById('updateStatusModal').classList.remove('active');
  });

  document.getElementById('closeQualityModal').addEventListener('click', () => {
    document.getElementById('qualityCheckModal').classList.remove('active');
  });

  document.getElementById('cancelQualityBtn').addEventListener('click', () => {
    document.getElementById('qualityCheckModal').classList.remove('active');
  });

  // Clock out
  document.getElementById('clockOutBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clock out?')) {
      return;
    }

    // Check for active orders
    if (myActiveOrders.length > 0) {
      alert(`You have ${myActiveOrders.length} active orders. Please complete or reassign them before clocking out.`);
      return;
    }

    try {
      const response = await operatorFetch('/api/v1/operators/shift/status', {
        method: 'POST',
        body: JSON.stringify({ action: 'end' })
      });

      if (response.ok) {
        localStorage.removeItem('operatorToken');
        localStorage.removeItem('operatorRefreshToken');
        localStorage.removeItem('operatorData');
        window.location.href = '/operator-login-embed.html';
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to clock out');
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      alert('Network error. Please try again.');
    }
  });

  // Auto-refresh every 30 seconds
  setInterval(loadDashboard, 30000);

  // Load initial data
  loadDashboard();
})();