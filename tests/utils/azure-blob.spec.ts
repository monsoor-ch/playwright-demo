import { test, expect } from '@playwright/test';
import { AzureBlobClient } from '../../src/utils/azure-blob-client';
import { Logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Azure Blob Storage Tests', () => {
  let blobClient: AzureBlobClient;
  let logger: Logger;
  const testFileName = 'test-file.txt';
  const testFileContent = 'This is a test file for Azure Blob Storage validation.';
  const localTestFile = path.join('./test-results', testFileName);

  test.beforeAll(async () => {
    logger = Logger.getInstance();
    
    // Skip tests if Azure configuration is not available
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      test.skip(true, 'Azure Storage connection string not configured');
    }

    try {
      blobClient = new AzureBlobClient();
      await blobClient.createContainerIfNotExists();
      
      // Create test file
      if (!fs.existsSync('./test-results')) {
        fs.mkdirSync('./test-results', { recursive: true });
      }
      fs.writeFileSync(localTestFile, testFileContent);
      
      logger.info('Azure Blob Storage tests setup completed');
    } catch (error) {
      logger.error('Failed to setup Azure Blob Storage tests', { error });
      test.skip(true, 'Azure Blob Storage setup failed');
    }
  });

  test('should upload file to blob storage', async () => {
    logger.logTestStart('Upload file to blob storage');

    logger.logStep('Uploading test file');
    await blobClient.uploadFile(localTestFile, testFileName, {
      contentType: 'text/plain',
      metadata: { 
        testRun: Date.now().toString(),
        purpose: 'automation-test'
      }
    });

    logger.logStep('Verifying file exists in blob storage');
    const exists = await blobClient.blobExists(testFileName);
    expect(exists).toBe(true);

    logger.logTestEnd('Upload file to blob storage', 'passed');
  });

  test('should upload content directly to blob storage', async () => {
    const contentBlobName = 'content-test.txt';
    logger.logTestStart('Upload content to blob storage');

    logger.logStep('Uploading string content');
    await blobClient.uploadContent(testFileContent, contentBlobName, {
      contentType: 'text/plain'
    });

    logger.logStep('Verifying content exists');
    const exists = await blobClient.blobExists(contentBlobName);
    expect(exists).toBe(true);

    // Cleanup
    await blobClient.deleteBlob(contentBlobName);

    logger.logTestEnd('Upload content to blob storage', 'passed');
  });

  test('should retrieve blob information', async () => {
    logger.logTestStart('Retrieve blob information');

    logger.logStep('Getting blob information');
    const blobInfo = await blobClient.getBlobInfo(testFileName);

    logger.logAssertion('Blob name should match');
    expect(blobInfo.name).toBe(testFileName);

    logger.logAssertion('Blob size should be greater than 0');
    expect(blobInfo.size).toBeGreaterThan(0);

    logger.logAssertion('Blob should have content type');
    expect(blobInfo.contentType).toBeTruthy();

    logger.logTestEnd('Retrieve blob information', 'passed');
  });

  test('should download file from blob storage', async () => {
    const downloadPath = path.join('./test-results', 'downloaded-' + testFileName);
    logger.logTestStart('Download file from blob storage');

    logger.logStep('Downloading file');
    await blobClient.downloadFile(testFileName, downloadPath);

    logger.logStep('Verifying downloaded file exists');
    expect(fs.existsSync(downloadPath)).toBe(true);

    logger.logStep('Verifying file content');
    const downloadedContent = fs.readFileSync(downloadPath, 'utf8');
    expect(downloadedContent).toBe(testFileContent);

    // Cleanup
    fs.unlinkSync(downloadPath);

    logger.logTestEnd('Download file from blob storage', 'passed');
  });

  test('should download content as string', async () => {
    logger.logTestStart('Download content as string');

    logger.logStep('Downloading content');
    const content = await blobClient.downloadContent(testFileName);

    logger.logAssertion('Content should match original');
    expect(content).toBe(testFileContent);

    logger.logTestEnd('Download content as string', 'passed');
  });

  test('should list blobs in container', async () => {
    logger.logTestStart('List blobs in container');

    logger.logStep('Listing all blobs');
    const blobs = await blobClient.listBlobs();

    logger.logAssertion('Should find at least one blob');
    expect(blobs.length).toBeGreaterThan(0);

    logger.logStep('Finding test file in list');
    const testBlob = blobs.find(blob => blob.name === testFileName);
    expect(testBlob).toBeTruthy();

    logger.logTestEnd('List blobs in container', 'passed');
  });

  test('should validate file properties', async () => {
    logger.logTestStart('Validate file properties');

    logger.logStep('Validating file exists and has correct size');
    const isValid = await blobClient.validateFile(
      testFileName,
      testFileContent.length,
      'text/plain'
    );

    logger.logAssertion('File validation should pass');
    expect(isValid).toBe(true);

    logger.logStep('Validating with incorrect size should fail');
    const isInvalid = await blobClient.validateFile(
      testFileName,
      999999,
      'text/plain'
    );

    logger.logAssertion('File validation with wrong size should fail');
    expect(isInvalid).toBe(false);

    logger.logTestEnd('Validate file properties', 'passed');
  });

  test('should handle non-existent blob operations', async () => {
    const nonExistentBlob = 'non-existent-file.txt';
    logger.logTestStart('Handle non-existent blob operations');

    logger.logStep('Checking if non-existent blob exists');
    const exists = await blobClient.blobExists(nonExistentBlob);
    expect(exists).toBe(false);

    logger.logStep('Attempting to get info for non-existent blob');
    await expect(blobClient.getBlobInfo(nonExistentBlob)).rejects.toThrow();

    logger.logStep('Attempting to download non-existent blob');
    await expect(blobClient.downloadContent(nonExistentBlob)).rejects.toThrow();

    logger.logTestEnd('Handle non-existent blob operations', 'passed');
  });

  test.afterAll(async () => {
    if (blobClient) {
      try {
        // Cleanup test files
        logger.info('Cleaning up test files');
        
        if (await blobClient.blobExists(testFileName)) {
          await blobClient.deleteBlob(testFileName);
        }

        if (fs.existsSync(localTestFile)) {
          fs.unlinkSync(localTestFile);
        }

        logger.info('Azure Blob Storage tests cleanup completed');
      } catch (error) {
        logger.warn('Error during cleanup', { error });
      }
    }
  });
});
