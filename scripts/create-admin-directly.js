#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const Administrator = require('../server/models/Administrator');
const emailService = require('../server/utils/emailService');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function questionHidden(query) {
  return new Promise(resolve => {
    process.stdout.write(query);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    process.stdin.on('data', function(char) {
      char = char + '';

      switch(char) {
      case '\n':
      case '\r':
      case '\u0004':
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(password);
        break;
      case '\u0003':
        process.exit();
        break;
      case '\u007f':
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
        break;
      default:
        password += char;
        process.stdout.write('*');
        break;
      }
    });
  });
}

async function generateAdminId() {
  const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
  if (!lastAdmin) {
    return 'ADM001';
  }

  const lastNumber = parseInt(lastAdmin.adminId.substring(3));
  const nextNumber = lastNumber + 1;
  return `ADM${nextNumber.toString().padStart(3, '0')}`;
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');
    console.log('\n=== Create New Administrator ===\n');

    const firstName = await question('First Name: ');
    const lastName = await question('Last Name: ');
    const email = await question('Email: ');
    const password = await questionHidden('Password: ');

    console.log('\nAvailable permissions:');
    console.log('1. system_config - Manage system settings');
    console.log('2. operator_management - Manage operators');
    console.log('3. view_analytics - View analytics and reports');
    console.log('4. manage_affiliates - Manage affiliate accounts');

    const permissionInput = await question('\nSelect permissions (enter numbers separated by commas, or "all" for all permissions): ');

    let permissions = [];
    if (permissionInput.toLowerCase() === 'all') {
      permissions = ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'];
    } else {
      const permissionMap = {
        '1': 'system_config',
        '2': 'operator_management',
        '3': 'view_analytics',
        '4': 'manage_affiliates'
      };

      const selectedNumbers = permissionInput.split(',').map(s => s.trim());
      permissions = selectedNumbers.map(num => permissionMap[num]).filter(Boolean);
    }

    const adminId = await generateAdminId();

    const admin = new Administrator({
      adminId,
      firstName,
      lastName,
      email,
      password,
      permissions,
      isActive: true
    });

    await admin.save();
    console.log('\n✓ Administrator created successfully!');
    console.log(`  Admin ID: ${admin.adminId}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Permissions: ${permissions.join(', ')}`);

    console.log('\nSending welcome email...');
    try {
      await emailService.sendAdministratorWelcomeEmail(admin);
      console.log('✓ Welcome email sent successfully!');
    } catch (emailError) {
      console.error('✗ Failed to send welcome email:', emailError.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
    await mongoose.connection.close();
  }
}

main();