import { test, expect } from '@playwright/test';
import { TestConfig } from '../../src/config/test-config';
import { Environment } from '../../src/config/environment';
import { Logger } from '../../src/utils/logger';

test.describe('Framework Setup Tests', () => {
  test('should initialize configuration correctly', async () => {
    const config = TestConfig.getInstance();
    
    expect(config.baseUrl).toBeTruthy();
    expect(config.environment).toBe('local');
    expect(config.headless).toBe(true);
    expect(config.timeout).toBeGreaterThan(0);
  });

  test('should initialize logger correctly', async () => {
    const logger = Logger.getInstance();
    
    // Test basic logging functionality
    logger.info('Test log message');
    logger.debug('Debug message');
    logger.warn('Warning message');
    
    // Logger should not throw errors
    expect(logger).toBeTruthy();
  });

  test('should load environment configuration', async () => {
    const env = Environment.getInstance();
    const config = env.getConfig();
    
    expect(config.environment).toBe('local');
    expect(config.baseUrl).toBe('https://www.google.com');
    expect(config.logging.level).toBe('info');
    expect(config.logging.toFile).toBe(true);
  });

  test('should validate framework structure', async () => {
    // Verify all core components can be instantiated
    const config = TestConfig.getInstance();
    const logger = Logger.getInstance();
    
    expect(config).toBeInstanceOf(TestConfig);
    expect(logger).toBeInstanceOf(Logger);
    
    // Verify singleton pattern
    const config2 = TestConfig.getInstance();
    const logger2 = Logger.getInstance();
    
    expect(config).toBe(config2);
    expect(logger).toBe(logger2);
  });
});