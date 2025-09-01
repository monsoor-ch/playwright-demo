#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Script to manually report test results to Jira Xray
 * Usage: node scripts/report-to-xray.js [options]
 * 
 * Options:
 *   --test-plan-key <key>    Jira Test Plan Key
 *   --environment <env>       Test Environment (default: CI/CD)
 *   --version <version>       Test Version (default: 1.0.0)
 *   --test-execution-key <key> Existing Test Execution Key
 */

const args = process.argv.slice(2);
let testPlanKey = '';
let environment = 'CI/CD';
let version = '1.0.0';
let testExecutionKey = '';

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--test-plan-key':
      testPlanKey = args[++i];
      break;
    case '--environment':
      environment = args[++i];
      break;
    case '--version':
      version = args[++i];
      break;
    case '--test-execution-key':
      testExecutionKey = args[++i];
      break;
    case '--help':
    case '-h':
      console.log(`
Usage: node scripts/report-to-xray.js [options]

Options:
  --test-plan-key <key>    Jira Test Plan Key
  --environment <env>       Test Environment (default: CI/CD)
  --version <version>       Test Version (default: 1.0.0)
  --test-execution-key <key> Existing Test Execution Key
  --help, -h               Show this help message

Examples:
  node scripts/report-to-xray.js --test-plan-key PROJ-100
  node scripts/report-to-xray.js --environment "Staging" --version "2.1.0"
  node scripts/report-to-xray.js --test-execution-key PROJ-200
      `);
      process.exit(0);
  }
}

// Validate environment variables
const requiredEnvVars = ['JIRA_BASE_URL', 'JIRA_USERNAME', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set these variables in your .env file or environment.');
  process.exit(1);
}

console.log('🚀 Starting Xray reporting process...');
console.log(`📋 Environment: ${environment}`);
console.log(`📦 Version: ${version}`);
if (testPlanKey) console.log(`📋 Test Plan: ${testPlanKey}`);
if (testExecutionKey) console.log(`📋 Test Execution: ${testExecutionKey}`);

try {
  // Set environment variables for the reporter
  process.env.JIRA_ENVIRONMENT = environment;
  process.env.JIRA_VERSION = version;
  if (testPlanKey) process.env.JIRA_TEST_PLAN_KEY = testPlanKey;
  if (testExecutionKey) process.env.JIRA_TEST_EXECUTION_KEY = testExecutionKey;

  // Run tests with Xray reporter
  console.log('\n🧪 Running tests with Xray reporter...');
  
  const command = testExecutionKey 
    ? `npx playwright test --reporter=src/utils/xray-reporter --output-dir=test-results`
    : `npx playwright test --reporter=src/utils/xray-reporter --output-dir=test-results`;

  execSync(command, { 
    stdio: 'inherit',
    env: { ...process.env }
  });

  // Check if Xray execution key was generated
  const xrayKeyFile = path.join('test-results', 'xray-execution-key.txt');
  if (fs.existsSync(xrayKeyFile)) {
    const executionKey = fs.readFileSync(xrayKeyFile, 'utf8').trim();
    console.log(`\n✅ Successfully reported to Jira Xray!`);
    console.log(`🔗 Test Execution: ${executionKey}`);
    console.log(`🌐 View in Jira: ${process.env.JIRA_BASE_URL}/browse/${executionKey}`);
  } else {
    console.log('\n⚠️  Xray execution key not found. Check logs for errors.');
  }

} catch (error) {
  console.error('\n❌ Failed to report to Xray:', error.message);
  process.exit(1);
}

