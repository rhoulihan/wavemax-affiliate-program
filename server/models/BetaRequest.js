const mongoose = require('mongoose');

const betaRequestSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    businessName: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: 2
    },
    zipCode: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'invited'],
        default: 'pending'
    },
    inviteSentAt: {
        type: Date
    },
    invitationToken: {
        type: String,
        unique: true,
        sparse: true
    },
    approvedBy: {
        type: String
    },
    approvedAt: {
        type: Date
    },
    rejectedReason: {
        type: String
    },
    rejectedAt: {
        type: Date
    },
    notes: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp on save
betaRequestSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Generate invitation token
betaRequestSchema.methods.generateInvitationToken = function() {
    const crypto = require('crypto');
    this.invitationToken = crypto.randomBytes(32).toString('hex');
    return this.invitationToken;
};

// Check if request is expired (older than 30 days)
betaRequestSchema.methods.isExpired = function() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.createdAt < thirtyDaysAgo;
};

// Static method to find pending requests
betaRequestSchema.statics.findPending = function() {
    return this.find({ status: 'pending' }).sort('-createdAt');
};

// Static method to find by email
betaRequestSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

module.exports = mongoose.model('BetaRequest', betaRequestSchema);