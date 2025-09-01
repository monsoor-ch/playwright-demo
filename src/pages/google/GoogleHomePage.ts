import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base/BasePage';

export class GoogleHomePage extends BasePage {
  private readonly searchInput: Locator;
  private readonly searchButton: Locator;
  private readonly feelingLuckyButton: Locator;
  private readonly googleLogo: Locator;

  constructor(page: Page) {
    super(page, 'https://www.google.com');
    
    // Page elements
    this.searchInput = page.locator('#APjFqb');
    this.searchButton = page.locator('input[name="btnK"]').first();
    this.feelingLuckyButton = page.locator('input[name="btnI"]').first();
    this.googleLogo = page.locator('img[alt="Google"]');
  }

  /**
   * Perform a Google search
   */
  async search(query: string): Promise<void> {
    this.logger.info(`Performing Google search for: ${query}`);
    
    await this.waitForPageLoad();
    await this.assertElementVisible(this.searchInput, 'Search input should be visible');
    
    await this.typeText(this.searchInput, query);
    
    // Submit the search by pressing Enter (more reliable than clicking button)
    await this.searchInput.press('Enter');
    
    this.logger.info(`Search completed for: ${query}`);
  }

  /**
   * Click "I'm Feeling Lucky" button
   */
  async clickFeelingLucky(): Promise<void> {
    this.logger.info('Clicking "I\'m Feeling Lucky" button');
    await this.clickElement(this.feelingLuckyButton);
  }

  /**
   * Verify Google home page is loaded
   */
  async verifyPageLoaded(): Promise<void> {
    await this.assertElementVisible(this.googleLogo, 'Google logo should be visible');
    await this.assertElementVisible(this.searchInput, 'Search input should be visible');
    
    const title = await this.getTitle();
    if (!title.toLowerCase().includes('google')) {
      throw new Error(`Expected page title to contain 'Google', but got: ${title}`);
    }
    
    this.logger.info('Google home page verified successfully');
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    await this.typeText(this.searchInput, query);
    await this.wait(1000); // Wait for suggestions to appear
    
    const suggestions = await this.page.locator('li[role="presentation"]').allTextContents();
    this.logger.debug(`Found ${suggestions.length} search suggestions`);
    return suggestions;
  }

  /**
   * Clear search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    this.logger.debug('Search input cleared');
  }
}
