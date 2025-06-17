const mongoose = require('mongoose');

/**
 * DocuSignToken Model
 * Stores OAuth tokens for DocuSign integration
 */
const docuSignTokenSchema = new mongoose.Schema({
  // Token identifier (we'll use 'default' for single-tenant)
  tokenId: {
    type: String,
    default: 'default',
    unique: true,
    index: true
  },
  
  // OAuth tokens
  accessToken: {
    type: String,
    required: true
  },
  
  refreshToken: {
    type: String,
    required: true
  },
  
  // Token expiration
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  // Token metadata
  tokenType: {
    type: String,
    default: 'Bearer'
  },
  
  scope: {
    type: String
  },
  
  // User who authorized
  authorizedBy: {
    userId: String,
    userEmail: String,
    authorizedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Last used
  lastUsed: {
    type: Date,
    default: Date.now
  },
  
  // Token status
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'docusigntokens'
});

// Instance method to check if token is valid
docuSignTokenSchema.methods.isValid = function() {
  return this.status === 'active' && this.expiresAt > new Date();
};

// Static method to get current token
docuSignTokenSchema.statics.getCurrentToken = async function() {
  const token = await this.findOne({ tokenId: 'default', status: 'active' });
  if (token && token.isValid()) {
    return token;
  }
  return null;
};

// Static method to save new token
docuSignTokenSchema.statics.saveToken = async function(tokenData, authorizedBy = null) {
  try {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    const updateData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: expiresAt,
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope,
      status: 'active',
      lastUsed: new Date()
    };
    
    if (authorizedBy) {
      updateData.authorizedBy = {
        userId: authorizedBy.userId,
        userEmail: authorizedBy.userEmail,
        authorizedAt: new Date()
      };
    }
    
    const token = await this.findOneAndUpdate(
      { tokenId: 'default' },
      updateData,
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );
    
    console.log('DocuSignToken saved:', {
      tokenId: token.tokenId,
      expiresAt: token.expiresAt,
      status: token.status
    });
    
    return token;
  } catch (error) {
    console.error('Failed to save DocuSign token:', error);
    throw error;
  }
};

const DocuSignToken = mongoose.model('DocuSignToken', docuSignTokenSchema);

module.exports = DocuSignToken;