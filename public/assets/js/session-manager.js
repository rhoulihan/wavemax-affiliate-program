(function() {
  'use strict';

  // Session manager for persistent login across refresh and navigation
  const SessionManager = {
    // Session timeout in milliseconds (10 minutes)
    SESSION_TIMEOUT: 10 * 60 * 1000,
    
    // Storage keys
    STORAGE_KEYS: {
      affiliate: {
        token: 'affiliateToken',
        refreshToken: 'affiliateRefreshToken',
        data: 'affiliateData',
        lastActivity: 'affiliateLastActivity'
      },
      customer: {
        token: 'customerToken',
        refreshToken: 'customerRefreshToken',
        data: 'customerData',
        lastActivity: 'customerLastActivity'
      },
      administrator: {
        token: 'adminToken',
        refreshToken: 'adminRefreshToken',
        data: 'adminData',
        lastActivity: 'adminLastActivity',
        requirePasswordChange: 'requirePasswordChange'
      },
      operator: {
        token: 'operatorToken',
        refreshToken: 'operatorRefreshToken',
        data: 'operatorData',
        lastActivity: 'operatorLastActivity'
      }
    },

    // Protected routes that require authentication
    PROTECTED_ROUTES: {
      affiliate: ['/affiliate-dashboard', '/affiliate-success'],
      customer: ['/customer-dashboard', '/customer-success', '/schedule-pickup', '/order-confirmation'],
      administrator: ['/administrator-dashboard'],
      operator: ['/operator-dashboard']
    },

    // Login routes
    LOGIN_ROUTES: {
      affiliate: '/affiliate-login',
      customer: '/customer-login',
      administrator: '/administrator-login',
      operator: '/operator-login'
    },

    // Check if user is authenticated for a specific role
    isAuthenticated(role) {
      const keys = this.STORAGE_KEYS[role];
      if (!keys) {
        console.log(`[SessionManager] No keys found for role: ${role}`);
        return false;
      }

      const token = localStorage.getItem(keys.token);
      const lastActivity = localStorage.getItem(keys.lastActivity);

      console.log(`[SessionManager] ${role} - Token exists:`, !!token);
      console.log(`[SessionManager] ${role} - Last activity:`, lastActivity);

      if (!token) {
        console.log(`[SessionManager] ${role} - No token found`);
        return false;
      }

      // Check if session has expired
      if (lastActivity) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const currentTime = Date.now();
        const timeDiff = currentTime - lastActivityTime;
        console.log(`[SessionManager] ${role} - Time since last activity:`, timeDiff, 'ms');
        
        if (timeDiff > this.SESSION_TIMEOUT) {
          console.log(`[SessionManager] ${role} - Session expired`);
          // Session expired, clear auth data
          this.clearAuth(role);
          return false;
        }
      } else {
        console.log(`[SessionManager] ${role} - No last activity timestamp found`);
        // If no lastActivity is set, consider it a new session and set it
        this.updateActivity(role);
      }

      // Special check for admin password change requirement
      if (role === 'administrator') {
        const requirePasswordChange = localStorage.getItem(keys.requirePasswordChange);
        console.log(`[SessionManager] ${role} - Require password change:`, requirePasswordChange);
        if (requirePasswordChange === 'true') {
          console.log(`[SessionManager] ${role} - Password change required, auth denied`);
          return false;
        }
      }

      console.log(`[SessionManager] ${role} - Authentication valid`);
      return true;
    },

    // Update last activity timestamp
    updateActivity(role) {
      const keys = this.STORAGE_KEYS[role];
      if (keys && localStorage.getItem(keys.token)) {
        localStorage.setItem(keys.lastActivity, Date.now().toString());
      }
    },

    // Clear authentication data for a role
    clearAuth(role) {
      const keys = this.STORAGE_KEYS[role];
      if (!keys) return;

      Object.values(keys).forEach(key => {
        localStorage.removeItem(key);
      });
    },

    // Get the appropriate route based on authentication status
    getAuthenticatedRoute(requestedRoute) {
      console.log('[SessionManager] getAuthenticatedRoute called with:', requestedRoute);
      
      // Check each role to see if user is authenticated
      for (const [role, protectedRoutes] of Object.entries(this.PROTECTED_ROUTES)) {
        const isAuth = this.isAuthenticated(role);
        console.log(`[SessionManager] Checking ${role} authentication:`, isAuth);
        
        if (isAuth) {
          // User is authenticated for this role
          
          // If requesting a protected route for this role, allow it
          if (protectedRoutes.includes(requestedRoute)) {
            console.log(`[SessionManager] Allowing protected route ${requestedRoute} for ${role}`);
            this.updateActivity(role);
            return requestedRoute;
          }
          
          // If requesting the login page for this role, redirect to dashboard
          if (requestedRoute === this.LOGIN_ROUTES[role]) {
            console.log(`[SessionManager] Redirecting ${role} from login to dashboard`);
            this.updateActivity(role);
            return `/${role}-dashboard`;
          }
          
          // If requesting a different role's protected route, continue checking
          // This allows multiple simultaneous logins
        }
      }

      // No authentication found, check if route requires auth
      for (const [role, protectedRoutes] of Object.entries(this.PROTECTED_ROUTES)) {
        if (protectedRoutes.includes(requestedRoute)) {
          // Route requires auth but user is not authenticated
          console.log(`[SessionManager] Route ${requestedRoute} requires auth, redirecting to ${this.LOGIN_ROUTES[role]}`);
          return this.LOGIN_ROUTES[role];
        }
      }

      // Route doesn't require auth or is a login page
      console.log(`[SessionManager] Route ${requestedRoute} doesn't require auth`);
      return requestedRoute;
    },

    // Store authentication data
    setAuth(role, data) {
      const keys = this.STORAGE_KEYS[role];
      if (!keys) return;

      if (data.token) {
        localStorage.setItem(keys.token, data.token);
      }
      if (data.refreshToken) {
        localStorage.setItem(keys.refreshToken, data.refreshToken);
      }
      if (data.userData) {
        localStorage.setItem(keys.data, JSON.stringify(data.userData));
      }
      
      // Set last activity
      localStorage.setItem(keys.lastActivity, Date.now().toString());
    },

    // Initialize session manager
    init() {
      // Set up activity tracking
      document.addEventListener('click', () => {
        // Update activity for all authenticated sessions
        Object.keys(this.STORAGE_KEYS).forEach(role => {
          if (this.isAuthenticated(role)) {
            this.updateActivity(role);
          }
        });
      });

      // Check for expired sessions periodically
      setInterval(() => {
        Object.keys(this.STORAGE_KEYS).forEach(role => {
          if (!this.isAuthenticated(role)) {
            // isAuthenticated will clear expired sessions
          }
        });
      }, 60000); // Check every minute
    }
  };

  // Make SessionManager available globally
  window.SessionManager = SessionManager;

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SessionManager.init());
  } else {
    SessionManager.init();
  }
})();