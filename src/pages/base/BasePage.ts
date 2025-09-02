import { Page, Locator, expect } from '@playwright/test';
import { Logger } from '../../utils/logger';

export abstract class BasePage {
  protected page: Page;
  protected logger: Logger;
  protected url: string;

  constructor(page: Page, url: string = '') {
    this.page = page;
    this.url = url;
    this.logger = Logger.getInstance();
  }

  /**
   * Navigate to the page
   */
  async navigate(): Promise<void> {
    if (!this.url) {
      throw new Error('URL is not defined for this page');
    }
    
    this.logger.info(`Navigating to: ${this.url}`);
    await this.page.goto(this.url);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to load completely
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    this.logger.debug('Page loaded successfully');
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    const title = await this.page.title();
    this.logger.debug(`Page title: ${title}`);
    return title;
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    const url = this.page.url();
    this.logger.debug(`Current URL: ${url}`);
    return url;
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(locator: Locator, timeout: number = 30000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Click element with retry logic
   */
  async clickElement(locator: Locator, timeout: number = 30000): Promise<void> {
    await this.waitForElement(locator, timeout);
    await locator.click();
    this.logger.debug('Element clicked successfully');
  }

  /**
   * Type text into input field
   */
  async typeText(locator: Locator, text: string, timeout: number = 30000): Promise<void> {
    await this.waitForElement(locator, timeout);
    await locator.clear();
    await locator.fill(text);
    this.logger.debug(`Text typed: ${text}`);
  }

  /**
   * Get text content of element
   */
  async getElementText(locator: Locator, timeout: number = 30000): Promise<string> {
    await this.waitForElement(locator, timeout);
    const text = await locator.textContent() || '';
    this.logger.debug(`Element text: ${text}`);
    return text;
  }

  /**
   * Check if element is visible
   */
  async isElementVisible(locator: Locator): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(name: string): Promise<void> {
    const screenshotPath = `./test-results/${name}-${Date.now()}.png`;
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    this.logger.info(`Screenshot saved: ${screenshotPath}`);
  }

  /**
   * Scroll to element
   */
  async scrollToElement(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    this.logger.debug('Scrolled to element');
  }

  /**
   * Wait for specific timeout
   */
  async wait(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  /**
   * Assert element is visible
   */
  async assertElementVisible(locator: Locator, message?: string): Promise<void> {
    await expect(locator).toBeVisible({ timeout: 30000 });
    this.logger.debug(message || 'Element visibility assertion passed');
  }

  /**
   * Assert element has text
   */
  async assertElementHasText(locator: Locator, expectedText: string, message?: string): Promise<void> {
    await expect(locator).toContainText(expectedText, { timeout: 30000 });
    this.logger.debug(message || `Element text assertion passed: ${expectedText}`);
  }

  /**
   * Handle alerts/dialogs
   */
  async handleDialog(accept: boolean = true): Promise<void> {
    this.page.on('dialog', async dialog => {
      this.logger.info(`Dialog appeared: ${dialog.message()}`);
      if (accept) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }
}
