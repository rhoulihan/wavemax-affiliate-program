#!/usr/bin/env node

/**
 * Mark every message in the payments inbox as unread.
 *
 * Operational utility for re-running the payment-verification scanner
 * against an inbox that's already been processed (testing / replay /
 * after a bug fix). Uses imapflow — same client as the production
 * imapEmailScanner service.
 */

require('dotenv').config();
const { ImapFlow } = require('imapflow');
const SystemConfig = require('../../server/models/SystemConfig');
const { decrypt } = require('../../server/utils/encryption');
const mongoose = require('mongoose');

async function markEmailsAsUnread() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const host = await SystemConfig.getValue('imap_host', 'localhost');
  const port = parseInt(await SystemConfig.getValue('imap_port', '993'), 10);
  const user = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');

  const encryptedPassword = await SystemConfig.getValue('payment_email_password', '');
  if (!encryptedPassword) {
    console.error('Payment email password not configured');
    process.exit(1);
  }
  const password = decrypt(encryptedPassword);

  console.log(`Connecting to ${user} at ${host}:${port}...`);

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass: password },
    tls: { rejectUnauthorized: false, servername: host },
    logger: false
  });

  await client.connect();
  console.log('IMAP connection established');

  const lock = await client.getMailboxLock('INBOX');
  try {
    const status = await client.status('INBOX', { messages: true });
    console.log(`Inbox opened. Total messages: ${status.messages}`);

    const uids = await client.search({ all: true }, { uid: true });
    if (!uids || uids.length === 0) {
      console.log('No emails found in inbox');
    } else {
      console.log(`Found ${uids.length} emails. Marking as unread...`);
      await client.messageFlagsRemove({ uid: uids }, ['\\Seen'], { uid: true });
      console.log(`Successfully marked ${uids.length} emails as unread`);
    }
  } finally {
    lock.release();
  }

  await client.logout();
  await mongoose.disconnect();
  console.log('Done!');
}

markEmailsAsUnread().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
