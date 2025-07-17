import { FullConfig } from '@playwright/test';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  const logger = Logger.getInstance();
  
  // Create necessary directories
  const directories = ['./logs', './test-results', './downloads'];
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  logger.info('Global setup completed');
  logger.info(`Running tests in ${process.env.CI ? 'CI' : 'local'} environment`);
  logger.info(`Base URL: ${config.use?.baseURL}`);
}

export default globalSetup;
