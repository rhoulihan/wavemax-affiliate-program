/**
 * Affiliate Schedule Management
 * Handles calendar rendering and schedule API interactions
 */

(function() {
  'use strict';

  // Store schedule data
  let scheduleData = null;
  let currentMonth = new Date();
  let affiliateId = null;

  // Initialize when DOM is ready
  function init() {
    console.log('[AffiliateSchedule] Initializing...');

    // Set up event listeners first (these don't need affiliate data)
    setupEventListeners();

    // Load schedule when tab is shown
    const scheduleTab = document.getElementById('schedule-tab');
    if (scheduleTab) {
      // Check if schedule tab becomes visible
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class' && scheduleTab.classList.contains('active')) {
            console.log('[AffiliateSchedule] Schedule tab became active');
            ensureAffiliateIdAndLoad();
          }
        });
      });
      observer.observe(scheduleTab, { attributes: true });

      // Load immediately if already active
      if (scheduleTab.classList.contains('active')) {
        console.log('[AffiliateSchedule] Schedule tab is already active');
        ensureAffiliateIdAndLoad();
      }
    }
  }

  // Ensure we have affiliate ID before loading
  function ensureAffiliateIdAndLoad() {
    if (!affiliateId) {
      const currentAffiliate = JSON.parse(localStorage.getItem('currentAffiliate') || 'null');
      if (currentAffiliate && currentAffiliate.affiliateId) {
        affiliateId = currentAffiliate.affiliateId;
        console.log('[AffiliateSchedule] Affiliate ID loaded:', affiliateId);
      } else {
        console.log('[AffiliateSchedule] Affiliate data not yet available, retrying...');
        // Retry after a short delay
        setTimeout(ensureAffiliateIdAndLoad, 500);
        return;
      }
    }
    loadSchedule();
  }

  function setupEventListeners() {
    // Edit weekly template button
    const editTemplateBtn = document.getElementById('editWeeklyTemplateBtn');
    if (editTemplateBtn) {
      editTemplateBtn.addEventListener('click', showWeeklyTemplateModal);
    }

    // Block date button
    const blockDateBtn = document.getElementById('addBlockDateBtn');
    if (blockDateBtn) {
      blockDateBtn.addEventListener('click', showBlockDateModal);
    }

    // Settings button
    const settingsBtn = document.getElementById('scheduleSettingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', showSettingsModal);
    }
  }

  async function loadSchedule() {
    const token = localStorage.getItem('affiliateToken');
    if (!token || !affiliateId) {
      console.log('[AffiliateSchedule] Missing token or affiliateId');
      return;
    }

    console.log('[AffiliateSchedule] Loading schedule for:', affiliateId);

    try {
      const response = await fetch(`/api/v1/affiliates/${affiliateId}/schedule`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[AffiliateSchedule] Schedule loaded:', result);
        scheduleData = result;
        renderCalendar();
      } else if (response.status === 404) {
        // Affiliate doesn't have a schedule yet - use defaults
        console.log('[AffiliateSchedule] No schedule found, using defaults');
        scheduleData = getDefaultScheduleData();
        renderCalendar();
      } else {
        console.error('[AffiliateSchedule] Failed to load schedule:', response.status);
        showCalendarError('Failed to load schedule data');
      }
    } catch (error) {
      console.error('[AffiliateSchedule] Error loading schedule:', error);
      showCalendarError('Error connecting to server');
    }
  }

  function getDefaultScheduleData() {
    // Default schedule: Mon-Sat all slots available, Sunday off
    return {
      weeklyTemplate: {
        monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
        tuesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
        wednesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
        thursday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
        friday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
        saturday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
        sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
      },
      dateExceptions: [],
      scheduleSettings: {
        advanceBookingDays: 1,
        maxBookingDays: 30,
        timezone: 'America/Chicago'
      }
    };
  }

  function renderCalendar() {
    const container = document.getElementById('scheduleCalendar');
    if (!container || !scheduleData) return;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = `
      <div class="calendar-header flex justify-between items-center mb-4">
        <button id="prevMonth" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition">
          &larr; Previous
        </button>
        <h3 class="text-xl font-bold">${monthNames[month]} ${year}</h3>
        <button id="nextMonth" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition">
          Next &rarr;
        </button>
      </div>
      <div class="calendar-grid grid grid-cols-7 gap-1 bg-gray-100 p-2 rounded-lg">
    `;

    // Day headers
    dayNames.forEach(day => {
      html += `<div class="text-center font-bold py-2 text-gray-600">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startingDay; i++) {
      html += '<div class="bg-white p-2 min-h-24 rounded"></div>';
    }

    // Days of month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = getDayName(date.getDay());
      const availability = getDayAvailability(date);

      let bgColor = 'bg-gray-50';
      let indicator = '';
      let tooltip = '';

      if (availability.isBlocked) {
        bgColor = 'bg-red-100';
        indicator = '<span class="block w-3 h-3 bg-red-500 rounded-full mx-auto mb-1"></span>';
        tooltip = availability.reason || 'Blocked';
      } else if (availability.isOverride) {
        bgColor = 'bg-blue-100';
        indicator = '<span class="block w-3 h-3 bg-blue-500 rounded-full mx-auto mb-1"></span>';
        tooltip = `Custom: ${availability.slots.join(', ')}`;
      } else if (!availability.enabled) {
        bgColor = 'bg-red-50';
        indicator = '<span class="block w-3 h-3 bg-red-400 rounded-full mx-auto mb-1"></span>';
        tooltip = 'Not available';
      } else if (availability.slots.length === 3) {
        bgColor = 'bg-green-50';
        indicator = '<span class="block w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></span>';
        tooltip = 'All day available';
      } else if (availability.slots.length > 0) {
        bgColor = 'bg-yellow-50';
        indicator = '<span class="block w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1"></span>';
        tooltip = `Available: ${availability.slots.join(', ')}`;
      } else {
        bgColor = 'bg-red-50';
        indicator = '<span class="block w-3 h-3 bg-red-400 rounded-full mx-auto mb-1"></span>';
        tooltip = 'Not available';
      }

      const isToday = isDateToday(date);
      const todayClass = isToday ? 'ring-2 ring-blue-500' : '';

      html += `
        <div class="calendar-day ${bgColor} ${todayClass} p-2 min-h-24 rounded cursor-pointer hover:shadow-md transition relative"
             data-date="${dateStr}" title="${tooltip}">
          <div class="text-right font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}">${day}</div>
          ${indicator}
          <div class="text-xs text-gray-500 mt-1">
            ${availability.slots.map(s => s.charAt(0).toUpperCase()).join(' ')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Attach event listeners
    document.getElementById('prevMonth').addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      renderCalendar();
    });

    // Click on day to edit
    container.querySelectorAll('.calendar-day').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const date = dayEl.getAttribute('data-date');
        showDayEditModal(date);
      });
    });
  }

  function getDayAvailability(date) {
    const dayName = getDayName(date.getDay());
    const dateStr = date.toDateString();

    // Check for exceptions first
    const exception = scheduleData.dateExceptions.find(ex =>
      new Date(ex.date).toDateString() === dateStr
    );

    if (exception) {
      if (exception.type === 'block') {
        return {
          enabled: false,
          slots: [],
          isBlocked: true,
          isOverride: false,
          reason: exception.reason
        };
      } else {
        // Override
        const slots = [];
        if (exception.timeSlots.morning) slots.push('morning');
        if (exception.timeSlots.afternoon) slots.push('afternoon');
        if (exception.timeSlots.evening) slots.push('evening');
        return {
          enabled: true,
          slots: slots,
          isBlocked: false,
          isOverride: true,
          reason: exception.reason
        };
      }
    }

    // Use weekly template
    const template = scheduleData.weeklyTemplate[dayName];
    if (!template.enabled) {
      return { enabled: false, slots: [], isBlocked: false, isOverride: false };
    }

    const slots = [];
    if (template.timeSlots.morning) slots.push('morning');
    if (template.timeSlots.afternoon) slots.push('afternoon');
    if (template.timeSlots.evening) slots.push('evening');

    return { enabled: true, slots: slots, isBlocked: false, isOverride: false };
  }

  function getDayName(dayIndex) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
  }

  function isDateToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  function showCalendarError(message) {
    const container = document.getElementById('scheduleCalendar');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-8 text-red-500">
          <p>${message}</p>
          <button onclick="window.AffiliateSchedule.loadSchedule()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Retry
          </button>
        </div>
      `;
    }
  }

  function showWeeklyTemplateModal() {
    if (!scheduleData) return;

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = {
      monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
      thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
    };

    let formHtml = '';
    days.forEach(day => {
      const dayData = scheduleData.weeklyTemplate[day];
      formHtml += `
        <div class="mb-4 p-3 bg-gray-50 rounded">
          <div class="flex items-center justify-between mb-2">
            <label class="font-medium">
              <input type="checkbox" id="template-${day}-enabled" ${dayData.enabled ? 'checked' : ''} class="mr-2">
              ${dayLabels[day]}
            </label>
          </div>
          <div class="grid grid-cols-3 gap-2 ml-6">
            <label class="flex items-center">
              <input type="checkbox" id="template-${day}-morning" ${dayData.timeSlots.morning ? 'checked' : ''} class="mr-1">
              <span class="text-sm">Morning</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" id="template-${day}-afternoon" ${dayData.timeSlots.afternoon ? 'checked' : ''} class="mr-1">
              <span class="text-sm">Afternoon</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" id="template-${day}-evening" ${dayData.timeSlots.evening ? 'checked' : ''} class="mr-1">
              <span class="text-sm">Evening</span>
            </label>
          </div>
        </div>
      `;
    });

    showModal('Edit Weekly Template', formHtml, async () => {
      const updates = {};
      days.forEach(day => {
        updates[day] = {
          enabled: document.getElementById(`template-${day}-enabled`).checked,
          timeSlots: {
            morning: document.getElementById(`template-${day}-morning`).checked,
            afternoon: document.getElementById(`template-${day}-afternoon`).checked,
            evening: document.getElementById(`template-${day}-evening`).checked
          }
        };
      });

      await updateWeeklyTemplate(updates);
    });
  }

  function showBlockDateModal() {
    const today = new Date().toISOString().split('T')[0];
    const formHtml = `
      <div class="mb-4">
        <label class="block font-medium mb-2">Date to Block</label>
        <input type="date" id="blockDate" class="w-full px-3 py-2 border rounded" min="${today}">
      </div>
      <div class="mb-4">
        <label class="block font-medium mb-2">Reason (Optional)</label>
        <input type="text" id="blockReason" class="w-full px-3 py-2 border rounded" placeholder="e.g., Holiday, Vacation">
      </div>
    `;

    showModal('Block a Date', formHtml, async () => {
      const date = document.getElementById('blockDate').value;
      const reason = document.getElementById('blockReason').value;

      if (!date) {
        alert('Please select a date');
        return false;
      }

      await addDateException(date, 'block', null, reason);
    });
  }

  function showDayEditModal(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const dateDisplay = date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const availability = getDayAvailability(date);
    const isPast = date < new Date().setHours(0, 0, 0, 0);

    if (isPast) {
      alert('Cannot modify past dates');
      return;
    }

    const formHtml = `
      <p class="mb-4 text-gray-600">${dateDisplay}</p>
      <div class="mb-4">
        <label class="block font-medium mb-2">Availability Type</label>
        <select id="dayType" class="w-full px-3 py-2 border rounded">
          <option value="template" ${!availability.isBlocked && !availability.isOverride ? 'selected' : ''}>Use Weekly Template</option>
          <option value="block" ${availability.isBlocked ? 'selected' : ''}>Block Entire Day</option>
          <option value="custom" ${availability.isOverride ? 'selected' : ''}>Custom Hours</option>
        </select>
      </div>
      <div id="customSlotsDiv" class="${availability.isOverride ? '' : 'hidden'}">
        <label class="block font-medium mb-2">Available Time Slots</label>
        <div class="space-y-2">
          <label class="flex items-center">
            <input type="checkbox" id="day-morning" ${availability.slots.includes('morning') ? 'checked' : ''} class="mr-2">
            Morning (8am - 12pm)
          </label>
          <label class="flex items-center">
            <input type="checkbox" id="day-afternoon" ${availability.slots.includes('afternoon') ? 'checked' : ''} class="mr-2">
            Afternoon (12pm - 5pm)
          </label>
          <label class="flex items-center">
            <input type="checkbox" id="day-evening" ${availability.slots.includes('evening') ? 'checked' : ''} class="mr-2">
            Evening (5pm - 8pm)
          </label>
        </div>
      </div>
      <div class="mt-4">
        <label class="block font-medium mb-2">Reason (Optional)</label>
        <input type="text" id="dayReason" class="w-full px-3 py-2 border rounded" value="${availability.reason || ''}" placeholder="e.g., Holiday">
      </div>
    `;

    showModal('Edit Day Availability', formHtml, async () => {
      const type = document.getElementById('dayType').value;
      const reason = document.getElementById('dayReason').value;

      if (type === 'template') {
        // Remove any exception for this date
        await removeDateException(dateStr);
      } else if (type === 'block') {
        await addDateException(dateStr, 'block', null, reason);
      } else {
        const timeSlots = {
          morning: document.getElementById('day-morning').checked,
          afternoon: document.getElementById('day-afternoon').checked,
          evening: document.getElementById('day-evening').checked
        };
        await addDateException(dateStr, 'override', timeSlots, reason);
      }
    });

    // Toggle custom slots visibility
    document.getElementById('dayType').addEventListener('change', (e) => {
      const customDiv = document.getElementById('customSlotsDiv');
      if (e.target.value === 'custom') {
        customDiv.classList.remove('hidden');
      } else {
        customDiv.classList.add('hidden');
      }
    });
  }

  function showSettingsModal() {
    if (!scheduleData) return;

    const settings = scheduleData.scheduleSettings;
    const formHtml = `
      <div class="mb-4">
        <label class="block font-medium mb-2">Minimum Advance Booking (Days)</label>
        <input type="number" id="advanceBookingDays" class="w-full px-3 py-2 border rounded"
               value="${settings.advanceBookingDays}" min="0" max="30">
        <p class="text-sm text-gray-500 mt-1">Customers must book at least this many days in advance</p>
      </div>
      <div class="mb-4">
        <label class="block font-medium mb-2">Maximum Booking Window (Days)</label>
        <input type="number" id="maxBookingDays" class="w-full px-3 py-2 border rounded"
               value="${settings.maxBookingDays}" min="1" max="90">
        <p class="text-sm text-gray-500 mt-1">How far in advance customers can book</p>
      </div>
    `;

    showModal('Booking Settings', formHtml, async () => {
      const advanceBookingDays = parseInt(document.getElementById('advanceBookingDays').value);
      const maxBookingDays = parseInt(document.getElementById('maxBookingDays').value);

      await updateSettings(advanceBookingDays, maxBookingDays);
    });
  }

  function showModal(title, content, onSave) {
    // Remove existing modal
    const existingModal = document.getElementById('scheduleModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div id="scheduleModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-screen overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">${title}</h3>
              <button id="closeModal" class="text-gray-500 hover:text-gray-700">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div class="modal-content">
              ${content}
            </div>
            <div class="mt-6 flex justify-end space-x-3">
              <button id="cancelModal" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
              <button id="saveModal" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('scheduleModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelModal');
    const saveBtn = document.getElementById('saveModal');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const result = await onSave();
      if (result !== false) {
        closeModal();
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    });
  }

  async function updateWeeklyTemplate(template) {
    const token = localStorage.getItem('affiliateToken');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ||
                      await getCsrfToken();

    try {
      const response = await fetch(`/api/v1/affiliates/${affiliateId}/schedule/template`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ weeklyTemplate: template })
      });

      if (response.ok) {
        await loadSchedule();
        showNotification('Weekly template updated successfully', 'success');
      } else {
        const error = await response.json();
        showNotification(error.message || 'Failed to update template', 'error');
      }
    } catch (error) {
      console.error('Error updating template:', error);
      showNotification('Error connecting to server', 'error');
    }
  }

  async function addDateException(date, type, timeSlots, reason) {
    const token = localStorage.getItem('affiliateToken');
    const csrfToken = await getCsrfToken();

    const body = { date, type };
    if (timeSlots) body.timeSlots = timeSlots;
    if (reason) body.reason = reason;

    try {
      const response = await fetch(`/api/v1/affiliates/${affiliateId}/schedule/exceptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        await loadSchedule();

        let message = 'Date exception added successfully';
        if (result.warning) {
          message += '. ' + result.warning;
          showNotification(message, 'warning');
        } else {
          showNotification(message, 'success');
        }
      } else {
        const error = await response.json();
        showNotification(error.message || 'Failed to add exception', 'error');
      }
    } catch (error) {
      console.error('Error adding exception:', error);
      showNotification('Error connecting to server', 'error');
    }
  }

  async function removeDateException(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const exception = scheduleData.dateExceptions.find(ex =>
      new Date(ex.date).toDateString() === date.toDateString()
    );

    if (!exception) {
      showNotification('No exception to remove', 'info');
      return;
    }

    const token = localStorage.getItem('affiliateToken');
    const csrfToken = await getCsrfToken();

    try {
      const response = await fetch(
        `/api/v1/affiliates/${affiliateId}/schedule/exceptions/${exception._id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-csrf-token': csrfToken
          }
        }
      );

      if (response.ok) {
        await loadSchedule();
        showNotification('Reverted to weekly template', 'success');
      } else {
        const error = await response.json();
        showNotification(error.message || 'Failed to remove exception', 'error');
      }
    } catch (error) {
      console.error('Error removing exception:', error);
      showNotification('Error connecting to server', 'error');
    }
  }

  async function updateSettings(advanceBookingDays, maxBookingDays) {
    const token = localStorage.getItem('affiliateToken');
    const csrfToken = await getCsrfToken();

    try {
      const response = await fetch(`/api/v1/affiliates/${affiliateId}/schedule/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ advanceBookingDays, maxBookingDays })
      });

      if (response.ok) {
        await loadSchedule();
        showNotification('Settings updated successfully', 'success');
      } else {
        const error = await response.json();
        showNotification(error.message || 'Failed to update settings', 'error');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showNotification('Error connecting to server', 'error');
    }
  }

  async function getCsrfToken() {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return '';
    }
  }

  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('scheduleNotification');
    if (existing) existing.remove();

    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };

    const notification = document.createElement('div');
    notification.id = 'scheduleNotification';
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('opacity-0');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // Expose public API
  window.AffiliateSchedule = {
    init: init,
    loadSchedule: loadSchedule
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
