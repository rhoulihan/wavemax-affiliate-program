#!/usr/bin/env node
/**
 * MongoDB Atlas Backup Script
 * Exports all collections to JSON files
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BACKUP_DIR = '/root/recover/mongodb-backups';

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // Create backup directory
    await fs.mkdir(backupPath, { recursive: true });

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections`);

    let totalDocs = 0;
    for (const col of collections) {
      const name = col.name;
      const docs = await mongoose.connection.db.collection(name).find({}).toArray();

      if (docs.length > 0) {
        const filePath = path.join(backupPath, `${name}.json`);
        await fs.writeFile(filePath, JSON.stringify(docs, null, 2));
        console.log(`  ${name}: ${docs.length} documents`);
        totalDocs += docs.length;
      }
    }

    console.log(`\nBackup complete: ${backupPath}`);
    console.log(`Total documents: ${totalDocs}`);

    // Cleanup old backups (keep last 7)
    const backups = await fs.readdir(BACKUP_DIR);
    const sorted = backups.filter(b => b.startsWith('backup-')).sort().reverse();
    for (const old of sorted.slice(7)) {
      await fs.rm(path.join(BACKUP_DIR, old), { recursive: true });
      console.log(`Removed old backup: ${old}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
}

backup();
