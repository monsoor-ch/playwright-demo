# Playwright Automation Framework

A comprehensive TypeScript-based Playwright automation framework following Page Object Model (POM) architecture with integrated utilities for Azure Blob Storage, email validation, and SFTP operations.

## 🚀 Features

- **TypeScript & Playwright**: Type-safe automation with modern async/await patterns
- **Page Object Model**: Clean, maintainable test architecture
- **Cross-Environment Support**: Local and CI execution with environment-specific configurations
- **External Service Integrations**:
  - Azure Blob Storage for file validation and operations
  - Email/mailbox validation utilities
  - SFTP client for file transfer validation
- **CI/CD Integration**: GitHub Actions workflows with parameterized execution
- **Comprehensive Logging**: Winston-based logging with configurable levels
- **Multi-Browser Support**: Chromium, Firefox, WebKit, and mobile viewports
- **Rich Reporting**: HTML, JSON, and JUnit reports with screenshots and videos

## 📁 Project Structure

```
├── .github/workflows/          # CI/CD GitHub Actions workflows
│   ├── playwright-tests.yml    # Automated test execution
│   └── manual-test-run.yml     # Manual test execution with parameters
├── src/
│   ├── config/                 # Configuration management
│   │   ├── environment.ts      # Environment configuration with singleton pattern
│   │   ├── test-config.ts      # Test configuration wrapper
│   │   ├── global-setup.ts     # Global test setup
│   │   └── global-teardown.ts  # Global test cleanup
│   ├── pages/                  # Page Object Model implementation
│   │   ├── base/
│   │   │   └── BasePage.ts     # Abstract base page with common functionality
│   │   └── google/
│   │       ├── GoogleHomePage.ts        # Google home page implementation
│   │       └── GoogleSearchResultsPage.ts # Google search results page
│   └── utils/                  # Utility classes for external services
│       ├── azure-blob-client.ts    # Azure Blob Storage operations
│       ├── email-validator.ts      # Email validation and IMAP/SMTP operations
│       ├── sftp-client.ts         # SFTP file transfer operations
│       └── logger.ts              # Winston-based structured logging
├── tests/
│   ├── config/
│   │   └── framework-setup.spec.ts    # Framework configuration tests
│   ├── utils/                          # Utility tests
│   │   ├── azure-blob.spec.ts         # Azure Blob Storage tests
│   │   ├── email-validator.spec.ts    # Email validation tests
│   │   └── sftp-client.spec.ts        # SFTP client tests
│   └── google-search.spec.ts          # Google search functionality tests
├── playwright.config.ts               # Playwright configuration
├── tsconfig.json                      # TypeScript configuration
├── .env.example                       # Environment variables template
└── README.md                          # Project documentation
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation Steps

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration values
   ```

### Environment Configuration

Create a `.env` file based on `.env.example`:

```env
# Basic Configuration
ENVIRONMENT=local
BASE_URL=https://www.google.com
HEADLESS=true
LOG_LEVEL=info

# Azure Blob Storage (optional)
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_CONTAINER_NAME=test-container

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_password

# SFTP Configuration (optional)
SFTP_HOST=your_sftp_host
SFTP_USERNAME=your_username
SFTP_PASSWORD=your_password
```

## 🚀 Running Tests

### Basic Test Execution

```bash
# Run all tests
npx playwright test

# Run specific test suites
npx playwright test tests/google-search.spec.ts
npx playwright test tests/config/framework-setup.spec.ts

# Run with specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Advanced Test Options

```bash
# Run in headed mode (visible browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# Run with UI mode
npx playwright test --ui

# Generate and view reports
npx playwright test
npx playwright show-report
```

### External Service Tests

```bash
# Azure Blob Storage tests (requires Azure credentials)
npx playwright test tests/utils/azure-blob.spec.ts

# Email validation tests (requires email credentials)
npx playwright test tests/utils/email-validator.spec.ts

# SFTP tests (requires SFTP credentials)
npx playwright test tests/utils/sftp-client.spec.ts
```

## 🏗️ Architecture Overview

### Page Object Model Implementation

The framework follows the Page Object Model (POM) pattern:

- **BasePage**: Abstract base class providing common functionality
- **Specific Pages**: Extend BasePage for specific page implementations
- **Type Safety**: Full TypeScript support with modern async/await patterns

### Configuration Management

- **Singleton Pattern**: Centralized configuration access
- **Environment-Specific**: Support for local, staging, and production environments
- **Validation**: Built-in configuration validation with helpful error messages

### External Service Integration

#### Azure Blob Storage
- File upload/download operations
- Blob metadata management
- Container creation and management
- File validation utilities

#### Email Validation
- SMTP email sending capabilities
- IMAP email retrieval and validation
- Search functionality for email verification
- Content validation utilities

#### SFTP Operations
- Secure file transfer operations
- Directory listing and file management
- Connection management with authentication
- File monitoring and validation

### Logging System

- **Winston-based**: Structured logging with multiple transports
- **Configurable Levels**: Debug, info, warn, error levels
- **Test Integration**: Specialized logging methods for test execution
- **File Output**: Optional file logging for CI environments

## 🔧 CI/CD Integration

### GitHub Actions Workflows

#### Automated Testing (`playwright-tests.yml`)
- Triggers on push/PR to main branches
- Matrix strategy for multiple browsers and Node.js versions
- Automatic artifact collection (reports, screenshots, logs)
- Daily scheduled runs

#### Manual Testing (`manual-test-run.yml`)
- Manual workflow dispatch with parameters:
  - Test environment selection
  - Browser selection
  - Test suite selection
  - Headed/headless mode
  - Debug logging options

### Environment Variables for CI

Configure these secrets in your GitHub repository:

```
AZURE_STORAGE_CONNECTION_STRING
AZURE_STORAGE_CONTAINER_NAME
EMAIL_HOST
EMAIL_PORT
EMAIL_USER
EMAIL_PASSWORD
EMAIL_SECURE
SFTP_HOST
SFTP_PORT
SFTP_USERNAME
SFTP_PASSWORD
```

## 📊 Reporting

The framework generates comprehensive test reports:

- **HTML Reports**: Interactive test results with screenshots
- **JSON Reports**: Machine-readable test results
- **JUnit Reports**: CI integration compatible format
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed test scenarios
- **Logs**: Detailed execution logs for debugging

## 🔍 Example Usage

### Google Search Test Example

```typescript
import { test, expect } from '@playwright/test';
import { GoogleHomePage } from '../src/pages/google/GoogleHomePage';
import { GoogleSearchResultsPage } from '../src/pages/google/GoogleSearchResultsPage';

test('should perform Google search', async ({ page }) => {
  const homePage = new GoogleHomePage(page);
  const resultsPage = new GoogleSearchResultsPage(page);
  
  await homePage.navigate();
  await homePage.verifyPageLoaded();
  await homePage.search('Playwright automation');
  
  await resultsPage.verifySearchResultsLoaded('Playwright automation');
  const resultsCount = await resultsPage.getResultsCount();
  expect(resultsCount).toBeGreaterThan(0);
});
```

### Azure Blob Storage Test Example

```typescript
import { test, expect } from '@playwright/test';
import { AzureBlobClient } from '../src/utils/azure-blob-client';

test('should upload and validate file', async () => {
  const blobClient = new AzureBlobClient();
  
  await blobClient.uploadContent('test content', 'test-file.txt');
  const exists = await blobClient.blobExists('test-file.txt');
  expect(exists).toBe(true);
  
  const isValid = await blobClient.validateFile('test-file.txt', 12, 'text/plain');
  expect(isValid).toBe(true);
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add some feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a pull request

## 📝 Best Practices

### Test Organization
- Use descriptive test names and descriptions
- Group related tests in describe blocks
- Use proper beforeEach/afterEach for setup/cleanup

### Page Objects
- Keep page objects focused on a single page/component
- Use meaningful method names that describe user actions
- Implement proper waiting strategies

### Configuration
- Use environment variables for configuration
- Validate required configuration at startup
- Provide helpful error messages for missing configuration

### External Services
- Handle service unavailability gracefully
- Implement proper retry mechanisms
- Use timeouts appropriate for the service

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation and examples
- Review the test logs and reports for debugging information

# Playwright Xray Integration - Tue Sep  2 03:54:11 IST 2025
