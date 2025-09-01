import { test, expect } from '@playwright/test';
import { GoogleHomePage } from '../src/pages/google/GoogleHomePage';
import { GoogleSearchResultsPage } from '../src/pages/google/GoogleSearchResultsPage';
import { Logger } from '../src/utils/logger';

test.describe('Google Search Tests', () => {
  let googleHomePage: GoogleHomePage;
  let googleSearchResultsPage: GoogleSearchResultsPage;
  let logger: Logger;

  test.beforeEach(async ({ page }) => {
    logger = Logger.getInstance();
    googleHomePage = new GoogleHomePage(page);
    googleSearchResultsPage = new GoogleSearchResultsPage(page);
    
    logger.logTestStart('Google Search Test Setup');
    await googleHomePage.navigate();
    //await googleHomePage.verifyPageLoaded();
  });

  test('PROJ-001: should perform basic Google search', async ({ page }) => {
    const searchQuery = 'Playwright automation';
    await test.step('Enter credentials and submit', async () => {
    logger.logTestStart(`Basic Google search for: ${searchQuery}`);

    // Perform search
    logger.logStep('Performing Google search');
    await googleHomePage.search(searchQuery);
  });

    // // Verify search results page
    // logger.logStep('Verifying search results');
    // await googleSearchResultsPage.verifySearchResultsLoaded(searchQuery);

    // // Check that we have results
    // const resultsCount = await googleSearchResultsPage.getResultsCount();
    // logger.logAssertion(`Found ${resultsCount} search results`);
    // expect(resultsCount).toBeGreaterThan(0);

    // // Verify page title contains the search query
    // const pageTitle = await page.title();
    // logger.logAssertion(`Page title contains search query`);
    // expect(pageTitle.toLowerCase()).toContain(searchQuery.toLowerCase());

    logger.logTestEnd('Basic Google search', 'passed');
  });

  // test('PROJ-002: should display search suggestions', async ({ page }) => {
  //   const partialQuery = 'playwright';
  //   logger.logTestStart(`Search suggestions test for: ${partialQuery}`);

  //   logger.logStep('Getting search suggestions');
  //   const suggestions = await googleHomePage.getSearchSuggestions(partialQuery);

  //   logger.logAssertion(`Search suggestions should be displayed`);
  //   expect(suggestions.length).toBeGreaterThan(0);

  //   logger.logAssertion(`Suggestions should contain the search term`);
  //   const relevantSuggestions = suggestions.filter(suggestion => 
  //     suggestion.toLowerCase().includes(partialQuery.toLowerCase())
  //   );
  //   expect(relevantSuggestions.length).toBeGreaterThan(0);

  //   logger.logTestEnd('Search suggestions test', 'passed');
  // });

  // test('PROJ-003: should navigate to first search result', async ({ page }) => {
  //   const searchQuery = 'Playwright documentation';
  //   logger.logTestStart(`Navigate to first result for: ${searchQuery}`);

  //   // Perform search
  //   logger.logStep('Performing Google search');
  //   await googleHomePage.search(searchQuery);
  //   await googleSearchResultsPage.verifySearchResultsLoaded(searchQuery);

  //   // Get first result title
  //   const resultTitles = await googleSearchResultsPage.getResultTitles();
  //   expect(resultTitles.length).toBeGreaterThan(0);

  //   const firstResultTitle = resultTitles[0];
  //   logger.logStep(`Clicking on first result: ${firstResultTitle}`);

  //   // Click on first result
  //   await googleSearchResultsPage.clickSearchResult(0);

  //   // Verify navigation
  //   logger.logStep('Verifying navigation to result page');
  //   await page.waitForLoadState('networkidle');
    
  //   const currentUrl = page.url();
  //   logger.logAssertion(`Should navigate away from Google search results`);
  //   expect(currentUrl).not.toContain('google.com/search');

  //   logger.logTestEnd('Navigate to first result', 'passed');
  // });

  // test('PROJ-004: should perform multiple searches', async ({ page }) => {
  //   const searches = ['TypeScript', 'Playwright testing', 'automation framework'];
  //   logger.logTestStart(`Multiple searches test`);

  //   for (const searchQuery of searches) {
  //     logger.logStep(`Searching for: ${searchQuery}`);
      
  //     if (searches.indexOf(searchQuery) === 0) {
  //       // First search from home page
  //       await googleHomePage.search(searchQuery);
  //     } else {
  //       // Subsequent searches from results page
  //       await googleSearchResultsPage.searchAgain(searchQuery);
  //     }

  //     // Verify results
  //     await googleSearchResultsPage.verifySearchResultsLoaded(searchQuery);
  //     const resultsCount = await googleSearchResultsPage.getResultsCount();
      
  //     logger.logAssertion(`Found ${resultsCount} results for "${searchQuery}"`);
  //     expect(resultsCount).toBeGreaterThan(0);
  //   }

  //   logger.logTestEnd('Multiple searches test', 'passed');
  // });

  // test('PROJ-005: should validate search results contain expected content', async ({ page }) => {
  //   const searchQuery = 'Playwright browser automation';
  //   const expectedTerms = ['playwright', 'automation', 'browser'];
    
  //   logger.logTestStart(`Content validation test for: ${searchQuery}`);

  //   // Perform search
  //   logger.logStep('Performing Google search');
  //   await googleHomePage.search(searchQuery);
  //   await googleSearchResultsPage.verifySearchResultsLoaded(searchQuery);

  //   // Check for expected terms in results
  //   for (const term of expectedTerms) {
  //     logger.logStep(`Checking for term: ${term}`);
  //     const hasResult = await googleSearchResultsPage.hasResultContaining(term);
      
  //     logger.logAssertion(`Results should contain "${term}"`);
  //     expect(hasResult).toBe(true);
  //   }

  //   logger.logTestEnd('Content validation test', 'passed');
  // });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
      logger.logTestEnd(testInfo.title, 'failed');
      
      // Take screenshot on failure
      const screenshotPath = `test-results/failure-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.error(`Test failed. Screenshot saved: ${screenshotPath}`);
    }
  });
});
