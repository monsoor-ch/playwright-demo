# Jira Xray Integration with Playwright

This document explains how to integrate your Playwright test automation with Jira Xray to track test execution and results.

## Overview

The integration allows you to:
- Map Playwright tests to Jira test cases
- Automatically report test results to Xray
- Create test executions in Jira
- Track test status and evidence
- Integrate with GitHub Actions for CI/CD

## Prerequisites

1. **Jira Instance with Xray Plugin**: Ensure your Jira instance has the Xray plugin installed and configured
2. **API Access**: You need API access to your Jira instance
3. **Project Setup**: Your Jira project should have test cases created with proper keys (e.g., PROJ-001, PROJ-002)

## Configuration

### 1. Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# Jira Xray Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USERNAME=your-email@domain.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=PROJ

# Optional Xray Configuration
JIRA_TEST_EXECUTION_KEY=
JIRA_TEST_PLAN_KEY=
JIRA_ENVIRONMENT=CI/CD
JIRA_VERSION=1.0.0
JIRA_REPORTER=Playwright Automation
```

### 2. GitHub Secrets

For GitHub Actions integration, add these secrets to your repository:

- `JIRA_BASE_URL`: Your Jira instance URL
- `JIRA_USERNAME`: Your Jira username/email
- `JIRA_API_TOKEN`: Your Jira API token
- `JIRA_PROJECT_KEY`: Your Jira project key

## Test Case Mapping

### Method 1: Test Title Prefix (Recommended)

Prefix your test titles with the Jira test case key:

```typescript
test('PROJ-001: should perform basic Google search', async ({ page }) => {
  // Test implementation
});

test('PROJ-002: should display search suggestions', async ({ page }) => {
  // Test implementation
});
```

### Method 2: Test Annotations

Use Playwright test annotations:

```typescript
test('should perform basic Google search', async ({ page }) => {
  // Test implementation
}, { annotations: [{ type: 'xray', description: 'PROJ-001' }] });
```

### Method 3: File Naming Convention

Name your test files with the test case key:

```
tests/PROJ-001-google-search.spec.ts
tests/PROJ-002-search-suggestions.spec.ts
```

## Usage

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests with Xray reporter**:
   ```bash
   npm run test:xray
   ```

3. **Manual Xray reporting**:
   ```bash
   node scripts/report-to-xray.js --test-plan-key PROJ-100
   ```

### GitHub Actions

The integration automatically runs on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

You can also trigger with specific parameters:
- Test Plan Key
- Environment
- Version

## Test Execution Flow

1. **Test Execution Creation**: A new test execution is created in Jira Xray
2. **Test Results Collection**: Test results are collected during execution
3. **Evidence Collection**: Screenshots, videos, and logs are attached as evidence
4. **Status Update**: Final execution status is updated in Jira
5. **PR Comment**: Results are commented on pull requests with links to Jira

## Output Files

- `test-results/xray-execution-key.txt`: Contains the generated test execution key
- `test-results.xml`: JUnit XML report for Xray import
- `playwright-report/`: HTML test report
- `test-results.json`: JSON test results

## Customization

### Custom Reporter Options

```typescript
// In playwright.config.ts
reporter: [
  ['src/utils/xray-reporter', { 
    outputDir: 'custom-output',
    environment: 'Staging',
    version: '2.1.0',
    testPlanKey: 'PROJ-100'
  }]
]
```

### Custom Test Evidence

```typescript
test('PROJ-001: custom evidence test', async ({ page }) => {
  // Your test logic
  
  // Add custom evidence
  await test.step('Add custom evidence', async () => {
    const customData = { timestamp: Date.now(), user: 'test-user' };
    // This will be included in the Xray report
  });
});
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**:
   - Verify your Jira API token is correct
   - Ensure your username is correct
   - Check if your Jira instance requires different authentication

2. **Test Case Not Found**:
   - Verify the test case key exists in Jira
   - Check if the test case is in the correct project
   - Ensure you have access to the test case

3. **Permission Denied**:
   - Check your Jira user permissions
   - Verify you can create test executions
   - Ensure you can access the project

### Debug Mode

Enable debug logging by setting the log level:

```typescript
// In your test setup
process.env.DEBUG = 'playwright:xray';
```

### Manual Verification

1. Check the generated `xray-execution-key.txt` file
2. Verify the test execution exists in Jira
3. Check test results are properly mapped
4. Review evidence attachments

## Best Practices

1. **Test Case Naming**: Use consistent naming conventions for test cases
2. **Environment Management**: Use different environments for different stages
3. **Version Tracking**: Include version information for better traceability
4. **Evidence Management**: Keep evidence files organized and meaningful
5. **Error Handling**: Implement proper error handling in your tests

## API Reference

### XrayClient Methods

- `createTestExecution()`: Create a new test execution
- `addTestsToExecution()`: Add test results to an execution
- `updateTestExecutionStatus()`: Update execution status
- `getTestExecution()`: Get execution details
- `searchTestCases()`: Search for test cases

### XrayReporter Options

- `testExecutionKey`: Use existing test execution
- `testPlanKey`: Associate with test plan
- `environment`: Set test environment
- `version`: Set test version
- `outputDir`: Set output directory

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the logs for error details
3. Verify your Jira Xray configuration
4. Check the generated test results files

## Examples

See the `tests/` directory for complete examples of test case mapping and the `scripts/` directory for utility scripts.
