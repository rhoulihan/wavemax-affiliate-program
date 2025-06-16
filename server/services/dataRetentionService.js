const cron = require('node-cron');
const W9Document = require('../models/W9Document');
const W9AuditLog = require('../models/W9AuditLog');
const W9AuditService = require('./w9AuditService');
const w9Storage = require('../utils/w9Storage');
const logger = require('../config/logger');

/**
 * Data Retention Service
 * Manages automatic cleanup and archival of W-9 documents and audit logs
 */
class DataRetentionService {
    /**
     * Initialize the data retention scheduler
     */
    static initialize() {
        // Run daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            logger.info('Running daily data retention check');
            await this.performRetentionCheck();
        });

        // Run monthly audit log archival on the 1st at 3 AM
        cron.schedule('0 3 1 * *', async () => {
            logger.info('Running monthly audit log archival');
            await this.archiveOldAuditLogs();
        });

        logger.info('Data retention service initialized');
    }

    /**
     * Perform retention check for W-9 documents
     */
    static async performRetentionCheck() {
        try {
            // Check for expired W-9 documents (older than 3 years)
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() - 3);

            const expiredDocuments = await W9Document.find({
                isActive: true,
                verifiedAt: { $lt: expiryDate },
                deleted: false
            });

            logger.info(`Found ${expiredDocuments.length} expired W-9 documents`);

            for (const doc of expiredDocuments) {
                try {
                    // Update affiliate status
                    const Affiliate = require('../models/Affiliate');
                    const affiliate = await Affiliate.findOne({ affiliateId: doc.affiliateId });
                    
                    if (affiliate) {
                        affiliate.w9Information.status = 'expired';
                        affiliate.w9Information.expiryDate = new Date();
                        await affiliate.save();
                    }

                    // Mark document as expired
                    doc.isActive = false;
                    doc.expiryDate = new Date();
                    await doc.save();

                    // Log the expiration
                    await W9AuditLog.logAction(
                        'expire',
                        { userId: 'system', userType: 'system', userName: 'Data Retention Service' },
                        { affiliateId: doc.affiliateId, documentId: doc.documentId },
                        { success: true, reason: 'Document age exceeds 3 year retention policy' }
                    );

                    logger.info(`Expired W-9 document ${doc.documentId} for affiliate ${doc.affiliateId}`);
                } catch (error) {
                    logger.error(`Error expiring document ${doc.documentId}:`, error);
                }
            }

            // Check for documents marked for deletion (older than 7 years)
            const deletionDate = new Date();
            deletionDate.setFullYear(deletionDate.getFullYear() - 7);

            const documentsToDelete = await W9Document.find({
                uploadedAt: { $lt: deletionDate },
                deleted: false,
                legalHold: false
            });

            logger.info(`Found ${documentsToDelete.length} W-9 documents for deletion`);

            for (const doc of documentsToDelete) {
                try {
                    // Delete the encrypted file
                    await w9Storage.delete(doc.documentId);

                    // Soft delete the database record
                    doc.deleted = true;
                    doc.deletedAt = new Date();
                    doc.deletedBy = 'system_retention_policy';
                    await doc.save();

                    // Log the deletion
                    await W9AuditLog.logAction(
                        'delete',
                        { userId: 'system', userType: 'system', userName: 'Data Retention Service' },
                        { affiliateId: doc.affiliateId, documentId: doc.documentId },
                        { success: true, reason: '7 year retention policy' }
                    );

                    logger.info(`Deleted W-9 document ${doc.documentId} per retention policy`);
                } catch (error) {
                    logger.error(`Error deleting document ${doc.documentId}:`, error);
                }
            }

            // Generate retention report
            const report = {
                date: new Date(),
                expired: expiredDocuments.length,
                deleted: documentsToDelete.length,
                errors: []
            };

            logger.info('Data retention check completed', report);

        } catch (error) {
            logger.error('Error in data retention check:', error);
        }
    }

    /**
     * Archive old audit logs
     */
    static async archiveOldAuditLogs() {
        try {
            const result = await W9AuditService.archiveOldLogs();
            logger.info('Audit log archival completed', result);
        } catch (error) {
            logger.error('Error archiving audit logs:', error);
        }
    }

    /**
     * Generate compliance report
     */
    static async generateComplianceReport(startDate, endDate) {
        try {
            const report = await W9AuditService.generateComplianceReport(startDate, endDate);
            
            // Add data retention compliance
            const retentionCompliance = await this.checkRetentionCompliance();
            report.retentionCompliance = retentionCompliance;

            return report;
        } catch (error) {
            logger.error('Error generating compliance report:', error);
            throw error;
        }
    }

    /**
     * Check retention compliance
     */
    static async checkRetentionCompliance() {
        const now = new Date();
        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
        const sevenYearsAgo = new Date();
        sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

        // Check for documents that should be expired
        const shouldBeExpired = await W9Document.countDocuments({
            isActive: true,
            verifiedAt: { $lt: threeYearsAgo },
            deleted: false
        });

        // Check for documents that should be deleted
        const shouldBeDeleted = await W9Document.countDocuments({
            uploadedAt: { $lt: sevenYearsAgo },
            deleted: false,
            legalHold: false
        });

        // Check documents on legal hold
        const onLegalHold = await W9Document.countDocuments({
            legalHold: true
        });

        return {
            compliant: shouldBeExpired === 0 && shouldBeDeleted === 0,
            documentsNeedingExpiry: shouldBeExpired,
            documentsNeedingDeletion: shouldBeDeleted,
            documentsOnLegalHold: onLegalHold,
            lastCheck: now
        };
    }

    /**
     * Place document on legal hold
     */
    static async setLegalHold(documentId, hold = true, reason = '') {
        try {
            const document = await W9Document.findOne({ documentId });
            if (!document) {
                throw new Error('Document not found');
            }

            document.legalHold = hold;
            document.legalHoldReason = hold ? reason : null;
            document.legalHoldDate = hold ? new Date() : null;
            await document.save();

            // Log the legal hold action
            await W9AuditLog.logAction(
                'legal_hold',
                { userId: 'system', userType: 'system', userName: 'Legal Hold System' },
                { affiliateId: document.affiliateId, documentId: document.documentId },
                { success: true, hold, reason }
            );

            return document;
        } catch (error) {
            logger.error('Error setting legal hold:', error);
            throw error;
        }
    }
}

module.exports = DataRetentionService;