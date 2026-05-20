/**
 * IMAP Email Scanner Service
 *
 * Connects to payments@wavemax.promo via IMAP to read inbound payment-
 * confirmation emails (Venmo / PayPal / CashApp). Backing client is
 * `imapflow` — a maintained, promise-based replacement for the previous
 * `imap` package, which had been unmaintained since 2018 and pulled an
 * ancient `utf7` dep chain with 4 high-severity CVEs.
 *
 * Public API is unchanged for callers (paymentEmailScanner.js,
 * orderController.js): `connect()`, `getUnreadEmails()`, `markAsRead(uid)`,
 * `moveToFolder(uid, folderName)`, `disconnect()`.
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const SystemConfig = require('../models/SystemConfig');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');

class IMAPEmailScanner {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  /**
   * Initialize IMAP connection.
   * @returns {Promise<boolean>} true on success, false if not configured.
   */
  async connect() {
    try {
      const host = await SystemConfig.getValue('imap_host', 'localhost');
      const port = parseInt(await SystemConfig.getValue('imap_port', '993'), 10);
      const user = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');

      const encryptedPassword = await SystemConfig.getValue('payment_email_password', '');
      if (!encryptedPassword) {
        logger.warn('Payment email password not configured');
        return false;
      }

      const password = decrypt(encryptedPassword);

      this.client = new ImapFlow({
        host,
        port,
        secure: port === 993,
        auth: { user, pass: password },
        // Mailcow/Dovecot can ship a self-signed cert — accept it, but
        // still send SNI so the server can pick the right cert.
        tls: {
          rejectUnauthorized: false,
          servername: host
        },
        logger: false  // we route significant events through Winston ourselves
      });

      // Surface unexpected protocol errors (network drop, server bounce).
      this.client.on('error', (err) => {
        logger.error('IMAP client error:', { message: err.message });
        this.connected = false;
      });

      await this.client.connect();
      this.connected = true;
      logger.info('IMAP connection established');
      return true;
    } catch (error) {
      logger.error('Error connecting to IMAP:', { message: error.message });
      this.connected = false;
      return false;
    }
  }

  /**
   * Fetch unread emails from INBOX. Messages are NOT marked seen here —
   * the caller decides when to flag them (after successful processing).
   * @returns {Promise<Array<Object>>} parsed email objects.
   */
  async getUnreadEmails() {
    if (!this.connected) {
      const ok = await this.connect();
      if (!ok) return [];
    }

    const lock = await this.client.getMailboxLock('INBOX');
    const emails = [];

    try {
      // imapflow's search returns UIDs by default. Empty array if no match.
      const uids = await this.client.search({ seen: false }, { uid: true });
      if (!uids || uids.length === 0) {
        logger.info('No unread emails found');
        return emails;
      }
      logger.info(`Found ${uids.length} unread emails`);

      // Fetch raw RFC822 source so mailparser can do the full multipart
      // walk + HTML/text extraction. Iterating with for-await releases
      // backpressure correctly on large mailboxes.
      for await (const msg of this.client.fetch(uids, {
        uid: true,
        flags: true,
        source: true,
        envelope: true
      })) {
        try {
          const parsed = await simpleParser(msg.source);

          const emailData = {
            seqno: msg.seq,
            uid: msg.uid,
            flags: Array.from(msg.flags || []),
            headers: {},
            from: parsed.from?.text || '',
            fromAddress: parsed.from?.value?.[0]?.address || '',
            subject: parsed.subject || '',
            date: parsed.date || new Date(),
            messageId: parsed.messageId || '',
            text: parsed.text || '',
            html: parsed.html || ''
          };

          emails.push(emailData);
          logger.info(`Parsed message uid=${msg.uid} subject="${emailData.subject}" from="${emailData.fromAddress}"`);
        } catch (parseErr) {
          logger.error(`Error parsing message uid=${msg.uid}:`, { message: parseErr.message });
        }
      }

      logger.info(`Returning ${emails.length} parsed emails`);
      return emails;
    } finally {
      lock.release();
    }
  }

  /**
   * Mark a message as read (adds the \Seen flag).
   * @param {number} uid
   * @returns {Promise<boolean>}
   */
  async markAsRead(uid) {
    if (!this.connected) return false;

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      await this.client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
      logger.info(`Marked email ${uid} as read`);
      return true;
    } catch (err) {
      logger.error('Error marking email as read:', { message: err.message, uid });
      return false;
    } finally {
      lock.release();
    }
  }

  /**
   * Move a message to a destination folder (copy + expunge under the hood).
   * @param {number} uid
   * @param {string} folderName
   * @returns {Promise<boolean>}
   */
  async moveToFolder(uid, folderName) {
    if (!this.connected) return false;

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      await this.client.messageMove({ uid }, folderName, { uid: true });
      logger.info(`Moved email ${uid} to ${folderName}`);
      return true;
    } catch (err) {
      logger.error(`Error moving email ${uid} to ${folderName}:`, { message: err.message });
      return false;
    } finally {
      lock.release();
    }
  }

  /**
   * Gracefully close the IMAP connection.
   */
  async disconnect() {
    if (this.client && this.connected) {
      try {
        await this.client.logout();
      } catch (err) {
        // logout() throws if the socket is already gone — ignorable.
      }
      this.connected = false;
    }
  }
}

module.exports = new IMAPEmailScanner();
