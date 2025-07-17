# Playwright Automation Framework

## Overview

This is a comprehensive TypeScript-based Playwright automation framework that follows the Page Object Model (POM) architecture. The framework is designed for end-to-end testing with integrated utilities for external service validation including Azure Blob Storage, email operations, and SFTP file transfers.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 17, 2025 - Initial Framework Implementation
✓ Created comprehensive TypeScript Playwright automation framework
✓ Implemented Page Object Model architecture with BasePage pattern
✓ Added Azure Blob Storage, Email, and SFTP utility integrations
✓ Set up GitHub Actions CI/CD workflows for automated and manual testing
✓ Configured environment-based configuration management
✓ Implemented Winston-based structured logging system
✓ Created example Google search tests demonstrating POM implementation
✓ Added comprehensive documentation and setup instructions

### Framework Status
- Core framework structure: Complete and tested
- Configuration system: Working (environment variables, singleton pattern)
- Page Object Model: Implemented with BasePage and Google examples
- External service utilities: Complete (Azure Blob, Email, SFTP)
- CI/CD workflows: Configured with parameterization
- Testing: Framework setup tests passing successfully
- Documentation: Comprehensive README with examples and best practices

## System Architecture

### Frontend Testing Architecture
- **Page Object Model (POM)**: Clean separation of page logic and test logic
- **Base Page Pattern**: Common functionality abstracted into a BasePage class
- **Locator Strategy**: Type-safe element identification using Playwright's modern locator API
- **Cross-browser Support**: Tests run on Chromium, Firefox, and WebKit

### Backend/External Service Integration
- **Azure Blob Storage**: File upload/download validation and storage operations
- **Email Services**: IMAP/SMTP integration for email validation and sending
- **SFTP Operations**: Secure file transfer validation and testing
- **Configuration Management**: Environment-based configuration with singleton pattern

### Test Execution Framework
- **TypeScript**: Full type safety and modern async/await patterns
- **Parallel Execution**: Tests run in parallel for faster execution
- **Multi-environment Support**: Local and CI execution with different configurations
- **Comprehensive Reporting**: HTML, JSON, and JUnit reports with visual artifacts

## Key Components

### Core Framework Components
1. **BasePage Class** (`src/pages/base/BasePage.ts`)
   - Abstract base class for all page objects
   - Common navigation, waiting, and assertion methods
   - Standardized logging and error handling

2. **Configuration System** (`src/config/`)
   - Environment-specific configurations
   - Singleton pattern for global access
   - Support for local development and CI environments

3. **Logging System** (`src/utils/logger.ts`)
   - Winston-based structured logging
   - Console and file output options
   - Test execution tracking and debugging

### Page Objects
1. **Google Pages** (`src/pages/google/`)
   - GoogleHomePage: Search functionality
   - GoogleSearchResultsPage: Results validation
   - Demonstrates POM implementation patterns

### External Service Utilities
1. **Azure Blob Client** (`src/utils/azure-blob-client.ts`)
   - File upload/download operations
   - Blob metadata management
   - Container creation and management

2. **Email Validator** (`src/utils/email-validator.ts`)
   - SMTP email sending capabilities
   - IMAP email retrieval and validation
   - Search functionality for email verification

3. **SFTP Client** (`src/utils/sftp-client.ts`)
   - Secure file transfer operations
   - Directory listing and file management
   - Connection management with authentication

## Data Flow

### Test Execution Flow
1. **Global Setup**: Directory creation, logging initialization
2. **Test Initialization**: Page object instantiation, configuration loading
3. **Test Execution**: Page interactions, external service validations
4. **Assertions**: Result verification and logging
5. **Cleanup**: Resource disposal, artifact collection

### External Service Integration Flow
1. **Configuration Loading**: Environment-specific credentials and endpoints
2. **Service Connection**: Authenticated connections to external services
3. **Operation Execution**: File transfers, email operations, storage actions
4. **Validation**: Result verification and error handling
5. **Resource Cleanup**: Connection closure and temporary file cleanup

## External Dependencies

### Core Testing Dependencies
- **@playwright/test**: Web automation and testing framework
- **typescript**: Type safety and modern JavaScript features
- **@types/node**: Node.js type definitions

### External Service Dependencies
- **@azure/storage-blob**: Azure Blob Storage operations
- **nodemailer**: SMTP email sending
- **imap-simple**: IMAP email retrieval
- **ssh2-sftp-client**: SFTP file transfer operations

### Utility Dependencies
- **winston**: Structured logging
- **dotenv**: Environment variable management

## Deployment Strategy

### Local Development
- Environment variables loaded from .env files
- Full browser UI for debugging
- Detailed console logging
- Immediate test feedback

### CI/CD Integration
- Headless browser execution for performance
- GitHub Actions workflow support
- Artifact collection (screenshots, videos, reports)
- Parallel test execution with retry logic

### Configuration Management
- Environment-specific settings via environment variables
- Secure credential management for external services
- Flexible timeout and retry configurations
- Multi-browser and device testing capabilities

### Reporting and Artifacts
- HTML reports with interactive test results
- JSON and JUnit formats for CI integration
- Screenshot capture on failures
- Video recording for failed test scenarios
- Structured logging for debugging and audit trails