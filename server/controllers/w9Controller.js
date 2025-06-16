// W-9 Controller for WaveMAX Laundry Affiliate Program

const { validationResult } = require('express-validator');
const Affiliate = require('../models/Affiliate');
const W9Document = require('../models/W9Document');
const w9Storage = require('../utils/w9Storage');
const emailService = require('../utils/emailService');
const W9AuditService = require('../services/w9AuditService');

/**
 * Upload W-9 document for affiliate
 */
exports.uploadW9Document = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const affiliateId = req.user.affiliateId;
    
    // Get affiliate
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }

    // Check if there's already a pending W-9
    const existingPending = await W9Document.findOne({
      affiliateId,
      isActive: true,
      verificationStatus: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({ 
        message: 'You already have a W-9 document pending review. Please wait for verification before uploading another.' 
      });
    }

    // Store the document
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.sessionID
    };

    // Log upload attempt
    await W9AuditService.logUploadAttempt(req, affiliateId, false, {
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    const result = await w9Storage.store(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      affiliateId,
      affiliateId,
      metadata
    );

    // Update affiliate W-9 status
    affiliate.w9Information.status = 'pending_review';
    affiliate.w9Information.submittedAt = new Date();
    affiliate.w9Information.documentId = result.documentId;
    await affiliate.save();

    // Log successful upload
    await W9AuditService.logUploadAttempt(req, affiliateId, true, {
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      documentId: result.documentId,
      encryptionMethod: 'AES-256-GCM'
    });

    // TODO: Send notification email to admin about new W-9 submission

    res.json({
      message: 'W-9 document uploaded successfully and is pending review',
      documentId: result.documentId,
      status: 'pending_review'
    });

  } catch (error) {
    console.error('Error uploading W-9:', error);
    
    // Log failed upload
    await W9AuditService.logUploadAttempt(req, req.user?.affiliateId, false, {
      errorMessage: error.message,
      errorCode: error.code
    });
    
    res.status(500).json({ message: 'Error uploading W-9 document', error: error.message });
  }
};

/**
 * Get W-9 status for authenticated affiliate
 */
exports.getW9Status = async (req, res) => {
  try {
    const affiliateId = req.user.affiliateId;
    
    const affiliate = await Affiliate.findOne({ affiliateId })
      .select('w9Information firstName lastName email');
    
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }

    const response = {
      status: affiliate.w9Information.status,
      statusDisplay: affiliate.getW9StatusDisplay(),
      canReceivePayments: affiliate.canReceivePayments(),
      submittedAt: affiliate.w9Information.submittedAt,
      verifiedAt: affiliate.w9Information.verifiedAt,
      rejectedAt: affiliate.w9Information.rejectedAt,
      rejectionReason: affiliate.w9Information.rejectionReason,
      expiryDate: affiliate.w9Information.expiryDate
    };

    // If verified, include masked tax info
    if (affiliate.w9Information.status === 'verified') {
      response.taxInfo = {
        type: affiliate.w9Information.taxIdType,
        last4: affiliate.w9Information.taxIdLast4,
        businessName: affiliate.w9Information.businessName
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Error getting W-9 status:', error);
    res.status(500).json({ message: 'Error retrieving W-9 status' });
  }
};

/**
 * Download own W-9 document
 */
exports.downloadOwnW9 = async (req, res) => {
  try {
    const affiliateId = req.user.affiliateId;
    
    // Find active W-9 document
    const w9Doc = await W9Document.findActiveForAffiliate(affiliateId);
    
    if (!w9Doc) {
      return res.status(404).json({ message: 'No W-9 document found' });
    }

    // Retrieve document
    const fileData = await w9Storage.retrieve(w9Doc.documentId, affiliateId);
    
    // Log download
    await W9AuditService.logDownload(req, affiliateId, w9Doc.documentId, false);
    
    // Set headers for PDF download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="W9_${affiliateId}.pdf"`,
      'Content-Length': fileData.buffer.length
    });

    res.send(fileData.buffer);

  } catch (error) {
    console.error('Error downloading W-9:', error);
    res.status(500).json({ message: 'Error downloading W-9 document' });
  }
};

// ===== Admin Functions =====

/**
 * Get pending W-9 documents for review
 */
exports.getPendingW9Documents = async (req, res) => {
  try {
    const pendingDocs = await W9Document.find({
      verificationStatus: 'pending',
      isActive: true
    })
    .populate('affiliateId', 'affiliateId firstName lastName email businessName')
    .sort({ uploadedAt: 1 });

    const formattedDocs = pendingDocs.map(doc => ({
      documentId: doc.documentId,
      affiliateId: doc.affiliateId.affiliateId,
      affiliateName: `${doc.affiliateId.firstName} ${doc.affiliateId.lastName}`,
      affiliateEmail: doc.affiliateId.email,
      businessName: doc.affiliateId.businessName,
      uploadedAt: doc.uploadedAt,
      daysWaiting: Math.floor((new Date() - doc.uploadedAt) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      count: formattedDocs.length,
      documents: formattedDocs
    });

  } catch (error) {
    console.error('Error getting pending W-9s:', error);
    res.status(500).json({ message: 'Error retrieving pending W-9 documents' });
  }
};

/**
 * Download W-9 document for admin review
 */
exports.downloadW9ForReview = async (req, res) => {
  try {
    const { documentId } = req.params;
    const adminId = req.user.id;
    
    // Find document
    const w9Doc = await W9Document.findOne({ documentId })
      .populate('affiliateId', 'affiliateId firstName lastName');
    
    if (!w9Doc) {
      return res.status(404).json({ message: 'W-9 document not found' });
    }

    // Retrieve document
    const fileData = await w9Storage.retrieve(documentId, `admin:${adminId}`);
    
    // Log admin download
    await W9AuditService.logDownload(
      req, 
      w9Doc.affiliateId.affiliateId, 
      documentId, 
      true  // isAdminDownload
    );
    
    // Set headers for PDF download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="W9_${w9Doc.affiliateId.affiliateId}_${w9Doc.affiliateId.lastName}.pdf"`,
      'Content-Length': fileData.buffer.length
    });

    res.send(fileData.buffer);

  } catch (error) {
    console.error('Error downloading W-9 for review:', error);
    res.status(500).json({ message: 'Error downloading W-9 document' });
  }
};

/**
 * Verify W-9 document and update affiliate tax information
 */
exports.verifyW9Document = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { affiliateId } = req.params;
    const { taxIdType, taxIdLast4, businessName, quickbooksVendorId, notes } = req.body;
    const adminId = req.user.id;

    // Find affiliate and active W-9 document
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }

    const w9Doc = await W9Document.findActiveForAffiliate(affiliateId);
    if (!w9Doc) {
      return res.status(404).json({ message: 'No W-9 document found for this affiliate' });
    }

    // Update W-9 document
    w9Doc.verificationStatus = 'verified';
    w9Doc.verifiedAt = new Date();
    w9Doc.verifiedBy = adminId;
    await w9Doc.save();

    // Update affiliate information
    affiliate.w9Information.status = 'verified';
    affiliate.w9Information.verifiedAt = new Date();
    affiliate.w9Information.verifiedBy = adminId;
    affiliate.w9Information.taxIdType = taxIdType;
    affiliate.w9Information.taxIdLast4 = taxIdLast4;
    affiliate.w9Information.businessName = businessName || affiliate.businessName;
    affiliate.w9Information.quickbooksVendorId = quickbooksVendorId;
    
    // Set expiry date (3 years from verification)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 3);
    affiliate.w9Information.expiryDate = expiryDate;

    // Update QuickBooks data
    if (quickbooksVendorId) {
      affiliate.w9Information.quickbooksData.displayName = businessName || `${affiliate.firstName} ${affiliate.lastName}`;
    }

    await affiliate.save();

    // Log verification
    await W9AuditService.logVerification(req, affiliateId, w9Doc.documentId, {
      taxIdType,
      taxIdLast4,
      businessName,
      quickbooksVendorId
    });

    // TODO: Send confirmation email to affiliate

    res.json({
      message: 'W-9 document verified successfully',
      affiliate: {
        affiliateId: affiliate.affiliateId,
        name: `${affiliate.firstName} ${affiliate.lastName}`,
        w9Status: affiliate.w9Information.status,
        canReceivePayments: affiliate.canReceivePayments()
      }
    });

  } catch (error) {
    console.error('Error verifying W-9:', error);
    res.status(500).json({ message: 'Error verifying W-9 document' });
  }
};

/**
 * Reject W-9 document
 */
exports.rejectW9Document = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { affiliateId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    // Find affiliate and active W-9 document
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }

    const w9Doc = await W9Document.findActiveForAffiliate(affiliateId);
    if (!w9Doc) {
      return res.status(404).json({ message: 'No W-9 document found for this affiliate' });
    }

    // Update W-9 document
    w9Doc.verificationStatus = 'rejected';
    w9Doc.isActive = false; // Deactivate rejected document
    await w9Doc.save();

    // Update affiliate information
    affiliate.w9Information.status = 'rejected';
    affiliate.w9Information.rejectedAt = new Date();
    affiliate.w9Information.rejectedBy = adminId;
    affiliate.w9Information.rejectionReason = reason;
    affiliate.w9Information.documentId = null; // Clear document reference

    await affiliate.save();

    // Log rejection
    await W9AuditService.logRejection(req, affiliateId, w9Doc.documentId, reason);

    // TODO: Send rejection email to affiliate with reason

    res.json({
      message: 'W-9 document rejected',
      affiliate: {
        affiliateId: affiliate.affiliateId,
        name: `${affiliate.firstName} ${affiliate.lastName}`,
        w9Status: affiliate.w9Information.status
      }
    });

  } catch (error) {
    console.error('Error rejecting W-9:', error);
    res.status(500).json({ message: 'Error rejecting W-9 document' });
  }
};

/**
 * Get W-9 submission history for an affiliate
 */
exports.getW9History = async (req, res) => {
  try {
    const { affiliateId } = req.params;

    const documents = await W9Document.find({ affiliateId })
      .populate('verifiedBy', 'name email')
      .sort({ uploadedAt: -1 });

    const history = documents.map(doc => ({
      documentId: doc.documentId,
      uploadedAt: doc.uploadedAt,
      verificationStatus: doc.verificationStatus,
      verifiedAt: doc.verifiedAt,
      verifiedBy: doc.verifiedBy ? {
        name: doc.verifiedBy.name,
        email: doc.verifiedBy.email
      } : null,
      isActive: doc.isActive,
      expiryDate: doc.expiryDate
    }));

    res.json({
      affiliateId,
      documentCount: history.length,
      history
    });

  } catch (error) {
    console.error('Error getting W-9 history:', error);
    res.status(500).json({ message: 'Error retrieving W-9 history' });
  }
};

/**
 * Get audit logs for W-9 operations
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { 
      action, 
      affiliateId, 
      startDate, 
      endDate, 
      limit = 100,
      offset = 0 
    } = req.query;

    // Build query
    const query = {};
    
    if (action) {
      query.action = action;
    }
    
    if (affiliateId) {
      query['targetInfo.affiliateId'] = affiliateId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endOfDay;
      }
    }

    const W9AuditLog = require('../models/W9AuditLog');
    
    // Get total count for pagination
    const totalCount = await W9AuditLog.countDocuments(query);
    
    // Get logs with pagination
    const logs = await W9AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({
      success: true,
      totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
      logs: logs.map(log => ({
        id: log._id,
        timestamp: log.timestamp,
        action: log.action,
        userInfo: log.userInfo,
        targetInfo: log.targetInfo,
        metadata: log.metadata,
        details: log.details
      }))
    });

  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving audit logs',
      error: error.message 
    });
  }
};

/**
 * Export audit logs as CSV
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const { 
      action, 
      affiliateId, 
      startDate, 
      endDate,
      format = 'csv'
    } = req.query;

    // Build query (same as getAuditLogs)
    const query = {};
    
    if (action) {
      query.action = action;
    }
    
    if (affiliateId) {
      query['targetInfo.affiliateId'] = affiliateId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endOfDay;
      }
    }

    const W9AuditLog = require('../models/W9AuditLog');
    
    // Get all matching logs (no pagination for export)
    const logs = await W9AuditLog.find(query)
      .sort({ timestamp: -1 });

    if (format === 'csv') {
      const csv = require('csv-writer').createObjectCsvStringifier;
      
      const csvStringifier = csv({
        header: [
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'action', title: 'Action' },
          { id: 'userId', title: 'User ID' },
          { id: 'userType', title: 'User Type' },
          { id: 'userName', title: 'User Name' },
          { id: 'affiliateId', title: 'Affiliate ID' },
          { id: 'documentId', title: 'Document ID' },
          { id: 'ipAddress', title: 'IP Address' },
          { id: 'userAgent', title: 'User Agent' },
          { id: 'success', title: 'Success' },
          { id: 'reason', title: 'Reason' },
          { id: 'error', title: 'Error' }
        ]
      });

      const records = logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        action: log.action,
        userId: log.userInfo?.userId || '',
        userType: log.userInfo?.userType || '',
        userName: log.userInfo?.userName || '',
        affiliateId: log.targetInfo?.affiliateId || '',
        documentId: log.targetInfo?.documentId || '',
        ipAddress: log.metadata?.ipAddress || '',
        userAgent: log.metadata?.userAgent || '',
        success: log.details?.success !== undefined ? log.details.success : '',
        reason: log.details?.reason || '',
        error: log.details?.error || ''
      }));

      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `w9-audit-log-${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvContent);
    }

    // Return JSON format
    res.json({
      success: true,
      exportDate: new Date(),
      recordCount: logs.length,
      logs: logs.map(log => ({
        timestamp: log.timestamp,
        action: log.action,
        userInfo: log.userInfo,
        targetInfo: log.targetInfo,
        metadata: log.metadata,
        details: log.details
      }))
    });

  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error exporting audit logs',
      error: error.message 
    });
  }
};