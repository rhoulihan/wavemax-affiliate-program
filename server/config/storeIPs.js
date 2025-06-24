// Store IP Configuration for WaveMAX Affiliate Program
// These IP addresses are trusted store locations where operators work
// Sessions from these IPs will be automatically renewed

// Load configuration from environment variables
// Use existing STORE_IP_ADDRESS variable, with support for multiple IPs
const storeIPAddress = process.env.STORE_IP_ADDRESS;
const additionalIPs = process.env.ADDITIONAL_STORE_IPS;

const whitelistedIPs = [];
if (storeIPAddress) {
  whitelistedIPs.push(storeIPAddress.trim());
}
if (additionalIPs) {
  whitelistedIPs.push(...additionalIPs.split(',').map(ip => ip.trim()).filter(ip => ip));
}

const whitelistedRanges = process.env.STORE_IP_RANGES
  ? process.env.STORE_IP_RANGES.split(',').map(range => range.trim()).filter(range => range)
  : [];

module.exports = {
  // Store IP whitelist - loaded from environment
  whitelistedIPs,
  
  // IP ranges (CIDR notation) - for store networks
  whitelistedRanges,
  
  // Session renewal settings
  sessionRenewal: {
    // How often to check if token needs renewal (in milliseconds)
    checkInterval: parseInt(process.env.STORE_SESSION_CHECK_INTERVAL || 300000), // Default: 5 minutes
    
    // Renew token when it has less than this much time left (in milliseconds)
    renewThreshold: parseInt(process.env.STORE_SESSION_RENEW_THRESHOLD || 1800000), // Default: 30 minutes
    
    // Maximum session duration for store IPs (in milliseconds)
    maxSessionDuration: parseInt(process.env.STORE_SESSION_MAX_DURATION || 86400000), // Default: 24 hours
  },
  
  // Function to check if an IP is whitelisted
  isWhitelisted(ip) {
    // Direct IP match
    if (this.whitelistedIPs.includes(ip)) {
      return true;
    }
    
    // Check IP ranges (requires ip-range-check package)
    // Simplified check for now - can be enhanced with proper CIDR matching
    for (const range of this.whitelistedRanges) {
      if (this.isInRange(ip, range)) {
        return true;
      }
    }
    
    return false;
  },
  
  // Simple IP range checker
  isInRange(ip, cidr) {
    try {
      // Basic CIDR validation and parsing
      const [network, bits] = cidr.split('/');
      if (!bits || !network) return false;
      
      const maskBits = parseInt(bits);
      if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return false;
      
      // Convert IPs to integers for comparison
      const ipToInt = (addr) => {
        const parts = addr.split('.');
        if (parts.length !== 4) return null;
        
        let result = 0;
        for (let i = 0; i < 4; i++) {
          const num = parseInt(parts[i]);
          if (isNaN(num) || num < 0 || num > 255) return null;
          result = (result * 256) + num; // Use multiplication to avoid sign issues
        }
        return result >>> 0; // Force unsigned
      };
      
      const ipInt = ipToInt(ip);
      const netInt = ipToInt(network);
      
      if (ipInt === null || netInt === null) return false;
      
      // Create mask - need to handle JavaScript's signed 32-bit integers
      const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
      
      // Check if IP is in range
      return (ipInt & mask) === (netInt & mask);
    } catch (error) {
      console.error('Error checking IP range:', error);
      return false;
    }
  }
};