import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base/BasePage';

export class GoogleSearchResultsPage extends BasePage {
  private readonly searchInput: Locator;
  private readonly searchResults: Locator;
  private readonly resultLinks: Locator;
  private readonly resultsStats: Locator;
  private readonly nextPageButton: Locator;
  private readonly previousPageButton: Locator;

  constructor(page: Page) {
    super(page);
    
    // Page elements
    this.searchInput = page.locator('input[name="q"]');
    this.searchResults = page.locator('#search');
    this.resultLinks = page.locator('h3').locator('..'); // Parent of h3 elements (result links)
    this.resultsStats = page.locator('#result-stats');
    this.nextPageButton = page.locator('a[aria-label="Next page"]');
    this.previousPageButton = page.locator('a[aria-label="Previous page"]');
  }

  /**
   * Verify search results page is loaded
   */
  async verifySearchResultsLoaded(expectedQuery: string): Promise<void> {
    await this.assertElementVisible(this.searchResults, 'Search results should be visible');
    
    const searchInputValue = await this.searchInput.inputValue();
    if (searchInputValue.toLowerCase() !== expectedQuery.toLowerCase()) {
      throw new Error(`Expected search query '${expectedQuery}', but found '${searchInputValue}'`);
    }
    
    this.logger.info(`Search results page verified for query: ${expectedQuery}`);
  }

  /**
   * Get number of search results
   */
  async getResultsCount(): Promise<number> {
    await this.waitForElement(this.resultLinks);
    const count = await this.resultLinks.count();
    this.logger.debug(`Found ${count} search results`);
    return count;
  }

  /**
   * Get search result titles
   */
  async getResultTitles(): Promise<string[]> {
    await this.waitForElement(this.resultLinks);
    const titles = await this.resultLinks.locator('h3').allTextContents();
    this.logger.debug(`Retrieved ${titles.length} result titles`);
    return titles;
  }

  /**
   * Click on a specific search result by index
   */
  async clickSearchResult(index: number): Promise<void> {
    const resultLinks = this.resultLinks;
    const count = await resultLinks.count();
    
    if (index >= count || index < 0) {
      throw new Error(`Invalid result index: ${index}. Available results: 0-${count - 1}`);
    }
    
    const resultLink = resultLinks.nth(index);
    const title = await resultLink.locator('h3').textContent();
    
    this.logger.info(`Clicking on search result ${index + 1}: ${title}`);
    await this.clickElement(resultLink);
  }

  /**
   * Search for a specific result by title text
   */
  async clickSearchResultByTitle(titleText: string): Promise<void> {
    const resultLink = this.resultLinks.filter({ hasText: titleText }).first();
    
    if (!(await this.isElementVisible(resultLink))) {
      throw new Error(`No search result found with title containing: ${titleText}`);
    }
    
    this.logger.info(`Clicking on search result with title: ${titleText}`);
    await this.clickElement(resultLink);
  }

  /**
   * Get results statistics
   */
  async getResultsStats(): Promise<string> {
    if (await this.isElementVisible(this.resultsStats)) {
      const stats = await this.getElementText(this.resultsStats);
      this.logger.debug(`Results stats: ${stats}`);
      return stats;
    }
    return '';
  }

  /**
   * Navigate to next page of results
   */
  async goToNextPage(): Promise<void> {
    if (await this.isElementVisible(this.nextPageButton)) {
      this.logger.info('Navigating to next page of results');
      await this.clickElement(this.nextPageButton);
      await this.waitForPageLoad();
    } else {
      throw new Error('Next page button is not available');
    }
  }

  /**
   * Navigate to previous page of results
   */
  async goToPreviousPage(): Promise<void> {
    if (await this.isElementVisible(this.previousPageButton)) {
      this.logger.info('Navigating to previous page of results');
      await this.clickElement(this.previousPageButton);
      await this.waitForPageLoad();
    } else {
      throw new Error('Previous page button is not available');
    }
  }

  /**
   * Perform a new search from results page
   */
  async searchAgain(newQuery: string): Promise<void> {
    this.logger.info(`Performing new search for: ${newQuery}`);
    await this.typeText(this.searchInput, newQuery);
    await this.searchInput.press('Enter');
    await this.waitForPageLoad();
  }

  /**
   * Check if specific text exists in search results
   */
  async hasResultContaining(text: string): Promise<boolean> {
    const results = await this.getResultTitles();
    const found = results.some(title => title.toLowerCase().includes(text.toLowerCase()));
    this.logger.debug(`Search for '${text}' in results: ${found ? 'found' : 'not found'}`);
    return found;
  }
}
