import { FullConfig } from '@playwright/test';
import { Logger } from '../utils/logger';

async function globalTeardown(config: FullConfig) {
  const logger = Logger.getInstance();
  
  logger.info('Global teardown completed');
  logger.info('Test execution finished');
}

export default globalTeardown;
