#!/usr/bin/env node
/**
 * MongoDB Atlas Restore Script
 * Restores collections from JSON backup files
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BACKUP_DIR = '/root/recover/mongodb-backups';

async function listBackups() {
  const backups = await fs.readdir(BACKUP_DIR);
  return backups.filter(b => b.startsWith('backup-')).sort().reverse();
}

async function restore(backupName) {
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    // Check if backup exists
    await fs.access(backupPath);
  } catch {
    console.error(`Backup not found: ${backupPath}`);
    const available = await listBackups();
    console.log('\nAvailable backups:');
    available.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
    process.exit(1);
  }

  console.log(`Restoring from: ${backupPath}`);
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const files = await fs.readdir(backupPath);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} collections to restore\n`);

  for (const file of jsonFiles) {
    const collectionName = file.replace('.json', '');
    const filePath = path.join(backupPath, file);
    const content = await fs.readFile(filePath, 'utf8');
    const docs = JSON.parse(content);

    if (docs.length > 0) {
      // Clear existing data and insert backup data
      await mongoose.connection.db.collection(collectionName).deleteMany({});
      await mongoose.connection.db.collection(collectionName).insertMany(docs);
      console.log(`  ${collectionName}: restored ${docs.length} documents`);
    }
  }

  console.log('\nRestore complete!');
  await mongoose.disconnect();
  process.exit(0);
}

// Main
const args = process.argv.slice(2);
if (args[0] === '--list') {
  listBackups().then(backups => {
    console.log('Available backups:');
    backups.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
    process.exit(0);
  });
} else if (args[0]) {
  restore(args[0]).catch(e => {
    console.error('Restore failed:', e.message);
    process.exit(1);
  });
} else {
  console.log('Usage:');
  console.log('  node restore-database.js --list           # List available backups');
  console.log('  node restore-database.js backup-2025-...  # Restore specific backup');
  process.exit(0);
}
