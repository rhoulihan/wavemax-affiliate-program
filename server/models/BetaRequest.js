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
    welcomeEmailSent: {
        type: Boolean,
        default: false
    },
    welcomeEmailSentAt: {
        type: Date
    },
    welcomeEmailSentBy: {
        type: String
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

// Static method to find all requests
betaRequestSchema.statics.findAllRequests = function() {
    return this.find({}).sort('-createdAt');
};

// Static method to find by email
betaRequestSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

module.exports = mongoose.model('BetaRequest', betaRequestSchema);