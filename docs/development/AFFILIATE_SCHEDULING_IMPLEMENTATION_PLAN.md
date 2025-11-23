# Affiliate Scheduling Feature - Implementation Plan

**Feature**: Allow affiliates to set available days and time periods for pickups, preventing customers from scheduling during blocked time windows.

**Date**: 2025-01-16
**Development Approach**: Test-Driven Development (TDD)
**Version**: 1.0

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Requirements Analysis](#requirements-analysis)
3. [Data Model Design](#data-model-design)
4. [API Endpoints](#api-endpoints)
5. [Frontend Implementation](#frontend-implementation)
6. [Testing Strategy](#testing-strategy)
7. [Implementation Phases](#implementation-phases)
8. [Acceptance Criteria](#acceptance-criteria)
9. [Rollout Plan](#rollout-plan)

---

## Feature Overview

### Goal
Enable affiliates to define their pickup availability schedule through a calendar interface on their dashboard, and automatically prevent customers from scheduling pickups during unavailable time windows.

### Key Components
1. **Affiliate Dashboard**: New "Schedule" tab with calendar control for managing availability
2. **Data Model**: Schedule storage in Affiliate model with weekly templates and date-specific exceptions
3. **Validation Layer**: Backend and frontend validation to enforce schedule constraints
4. **Customer Experience**: Dynamic filtering of available pickup dates and times

### User Stories

**As an affiliate**, I want to:
- Set my regular weekly availability (which days and time periods I accept pickups)
- Block specific dates (holidays, vacations, personal time)
- Override specific dates with custom availability
- See a visual calendar of my availability
- Easily manage my schedule with drag-and-drop functionality

**As a customer**, I want to:
- Only see available dates when scheduling a pickup
- Only see available time slots for my selected date
- Receive clear feedback if no slots are available
- Not be able to schedule during affiliate's unavailable times

---

## Requirements Analysis

### Current System Analysis

**Existing Components**:
- **Order Model**: Stores `pickupDate` (Date) and `pickupTime` (Enum: 'morning', 'afternoon', 'evening')
- **Affiliate Model**: No availability/schedule fields currently
- **Pickup Times**:
  - Morning: 8am - 12pm
  - Afternoon: 12pm - 5pm
  - Evening: 5pm - 8pm
- **Affiliate Dashboard**: 4 tabs (Pickups & Deliveries, Customers, Earnings, Settings)
- **Customer Scheduling**: HTML date picker + dropdown for time slots

**Gaps Identified**:
1. No availability data structure in Affiliate model
2. No validation of affiliate availability in order creation
3. No UI for affiliates to manage availability
4. No API endpoints for schedule management
5. Customer scheduling doesn't check affiliate availability

### Functional Requirements

**FR1: Schedule Data Model**
- Store weekly availability template (default schedule for each day of week)
- Store date-specific exceptions (overrides and blocks)
- Support three time periods: morning, afternoon, evening
- Allow partial day availability (e.g., only morning and evening)

**FR2: Affiliate Schedule Management**
- Visual calendar interface with month/week views
- Drag-and-drop to create/modify availability blocks
- Quick actions: "Mark as available", "Mark as unavailable"
- Bulk operations: "Apply to all Mondays", "Block date range"
- Default schedule template that applies to new weeks

**FR3: Customer Scheduling Validation**
- Fetch affiliate availability before rendering calendar
- Disable unavailable dates in date picker
- Filter time slot options based on selected date
- Real-time validation on form submission
- Server-side validation in order creation endpoint

**FR4: API Requirements**
- RESTful endpoints for schedule CRUD operations
- Query endpoint for checking availability
- Support date range queries for calendar rendering
- Atomic operations for schedule updates

### Non-Functional Requirements

**NFR1: Performance**
- Schedule queries should complete in <200ms
- Calendar rendering should handle 365 days without lag
- Optimistic UI updates for schedule changes

**NFR2: User Experience**
- Intuitive drag-and-drop interface
- Mobile-responsive calendar
- Clear visual distinction between available/unavailable slots
- Tooltips and help text for guidance

**NFR3: Data Integrity**
- Validate schedule changes don't conflict with existing orders
- Warn affiliate if blocking times with pending pickups
- Prevent deletion of availability windows with confirmed orders

**NFR4: Internationalization**
- Support all 4 languages (en, es, pt, de)
- Locale-aware date formatting
- Translated time period labels

---

## Data Model Design

### Affiliate Model Schema Addition

```javascript
// Add to server/models/Affiliate.js

// Availability schedule
availabilitySchedule: {
  // Default weekly template
  weeklyTemplate: {
    monday: {
      enabled: { type: Boolean, default: true },
      timeSlots: {
        morning: { type: Boolean, default: true },
        afternoon: { type: Boolean, default: true },
        evening: { type: Boolean, default: true }
      }
    },
    tuesday: {
      enabled: { type: Boolean, default: true },
      timeSlots: {
        morning: { type: Boolean, default: true },
        afternoon: { type: Boolean, default: true },
        evening: { type: Boolean, default: true }
      }
    },
    wednesday: {
      enabled: { type: Boolean, default: true },
      timeSlots: {
        morning: { type: Boolean, default: true },
        afternoon: { type: Boolean, default: true },
        evening: { type: Boolean, default: true }
      }
    },
    thursday: {
      enabled: { type: Boolean, default: true },
      timeSlots: {
        morning: { type: Boolean, default: true },
        afternoon: { type: Boolean, default: true },
        evening: { type: Boolean, default: true }
      }
    },
    friday: {
      enabled: { type: Boolean, default: true },
      timeSlots: {
        morning: { type: Boolean, default: true },
        afternoon: { type: Boolean, default: true },
        evening: { type: Boolean, default: true }
      }
    },
    saturday: {
      enabled: { type: Boolean, default: true },
      timeSlots: {
        morning: { type: Boolean, default: true },
        afternoon: { type: Boolean, default: true },
        evening: { type: Boolean, default: true }
      }
    },
    sunday: {
      enabled: { type: Boolean, default: false },
      timeSlots: {
        morning: { type: Boolean, default: false },
        afternoon: { type: Boolean, default: false },
        evening: { type: Boolean, default: false }
      }
    }
  },

  // Date-specific overrides and exceptions
  dateExceptions: [{
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ['block', 'override'],
      required: true
    },
    // For type='block': entire day blocked
    // For type='override': custom availability
    timeSlots: {
      morning: { type: Boolean, default: false },
      afternoon: { type: Boolean, default: false },
      evening: { type: Boolean, default: false }
    },
    reason: String, // Optional note (e.g., "Holiday", "Vacation")
    createdAt: { type: Date, default: Date.now }
  }],

  // Settings
  scheduleSettings: {
    advanceBookingDays: {
      type: Number,
      default: 1,
      min: 0,
      max: 30
    }, // How many days in advance customers must book
    maxBookingDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 90
    }, // How far in advance customers can book
    timezone: {
      type: String,
      default: 'America/Chicago'
    }
  }
}
```

### Model Methods

```javascript
/**
 * Check if affiliate is available for a specific date and time
 * @param {Date} date - The pickup date
 * @param {String} timeSlot - 'morning', 'afternoon', or 'evening'
 * @returns {Boolean}
 */
affiliateSchema.methods.isAvailable = function(date, timeSlot) {
  const dayOfWeek = this.getDayOfWeekKey(date);

  // Check date-specific exceptions first
  const exception = this.availabilitySchedule.dateExceptions.find(
    ex => ex.date.toDateString() === date.toDateString()
  );

  if (exception) {
    if (exception.type === 'block') {
      return false; // Entire day blocked
    }
    // Override - use exception's time slots
    return exception.timeSlots[timeSlot] === true;
  }

  // Fall back to weekly template
  const dayTemplate = this.availabilitySchedule.weeklyTemplate[dayOfWeek];
  return dayTemplate.enabled && dayTemplate.timeSlots[timeSlot] === true;
};

/**
 * Get available time slots for a specific date
 * @param {Date} date - The date to check
 * @returns {Array} - Array of available time slot strings
 */
affiliateSchema.methods.getAvailableTimeSlots = function(date) {
  const slots = [];
  const timeSlotOptions = ['morning', 'afternoon', 'evening'];

  for (const slot of timeSlotOptions) {
    if (this.isAvailable(date, slot)) {
      slots.push(slot);
    }
  }

  return slots;
};

/**
 * Get all available dates in a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array} - Array of available date objects with time slots
 */
affiliateSchema.methods.getAvailableDates = function(startDate, endDate) {
  const availableDates = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const timeSlots = this.getAvailableTimeSlots(currentDate);

    if (timeSlots.length > 0) {
      availableDates.push({
        date: new Date(currentDate),
        timeSlots: timeSlots,
        allDay: timeSlots.length === 3
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availableDates;
};

/**
 * Helper: Get day of week key from date
 */
affiliateSchema.methods.getDayOfWeekKey = function(date) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

/**
 * Validate schedule change doesn't conflict with existing orders
 * @param {Date} date
 * @param {String} timeSlot
 * @returns {Object} { valid: Boolean, conflicts: Array }
 */
affiliateSchema.methods.validateScheduleChange = async function(date, timeSlot) {
  const Order = require('./Order');

  const conflicts = await Order.find({
    affiliateId: this.affiliateId,
    pickupDate: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999))
    },
    pickupTime: timeSlot,
    status: { $in: ['pending', 'processing', 'processed'] }
  });

  return {
    valid: conflicts.length === 0,
    conflicts: conflicts
  };
};
```

### SystemConfig Additions

Add these configuration values:

```javascript
{
  key: 'default_advance_booking_days',
  value: 1,
  description: 'Default minimum days in advance for pickup booking',
  category: 'scheduling',
  dataType: 'number',
  defaultValue: 1,
  isPublic: true
}

{
  key: 'default_max_booking_days',
  value: 30,
  description: 'Default maximum days in advance for pickup booking',
  category: 'scheduling',
  dataType: 'number',
  defaultValue: 30,
  isPublic: true
}
```

---

## API Endpoints

### 1. Get Affiliate Schedule

```
GET /api/v1/affiliates/:affiliateId/schedule
```

**Authentication**: Required (Affiliate or Admin)
**Authorization**: Own schedule or admin role

**Response**:
```json
{
  "success": true,
  "data": {
    "weeklyTemplate": { ... },
    "dateExceptions": [ ... ],
    "scheduleSettings": { ... }
  }
}
```

### 2. Update Weekly Template

```
PUT /api/v1/affiliates/:affiliateId/schedule/template
```

**Authentication**: Required (Affiliate or Admin)
**Authorization**: Own schedule or admin role

**Request Body**:
```json
{
  "weeklyTemplate": {
    "monday": {
      "enabled": true,
      "timeSlots": {
        "morning": true,
        "afternoon": true,
        "evening": false
      }
    },
    // ... other days
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Weekly template updated successfully",
  "data": {
    "weeklyTemplate": { ... }
  }
}
```

### 3. Add Date Exception

```
POST /api/v1/affiliates/:affiliateId/schedule/exceptions
```

**Authentication**: Required (Affiliate or Admin)
**Authorization**: Own schedule or admin role

**Request Body**:
```json
{
  "date": "2025-12-25",
  "type": "block",
  "reason": "Christmas Day"
}
```

OR

```json
{
  "date": "2025-07-04",
  "type": "override",
  "timeSlots": {
    "morning": true,
    "afternoon": false,
    "evening": false
  },
  "reason": "Independence Day - morning only"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Date exception added successfully",
  "data": {
    "exception": { ... }
  }
}
```

### 4. Update Date Exception

```
PUT /api/v1/affiliates/:affiliateId/schedule/exceptions/:exceptionId
```

**Request Body**: Same as Add Date Exception

### 5. Delete Date Exception

```
DELETE /api/v1/affiliates/:affiliateId/schedule/exceptions/:exceptionId
```

**Response**:
```json
{
  "success": true,
  "message": "Date exception removed successfully"
}
```

### 6. Get Available Slots (Public Endpoint)

```
GET /api/v1/affiliates/:affiliateId/available-slots?startDate=2025-01-16&endDate=2025-02-16
```

**Authentication**: Not required (used by customer scheduling)
**Query Parameters**:
- `startDate` (required): ISO 8601 date string
- `endDate` (required): ISO 8601 date string

**Response**:
```json
{
  "success": true,
  "data": {
    "availableDates": [
      {
        "date": "2025-01-17",
        "dayOfWeek": "friday",
        "timeSlots": ["morning", "afternoon", "evening"],
        "allDay": true
      },
      {
        "date": "2025-01-18",
        "dayOfWeek": "saturday",
        "timeSlots": ["morning"],
        "allDay": false
      }
    ],
    "affiliateSettings": {
      "advanceBookingDays": 1,
      "maxBookingDays": 30,
      "timezone": "America/Chicago"
    }
  }
}
```

### 7. Check Specific Slot Availability

```
GET /api/v1/affiliates/:affiliateId/available-slots/check?date=2025-01-17&timeSlot=morning
```

**Authentication**: Not required
**Query Parameters**:
- `date` (required): ISO 8601 date string
- `timeSlot` (required): 'morning', 'afternoon', or 'evening'

**Response**:
```json
{
  "success": true,
  "data": {
    "available": true,
    "date": "2025-01-17",
    "timeSlot": "morning"
  }
}
```

### 8. Update Schedule Settings

```
PUT /api/v1/affiliates/:affiliateId/schedule/settings
```

**Authentication**: Required (Affiliate or Admin)

**Request Body**:
```json
{
  "advanceBookingDays": 2,
  "maxBookingDays": 45,
  "timezone": "America/Chicago"
}
```

### Order Creation Enhancement

**Modify**: `POST /api/v1/orders`

**Add validation step**:
1. Fetch affiliate by `affiliateId`
2. Call `affiliate.isAvailable(pickupDate, pickupTime)`
3. If not available, return 400 error with clear message
4. Proceed with order creation if available

**Error Response**:
```json
{
  "success": false,
  "message": "Selected pickup time is not available",
  "error": {
    "code": "TIMESLOT_UNAVAILABLE",
    "details": "The affiliate is not available for pickups on 2025-01-17 during the morning time slot. Please select a different date or time."
  }
}
```

---

## Frontend Implementation

### 1. Affiliate Dashboard - Schedule Tab

**File**: `public/affiliate-dashboard-embed.html`

**Add New Tab**:
```html
<!-- In tab navigation -->
<button class="tab-btn px-6 py-3 font-bold border-b-2 border-transparent hover:text-blue-600"
        data-tab="schedule"
        data-i18n="affiliate.dashboard.tabs.schedule">Schedule</button>

<!-- Tab content -->
<div class="tab-content" id="schedule-tab">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-bold" data-i18n="affiliate.dashboard.schedule.title">
      Manage Your Availability
    </h2>
  </div>

  <!-- Calendar Container -->
  <div class="bg-white rounded-lg shadow-md p-6">
    <!-- Quick Actions -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button id="viewWeeklyTemplate" class="btn btn-secondary">
        <i class="fa fa-calendar-week"></i>
        <span data-i18n="affiliate.schedule.viewTemplate">Weekly Template</span>
      </button>
      <button id="addException" class="btn btn-primary">
        <i class="fa fa-plus"></i>
        <span data-i18n="affiliate.schedule.addException">Block Date</span>
      </button>
      <button id="scheduleSettings" class="btn btn-secondary">
        <i class="fa fa-cog"></i>
        <span data-i18n="affiliate.schedule.settings">Settings</span>
      </button>
    </div>

    <!-- Calendar Component -->
    <div id="availabilityCalendar"></div>

    <!-- Legend -->
    <div class="mt-4 flex flex-wrap gap-4 text-sm">
      <div class="flex items-center">
        <span class="w-4 h-4 bg-green-500 rounded mr-2"></span>
        <span data-i18n="affiliate.schedule.legend.available">Available All Day</span>
      </div>
      <div class="flex items-center">
        <span class="w-4 h-4 bg-yellow-500 rounded mr-2"></span>
        <span data-i18n="affiliate.schedule.legend.partial">Partial Availability</span>
      </div>
      <div class="flex items-center">
        <span class="w-4 h-4 bg-red-500 rounded mr-2"></span>
        <span data-i18n="affiliate.schedule.legend.unavailable">Unavailable</span>
      </div>
      <div class="flex items-center">
        <span class="w-4 h-4 bg-blue-500 rounded mr-2"></span>
        <span data-i18n="affiliate.schedule.legend.exception">Exception/Override</span>
      </div>
    </div>
  </div>
</div>
```

**Calendar Library**: FullCalendar.js (MIT license, CSP-compliant)

**JavaScript Files**:
- `public/assets/js/affiliate-schedule-calendar.js` - Calendar initialization and rendering
- `public/assets/js/affiliate-schedule-api.js` - API calls for schedule management
- `public/assets/js/affiliate-schedule-modals.js` - Modal dialogs for editing

**Update pageScripts in embed-app-v2.js**:
```javascript
const pageScripts = {
  '/affiliate-dashboard': [
    '/assets/js/i18n.js',
    '/assets/js/dashboard-utils.js',
    '/assets/js/chart.min.js',
    'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js',
    '/assets/js/affiliate-schedule-api.js',
    '/assets/js/affiliate-schedule-modals.js',
    '/assets/js/affiliate-schedule-calendar.js',
    '/assets/js/affiliate-dashboard-init.js'
  ]
};
```

### 2. Weekly Template Editor Modal

**Modal Structure**:
```html
<div id="weeklyTemplateModal" class="modal">
  <div class="modal-content">
    <h3 data-i18n="affiliate.schedule.weeklyTemplate.title">
      Edit Weekly Availability Template
    </h3>

    <div class="weekly-template-editor">
      <!-- For each day of week -->
      <div class="day-row">
        <div class="day-header">
          <label class="checkbox-label">
            <input type="checkbox" id="monday-enabled" checked>
            <span data-i18n="common.days.monday">Monday</span>
          </label>
        </div>
        <div class="time-slots">
          <label class="checkbox-label">
            <input type="checkbox" id="monday-morning" checked>
            <span data-i18n="common.timeSlots.morning">Morning</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="monday-afternoon" checked>
            <span data-i18n="common.timeSlots.afternoon">Afternoon</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="monday-evening" checked>
            <span data-i18n="common.timeSlots.evening">Evening</span>
          </label>
        </div>
      </div>
      <!-- Repeat for other days -->
    </div>

    <div class="modal-actions">
      <button id="saveTemplate" class="btn btn-primary">Save Template</button>
      <button id="cancelTemplate" class="btn btn-secondary">Cancel</button>
    </div>
  </div>
</div>
```

### 3. Date Exception Modal

**Modal for blocking or customizing specific dates**:
```html
<div id="dateExceptionModal" class="modal">
  <div class="modal-content">
    <h3 data-i18n="affiliate.schedule.exception.title">
      Add Date Exception
    </h3>

    <form id="exceptionForm">
      <div class="form-group">
        <label for="exceptionDate">Date</label>
        <input type="date" id="exceptionDate" required>
      </div>

      <div class="form-group">
        <label for="exceptionType">Type</label>
        <select id="exceptionType" required>
          <option value="block">Block Entire Day</option>
          <option value="override">Custom Availability</option>
        </select>
      </div>

      <div id="customSlotsSection" class="form-group hidden">
        <label>Available Time Slots</label>
        <div class="checkbox-group">
          <label>
            <input type="checkbox" id="exception-morning">
            <span data-i18n="common.timeSlots.morning">Morning</span>
          </label>
          <label>
            <input type="checkbox" id="exception-afternoon">
            <span data-i18n="common.timeSlots.afternoon">Afternoon</span>
          </label>
          <label>
            <input type="checkbox" id="exception-evening">
            <span data-i18n="common.timeSlots.evening">Evening</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="exceptionReason">Reason (Optional)</label>
        <input type="text" id="exceptionReason"
               placeholder="e.g., Holiday, Vacation">
      </div>

      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Add Exception</button>
        <button type="button" id="cancelException" class="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>
```

### 4. Customer Pickup Scheduling Updates

**File**: `public/schedule-pickup-embed.html`

**Enhanced Date Picker**:
```javascript
// public/assets/js/schedule-pickup-availability.js

async function loadAffiliateAvailability(affiliateId) {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 30); // Default 30 days

  try {
    const response = await fetch(
      `/api/v1/affiliates/${affiliateId}/available-slots?` +
      `startDate=${today.toISOString()}&endDate=${maxDate.toISOString()}`
    );

    const result = await response.json();

    if (result.success) {
      window.affiliateAvailability = result.data;
      initializeDatePicker(result.data);
    }
  } catch (error) {
    console.error('Failed to load availability:', error);
    showError('Unable to load available dates. Please try again.');
  }
}

function initializeDatePicker(availabilityData) {
  const dateInput = document.getElementById('pickupDate');
  const { availableDates, affiliateSettings } = availabilityData;

  // Set min and max dates
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + affiliateSettings.advanceBookingDays);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + affiliateSettings.maxBookingDays);

  dateInput.min = minDate.toISOString().split('T')[0];
  dateInput.max = maxDate.toISOString().split('T')[0];

  // Store available dates for validation
  window.availableDatesMap = new Map();
  availableDates.forEach(item => {
    window.availableDatesMap.set(item.date, item.timeSlots);
  });

  // Disable unavailable dates (using CSS or date picker library)
  setupDateValidation(dateInput, window.availableDatesMap);

  // Listen for date changes to update time slot options
  dateInput.addEventListener('change', function() {
    updateAvailableTimeSlots(this.value);
  });
}

function updateAvailableTimeSlots(selectedDate) {
  const timeSlotSelect = document.getElementById('pickupTime');
  const availableSlots = window.availableDatesMap.get(selectedDate) || [];

  // Clear current options
  timeSlotSelect.innerHTML = '<option value="">Select a time</option>';

  // Add only available slots
  const slotLabels = {
    morning: 'Morning (8am - 12pm)',
    afternoon: 'Afternoon (12pm - 5pm)',
    evening: 'Evening (5pm - 8pm)'
  };

  availableSlots.forEach(slot => {
    const option = document.createElement('option');
    option.value = slot;
    option.textContent = slotLabels[slot];
    timeSlotSelect.appendChild(option);
  });

  if (availableSlots.length === 0) {
    timeSlotSelect.innerHTML = '<option value="">No time slots available</option>';
    timeSlotSelect.disabled = true;
  } else {
    timeSlotSelect.disabled = false;
  }
}

// Client-side validation before submission
function validatePickupSlot(date, timeSlot) {
  const availableSlots = window.availableDatesMap.get(date);

  if (!availableSlots || !availableSlots.includes(timeSlot)) {
    return {
      valid: false,
      message: 'Selected time slot is not available. Please choose another time.'
    };
  }

  return { valid: true };
}
```

**Update pageScripts for schedule-pickup**:
```javascript
const pageScripts = {
  '/schedule-pickup': [
    '/assets/js/i18n.js',
    '/assets/js/language-switcher.js',
    '/assets/js/modal-utils.js',
    '/assets/js/errorHandler.js',
    '/assets/js/csrf-utils.js',
    '/assets/js/swirl-spinner.js',
    '/assets/js/schedule-pickup-availability.js', // NEW
    '/assets/js/schedule-pickup-embed.js'
  ]
};
```

---

## Testing Strategy

### Test-Driven Development Approach

**TDD Workflow**:
1. Write test for new functionality (test fails - RED)
2. Write minimal code to make test pass (GREEN)
3. Refactor code while keeping tests passing (REFACTOR)
4. Repeat for each feature

### Testing Layers

#### 1. Unit Tests

**File**: `tests/unit/affiliateModel.test.js`

**Test Cases**:
```javascript
describe('Affiliate Model - Availability Schedule', () => {
  describe('isAvailable()', () => {
    it('should return true for available time slot in weekly template', async () => {
      const affiliate = await createTestAffiliate({
        'availabilitySchedule.weeklyTemplate.monday.timeSlots.morning': true
      });

      const monday = getNextMonday();
      expect(affiliate.isAvailable(monday, 'morning')).toBe(true);
    });

    it('should return false for unavailable time slot', async () => {
      const affiliate = await createTestAffiliate({
        'availabilitySchedule.weeklyTemplate.monday.timeSlots.evening': false
      });

      const monday = getNextMonday();
      expect(affiliate.isAvailable(monday, 'evening')).toBe(false);
    });

    it('should return false when entire day is disabled', async () => {
      const affiliate = await createTestAffiliate({
        'availabilitySchedule.weeklyTemplate.sunday.enabled': false
      });

      const sunday = getNextSunday();
      expect(affiliate.isAvailable(sunday, 'morning')).toBe(false);
    });

    it('should prioritize date exceptions over weekly template', async () => {
      const affiliate = await createTestAffiliate({
        'availabilitySchedule.weeklyTemplate.monday.timeSlots.morning': true,
        'availabilitySchedule.dateExceptions': [{
          date: getNextMonday(),
          type: 'block'
        }]
      });

      expect(affiliate.isAvailable(getNextMonday(), 'morning')).toBe(false);
    });

    it('should honor override exceptions', async () => {
      const sunday = getNextSunday();
      const affiliate = await createTestAffiliate({
        'availabilitySchedule.weeklyTemplate.sunday.enabled': false,
        'availabilitySchedule.dateExceptions': [{
          date: sunday,
          type: 'override',
          timeSlots: { morning: true, afternoon: false, evening: false }
        }]
      });

      expect(affiliate.isAvailable(sunday, 'morning')).toBe(true);
      expect(affiliate.isAvailable(sunday, 'afternoon')).toBe(false);
    });
  });

  describe('getAvailableTimeSlots()', () => {
    it('should return array of available time slots for a date', async () => {
      const affiliate = await createTestAffiliate({
        'availabilitySchedule.weeklyTemplate.monday.timeSlots': {
          morning: true,
          afternoon: false,
          evening: true
        }
      });

      const monday = getNextMonday();
      const slots = affiliate.getAvailableTimeSlots(monday);

      expect(slots).toEqual(['morning', 'evening']);
    });

    it('should return empty array for fully unavailable day', async () => {
      const affiliate = await createTestAffiliate({
        'availabilitySchedule.weeklyTemplate.sunday.enabled': false
      });

      const sunday = getNextSunday();
      const slots = affiliate.getAvailableTimeSlots(sunday);

      expect(slots).toEqual([]);
    });
  });

  describe('getAvailableDates()', () => {
    it('should return available dates in range with time slots', async () => {
      const affiliate = await createTestAffiliate();

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const availableDates = affiliate.getAvailableDates(startDate, endDate);

      expect(availableDates).toBeInstanceOf(Array);
      expect(availableDates.length).toBeGreaterThan(0);
      expect(availableDates[0]).toHaveProperty('date');
      expect(availableDates[0]).toHaveProperty('timeSlots');
      expect(availableDates[0]).toHaveProperty('allDay');
    });
  });

  describe('validateScheduleChange()', () => {
    it('should return valid=true when no conflicting orders exist', async () => {
      const affiliate = await createTestAffiliate();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const result = await affiliate.validateScheduleChange(futureDate, 'morning');

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should return valid=false when conflicting orders exist', async () => {
      const affiliate = await createTestAffiliate();
      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 3);

      // Create conflicting order
      await createTestOrder({
        affiliateId: affiliate.affiliateId,
        pickupDate: pickupDate,
        pickupTime: 'morning',
        status: 'pending'
      });

      const result = await affiliate.validateScheduleChange(pickupDate, 'morning');

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });
  });
});
```

**File**: `tests/unit/affiliateScheduleController.test.js`

**Test Cases**:
- Get schedule returns correct data structure
- Update weekly template validates input
- Add date exception validates date format
- Delete exception removes correct item
- Get available slots filters correctly
- Unauthorized access returns 403

#### 2. Integration Tests

**File**: `tests/integration/affiliateSchedule.test.js`

**Test Cases**:
```javascript
describe('Affiliate Schedule API Integration', () => {
  let agent;
  let affiliateToken;
  let affiliate;

  beforeEach(async () => {
    agent = request.agent(app);
    affiliate = await createTestAffiliate();
    affiliateToken = createTestToken(affiliate._id, 'affiliate');
  });

  describe('GET /api/v1/affiliates/:affiliateId/schedule', () => {
    it('should return affiliate schedule with default template', async () => {
      const response = await agent
        .get(`/api/v1/affiliates/${affiliate.affiliateId}/schedule`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('weeklyTemplate');
      expect(response.body.data).toHaveProperty('dateExceptions');
      expect(response.body.data).toHaveProperty('scheduleSettings');
    });

    it('should return 403 for unauthorized affiliate', async () => {
      const otherAffiliate = await createTestAffiliate();

      await agent
        .get(`/api/v1/affiliates/${otherAffiliate.affiliateId}/schedule`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/v1/affiliates/:affiliateId/schedule/template', () => {
    it('should update weekly template successfully', async () => {
      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .put(`/api/v1/affiliates/${affiliate.affiliateId}/schedule/template`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          weeklyTemplate: {
            monday: {
              enabled: true,
              timeSlots: { morning: true, afternoon: false, evening: true }
            }
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update in database
      const updated = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
      expect(updated.availabilitySchedule.weeklyTemplate.monday.timeSlots.afternoon).toBe(false);
    });

    it('should validate time slot values are boolean', async () => {
      const csrfToken = await getCsrfToken(agent);

      await agent
        .put(`/api/v1/affiliates/${affiliate.affiliateId}/schedule/template`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          weeklyTemplate: {
            monday: {
              enabled: true,
              timeSlots: { morning: 'yes', afternoon: true, evening: true }
            }
          }
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/affiliates/:affiliateId/schedule/exceptions', () => {
    it('should add date block exception', async () => {
      const csrfToken = await getCsrfToken(agent);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const response = await agent
        .post(`/api/v1/affiliates/${affiliate.affiliateId}/schedule/exceptions`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          date: futureDate.toISOString().split('T')[0],
          type: 'block',
          reason: 'Vacation'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exception).toHaveProperty('date');
      expect(response.body.data.exception.type).toBe('block');
    });

    it('should add override exception with custom time slots', async () => {
      const csrfToken = await getCsrfToken(agent);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const response = await agent
        .post(`/api/v1/affiliates/${affiliate.affiliateId}/schedule/exceptions`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          date: futureDate.toISOString().split('T')[0],
          type: 'override',
          timeSlots: { morning: true, afternoon: false, evening: false },
          reason: 'Special hours'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exception.timeSlots.morning).toBe(true);
    });

    it('should warn when blocking date with existing orders', async () => {
      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 3);

      // Create order on that date
      await createTestOrder({
        affiliateId: affiliate.affiliateId,
        pickupDate: pickupDate,
        pickupTime: 'morning',
        status: 'pending'
      });

      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post(`/api/v1/affiliates/${affiliate.affiliateId}/schedule/exceptions`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          date: pickupDate.toISOString().split('T')[0],
          type: 'block',
          reason: 'Emergency'
        })
        .expect(200); // Allow but warn

      expect(response.body).toHaveProperty('warning');
      expect(response.body.warning).toContain('existing order');
    });
  });

  describe('GET /api/v1/affiliates/:affiliateId/available-slots', () => {
    it('should return available dates for date range', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const response = await agent
        .get(`/api/v1/affiliates/${affiliate.affiliateId}/available-slots`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('availableDates');
      expect(response.body.data).toHaveProperty('affiliateSettings');
      expect(Array.isArray(response.body.data.availableDates)).toBe(true);
    });

    it('should exclude blocked dates from available dates', async () => {
      const blockDate = new Date();
      blockDate.setDate(blockDate.getDate() + 7);

      // Add block exception
      affiliate.availabilitySchedule.dateExceptions.push({
        date: blockDate,
        type: 'block'
      });
      await affiliate.save();

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const response = await agent
        .get(`/api/v1/affiliates/${affiliate.affiliateId}/available-slots`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
        .expect(200);

      const dates = response.body.data.availableDates.map(d => d.date);
      const blockDateStr = blockDate.toISOString().split('T')[0];

      expect(dates).not.toContain(blockDateStr);
    });
  });

  describe('GET /api/v1/affiliates/:affiliateId/available-slots/check', () => {
    it('should return true for available slot', async () => {
      const monday = getNextMonday();

      const response = await agent
        .get(`/api/v1/affiliates/${affiliate.affiliateId}/available-slots/check`)
        .query({
          date: monday.toISOString().split('T')[0],
          timeSlot: 'morning'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(true);
    });

    it('should return false for unavailable slot', async () => {
      const sunday = getNextSunday();

      const response = await agent
        .get(`/api/v1/affiliates/${affiliate.affiliateId}/available-slots/check`)
        .query({
          date: sunday.toISOString().split('T')[0],
          timeSlot: 'morning'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
    });
  });
});
```

**File**: `tests/integration/orderScheduleValidation.test.js`

**Test Cases**:
```javascript
describe('Order Creation with Schedule Validation', () => {
  let agent;
  let customerToken;
  let customer;
  let affiliate;

  beforeEach(async () => {
    agent = request.agent(app);
    affiliate = await createTestAffiliate();
    customer = await createTestCustomer(affiliate.affiliateId);
    customerToken = createTestToken(customer._id, 'customer');
  });

  it('should allow order creation for available time slot', async () => {
    const monday = getNextMonday();
    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        pickupDate: monday.toISOString(),
        pickupTime: 'morning',
        estimatedWeight: 25,
        numberOfBags: 2
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.order).toHaveProperty('orderId');
  });

  it('should reject order for unavailable time slot', async () => {
    const sunday = getNextSunday();

    // Ensure Sunday morning is unavailable
    affiliate.availabilitySchedule.weeklyTemplate.sunday.enabled = false;
    await affiliate.save();

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        pickupDate: sunday.toISOString(),
        pickupTime: 'morning',
        estimatedWeight: 25,
        numberOfBags: 2
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('TIMESLOT_UNAVAILABLE');
  });

  it('should reject order for blocked date', async () => {
    const blockDate = new Date();
    blockDate.setDate(blockDate.getDate() + 7);

    // Add block exception
    affiliate.availabilitySchedule.dateExceptions.push({
      date: blockDate,
      type: 'block',
      reason: 'Holiday'
    });
    await affiliate.save();

    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        pickupDate: blockDate.toISOString(),
        pickupTime: 'morning',
        estimatedWeight: 25,
        numberOfBags: 2
      })
      .expect(400);

    expect(response.body.success).toBe(false);
  });
});
```

#### 3. Frontend Unit Tests (Optional)

**Framework**: Jest with jsdom

**Test Cases**:
- Calendar renders correctly
- Date selection filters time slots
- Modal forms validate input
- API calls handle errors
- Drag-and-drop updates schedule

---

## Implementation Phases

### Phase 1: Data Model & Model Methods (TDD)
**Estimated Time**: 2-3 hours

**Tasks**:
1. ✅ Write unit tests for Affiliate model methods (isAvailable, getAvailableTimeSlots, etc.)
2. ✅ Update Affiliate schema with availabilitySchedule fields
3. ✅ Implement model methods to pass tests
4. ✅ Add indexes for date queries
5. ✅ Run tests and verify all pass

**Deliverable**: Affiliate model with schedule functionality, 100% test coverage

---

### Phase 2: Backend API Endpoints (TDD)
**Estimated Time**: 4-5 hours

**Tasks**:
1. ✅ Write integration tests for all schedule API endpoints
2. ✅ Create new route file: `server/routes/affiliateScheduleRoutes.js`
3. ✅ Create controller: `server/controllers/affiliateScheduleController.js`
4. ✅ Implement GET /schedule endpoint
5. ✅ Implement PUT /schedule/template endpoint
6. ✅ Implement POST /schedule/exceptions endpoint
7. ✅ Implement DELETE /schedule/exceptions/:id endpoint
8. ✅ Implement GET /available-slots endpoint (public)
9. ✅ Implement GET /available-slots/check endpoint
10. ✅ Add validation middleware
11. ✅ Register routes in server.js
12. ✅ Run tests and verify all pass

**Deliverable**: Fully functional schedule API with test coverage

---

### Phase 3: Order Validation Enhancement (TDD)
**Estimated Time**: 2 hours

**Tasks**:
1. ✅ Write integration tests for order creation with schedule validation
2. ✅ Update `orderController.createOrder` to fetch affiliate and validate availability
3. ✅ Add appropriate error responses
4. ✅ Test edge cases (past dates, invalid time slots, etc.)
5. ✅ Run tests and verify all pass

**Deliverable**: Order creation respects affiliate availability

---

### Phase 4: Affiliate Dashboard - Schedule Tab (Frontend)
**Estimated Time**: 6-8 hours

**Tasks**:
1. ✅ Add FullCalendar library to project
2. ✅ Update affiliate-dashboard-embed.html with Schedule tab
3. ✅ Create affiliate-schedule-api.js (API wrapper functions)
4. ✅ Create affiliate-schedule-calendar.js (FullCalendar initialization)
5. ✅ Create affiliate-schedule-modals.js (Weekly template & exception modals)
6. ✅ Implement calendar rendering with color-coded availability
7. ✅ Implement click handlers for editing schedule
8. ✅ Implement drag-and-drop functionality
9. ✅ Implement weekly template editor modal
10. ✅ Implement date exception modal
11. ✅ Add error handling and loading states
12. ✅ Update pageScripts in embed-app-v2.js
13. ✅ Test in both direct and embedded contexts

**Deliverable**: Functional schedule management UI on affiliate dashboard

---

### Phase 5: Customer Pickup Scheduling Updates (Frontend)
**Estimated Time**: 3-4 hours

**Tasks**:
1. ✅ Create schedule-pickup-availability.js
2. ✅ Implement loadAffiliateAvailability() function
3. ✅ Update date picker to disable unavailable dates
4. ✅ Implement dynamic time slot filtering
5. ✅ Add client-side validation
6. ✅ Update form submission to handle new validation errors
7. ✅ Add user-friendly error messages
8. ✅ Update pageScripts in embed-app-v2.js
9. ✅ Test end-to-end flow

**Deliverable**: Customer scheduling respects affiliate availability

---

### Phase 6: Internationalization (i18n)
**Estimated Time**: 2 hours

**Tasks**:
1. ✅ Add schedule-related translations to all 4 languages:
   - `affiliate.dashboard.tabs.schedule`
   - `affiliate.schedule.*`
   - `common.days.*` (monday, tuesday, etc.)
   - `common.timeSlots.*` (morning, afternoon, evening)
   - Error messages for unavailable slots
2. ✅ Update HTML with data-i18n attributes
3. ✅ Test in all 4 languages

**Deliverable**: Fully translated schedule feature

---

### Phase 7: Documentation & Testing
**Estimated Time**: 2 hours

**Tasks**:
1. ✅ Update README.md with schedule feature documentation
2. ✅ Add API endpoint documentation
3. ✅ Create user guide for affiliates (how to manage schedule)
4. ✅ Run full test suite and verify >85% coverage
5. ✅ Manual testing in staging environment
6. ✅ Create test data for demo

**Deliverable**: Complete documentation and verified functionality

---

### Phase 8: Deployment
**Estimated Time**: 1 hour

**Tasks**:
1. ✅ Create migration script to initialize default schedules for existing affiliates
2. ✅ Run migration on staging
3. ✅ Test on staging environment
4. ✅ Deploy to production
5. ✅ Monitor logs for errors
6. ✅ Verify functionality in production

**Deliverable**: Feature live in production

---

## Acceptance Criteria

### Affiliate Dashboard
- [ ] Schedule tab is visible and accessible
- [ ] Calendar displays current month with availability states
- [ ] Clicking a date opens options to edit availability
- [ ] Weekly template editor allows bulk updates
- [ ] Date exceptions can be added, edited, and deleted
- [ ] Visual indicators clearly show available/unavailable status
- [ ] All interactions are smooth and responsive
- [ ] Works in embedded iframe context
- [ ] All text is properly translated in 4 languages

### Customer Scheduling
- [ ] Date picker only allows selection of available dates
- [ ] Time slot dropdown only shows available slots for selected date
- [ ] Clear error message shown if attempting to select unavailable slot
- [ ] Real-time validation prevents invalid submissions
- [ ] Works seamlessly in existing pickup flow
- [ ] No breaking changes to existing functionality

### API
- [ ] All endpoints return correct data structures
- [ ] Proper authentication and authorization enforced
- [ ] Input validation prevents invalid data
- [ ] Error responses are clear and actionable
- [ ] Performance meets <200ms requirement
- [ ] All endpoints have >85% test coverage

### Data Integrity
- [ ] Schedule changes don't affect existing confirmed orders
- [ ] Warnings shown when blocking dates with pending orders
- [ ] Default schedule applied to new affiliates
- [ ] Schedule persists correctly across sessions

---

## Rollout Plan

### Pre-Deployment
1. **Communication**: Email affiliates about new feature (1 week before)
2. **Documentation**: Publish help article with screenshots
3. **Training**: Create video tutorial for schedule management

### Deployment Strategy
1. **Staging Testing**: Full feature testing in staging (2 days)
2. **Beta Group**: Roll out to 5-10 affiliates for feedback (3 days)
3. **Gradual Rollout**: 25% → 50% → 100% over 1 week
4. **Monitoring**: Track usage, errors, and support tickets

### Post-Deployment
1. **Monitor** error logs for 48 hours
2. **Collect** user feedback through surveys
3. **Iterate** on UX improvements based on feedback
4. **Document** lessons learned

### Rollback Plan
If critical issues are discovered:
1. Feature flag to disable schedule validation (orders allowed regardless)
2. Hide Schedule tab from dashboard
3. Fix issues in hotfix branch
4. Re-deploy with fixes

---

## Risk Assessment

### High Risk
- **Migration of existing affiliates**: Default schedule must be sensible
  - *Mitigation*: Default to "available all days, all times" to maintain current behavior

### Medium Risk
- **Performance with large date ranges**: Calendar queries could be slow
  - *Mitigation*: Limit query range to 90 days max, add indexes, cache results

### Low Risk
- **User adoption**: Affiliates may not configure schedules
  - *Mitigation*: Default to open availability, optional feature

---

## Future Enhancements (Out of Scope)

1. **Recurring exceptions**: "Block every Sunday"
2. **Capacity limits**: "Max 10 pickups per day"
3. **Auto-scheduling**: AI suggests optimal pickup times
4. **Customer notifications**: Email when new slots open
5. **Buffer time**: Minimum time between pickups
6. **Integration with Google Calendar**: Sync affiliate's personal calendar
7. **Mobile app**: Native iOS/Android for schedule management

---

## Appendix

### Calendar Library Comparison

| Library | License | Size | Features | CSP Compatible |
|---------|---------|------|----------|----------------|
| **FullCalendar** | MIT | 245KB | Drag-drop, views, i18n | ✅ Yes |
| flatpickr | MIT | 30KB | Lightweight, no drag-drop | ✅ Yes |
| tui.calendar | MIT | 150KB | Full-featured | ✅ Yes |
| DayPilot Lite | Apache 2.0 | 180KB | Scheduling focus | ✅ Yes |

**Recommendation**: FullCalendar for comprehensive features and excellent documentation.

### Database Indexes Required

```javascript
// Affiliate model
affiliateSchema.index({ 'availabilitySchedule.dateExceptions.date': 1 });

// Existing indexes
affiliateSchema.index({ affiliateId: 1 });
affiliateSchema.index({ email: 1 });
```

### API Response Time Benchmarks

- GET /schedule: Target <50ms (simple document fetch)
- PUT /schedule/template: Target <100ms (single document update)
- POST /schedule/exceptions: Target <150ms (array push + validation)
- GET /available-slots (30 days): Target <200ms (computation-heavy)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-16
**Author**: Claude Code AI Assistant
**Status**: Ready for Review

---

© 2025 CRHS Enterprises, LLC. All rights reserved.
