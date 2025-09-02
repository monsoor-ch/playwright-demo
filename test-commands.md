# Test Commands Reference

## Basic Test Commands

### Run all tests
```bash
npx playwright test
```

### Run specific test files
```bash
# Framework setup tests (works without browser dependencies)
npx playwright test tests/config/framework-setup.spec.ts

# Google search tests (requires browser installation)
npx playwright test tests/google-search.spec.ts

# External service tests (require credentials)
npx playwright test tests/utils/azure-blob.spec.ts
npx playwright test tests/utils/email-validator.spec.ts
npx playwright test tests/utils/sftp-client.spec.ts
```

### Run tests with different options
```bash
# Run with visible browser
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# Run with specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run with better reporting
npx playwright test --reporter=list
npx playwright test --reporter=html
```

### View test reports
```bash
npx playwright show-report
```

## Quick Start

1. **Test the framework setup** (no browser needed):
   ```bash
   npx playwright test tests/config/framework-setup.spec.ts --reporter=list
   ```

2. **Install browsers** (if you want to run full browser tests):
   ```bash
   npx playwright install
   ```

3. **Run all tests** (after browser installation):
   ```bash
   npx playwright test --reporter=list
   ```

## Current Status

✅ Framework tests: Working (28/28 passing)
⚠️ Browser tests: Need browser installation
⚠️ External services: Need credentials in .env file