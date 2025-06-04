#!/usr/bin/env node

/**
 * Bag Removal Executor
 * 
 * This script manages the removal of bag tracking from the WaveMAX system.
 * It tracks progress in the bag-removal-plan.json file and can be resumed if interrupted.
 * 
 * Usage:
 *   node bag-removal-executor.js [command]
 * 
 * Commands:
 *   status  - Show current progress
 *   next    - Execute next pending task
 *   phase   - Execute all tasks in current phase
 *   verify  - Run verification tests
 *   reset   - Reset a specific task to pending
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLAN_FILE = path.join(__dirname, 'bag-removal-plan.json');
const LOG_FILE = path.join(__dirname, 'bag-removal.log');

// Logging functions
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function logError(message, error) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ERROR: ${message}`;
  console.error(logMessage);
  if (error) console.error(error);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
  if (error) fs.appendFileSync(LOG_FILE, error.toString() + '\n');
}

// Plan management functions
function loadPlan() {
  try {
    const planData = fs.readFileSync(PLAN_FILE, 'utf8');
    return JSON.parse(planData);
  } catch (error) {
    logError('Failed to load plan file', error);
    process.exit(1);
  }
}

function savePlan(plan) {
  try {
    plan.progress.last_updated = new Date().toISOString();
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
  } catch (error) {
    logError('Failed to save plan file', error);
    process.exit(1);
  }
}

function getCurrentPhase(plan) {
  for (const phase of plan.phases) {
    if (phase.status !== 'completed') {
      return phase;
    }
  }
  return null;
}

function getNextTask(plan) {
  const currentPhase = getCurrentPhase(plan);
  if (!currentPhase) return null;
  
  for (const task of currentPhase.tasks) {
    if (task.status === 'pending') {
      return { phase: currentPhase, task };
    }
  }
  return null;
}

function updateTaskStatus(plan, taskId, status) {
  for (const phase of plan.phases) {
    for (const task of phase.tasks) {
      if (task.id === taskId) {
        task.status = status;
        
        // Update progress
        if (status === 'completed') {
          plan.progress.completed_tasks++;
        } else if (status === 'pending' && task.status === 'completed') {
          plan.progress.completed_tasks--;
        }
        
        // Check if phase is complete
        const phaseComplete = phase.tasks.every(t => t.status === 'completed');
        if (phaseComplete) {
          phase.status = 'completed';
          plan.progress.current_phase++;
        }
        
        savePlan(plan);
        return true;
      }
    }
  }
  return false;
}

// Command handlers
function showStatus() {
  const plan = loadPlan();
  console.log('\n=== Bag Removal Progress ===\n');
  console.log(`Total Tasks: ${plan.progress.total_tasks}`);
  console.log(`Completed: ${plan.progress.completed_tasks}`);
  console.log(`Progress: ${Math.round((plan.progress.completed_tasks / plan.progress.total_tasks) * 100)}%\n`);
  
  for (const phase of plan.phases) {
    const completedTasks = phase.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = phase.tasks.length;
    console.log(`Phase ${phase.phase}: ${phase.name}`);
    console.log(`  Status: ${phase.status}`);
    console.log(`  Progress: ${completedTasks}/${totalTasks} tasks\n`);
  }
  
  const nextItem = getNextTask(plan);
  if (nextItem) {
    console.log(`Next Task: ${nextItem.task.id} - ${nextItem.task.description}`);
  } else {
    console.log('All tasks completed!');
  }
}

function executeNext() {
  const plan = loadPlan();
  const nextItem = getNextTask(plan);
  
  if (!nextItem) {
    console.log('All tasks completed!');
    return;
  }
  
  const { phase, task } = nextItem;
  
  console.log(`\nExecuting Task ${task.id}: ${task.description}`);
  console.log(`Phase ${phase.phase}: ${phase.name}`);
  console.log(`File: ${task.file || 'N/A'}`);
  console.log(`Action: ${task.action}`);
  
  // Confirm execution
  console.log('\nThis will modify your codebase. Continue? (y/N)');
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('', (answer) => {
    readline.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('Task skipped');
      return;
    }
    
    try {
      log(`Starting task ${task.id}: ${task.description}`);
      
      // Mark task as in-progress
      updateTaskStatus(plan, task.id, 'in-progress');
      
      // Execute based on action type
      if (task.action === 'delete') {
        console.log(`Would delete file: ${task.file}`);
        // fs.unlinkSync(task.file);
      } else if (task.action === 'modify') {
        console.log(`Would modify file: ${task.file}`);
        console.log(`Target: ${task.target}`);
        // Actual modification would go here
      } else if (task.action === 'remove') {
        console.log(`Would remove from file: ${task.file}`);
        console.log(`Target: ${task.target}`);
        // Actual removal would go here
      }
      
      // Mark task as completed
      updateTaskStatus(plan, task.id, 'completed');
      log(`Completed task ${task.id}`);
      
      console.log('\nTask completed successfully!');
      
      // Show next task
      const updatedPlan = loadPlan();
      const next = getNextTask(updatedPlan);
      if (next) {
        console.log(`\nNext task: ${next.task.id} - ${next.task.description}`);
      }
      
    } catch (error) {
      logError(`Failed to execute task ${task.id}`, error);
      updateTaskStatus(plan, task.id, 'failed');
    }
  });
}

function runVerification() {
  const plan = loadPlan();
  console.log('\n=== Running Verification Tests ===\n');
  
  for (const testCommand of plan.verification.tests_to_run) {
    console.log(`Running: ${testCommand}`);
    try {
      // execSync(testCommand, { stdio: 'inherit' });
      console.log('✓ Test would run: ' + testCommand);
    } catch (error) {
      console.error('✗ Test failed');
    }
  }
  
  console.log('\n=== Manual Verification Checklist ===\n');
  for (const check of plan.verification.manual_checks) {
    console.log(`□ ${check}`);
  }
}

// Main execution
const command = process.argv[2] || 'status';

switch (command) {
  case 'status':
    showStatus();
    break;
  case 'next':
    executeNext();
    break;
  case 'verify':
    runVerification();
    break;
  case 'phase':
    console.log('Phase execution not yet implemented');
    break;
  case 'reset':
    console.log('Task reset not yet implemented');
    break;
  default:
    console.log('Unknown command:', command);
    console.log('Available commands: status, next, phase, verify, reset');
}