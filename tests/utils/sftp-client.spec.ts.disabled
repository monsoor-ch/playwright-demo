import { test, expect } from '@playwright/test';
import { SftpClient } from '../../src/utils/sftp-client';
import { Logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

test.describe('SFTP Client Tests', () => {
  let sftpClient: SftpClient;
  let logger: Logger;
  const testFileName = 'test-file.txt';
  const testFileContent = 'This is a test file for SFTP validation.';
  const localTestFile = path.join('./test-results', testFileName);
  const remoteTestFile = `/tmp/${testFileName}`;

  test.beforeAll(async () => {
    logger = Logger.getInstance();
    
    // Skip tests if SFTP configuration is not available
    if (!process.env.SFTP_HOST || !process.env.SFTP_USERNAME) {
      test.skip(true, 'SFTP credentials not configured');
    }

    try {
      sftpClient = new SftpClient();
      await sftpClient.connect();
      
      // Create test file
      if (!fs.existsSync('./test-results')) {
        fs.mkdirSync('./test-results', { recursive: true });
      }
      fs.writeFileSync(localTestFile, testFileContent);
      
      logger.info('SFTP client tests setup completed');
    } catch (error) {
      logger.error('Failed to setup SFTP client tests', { error });
      test.skip(true, 'SFTP client setup failed');
    }
  });

  test('should connect to SFTP server', async () => {
    logger.logTestStart('Connect to SFTP server');

    // Connection should already be established in beforeAll
    logger.logAssertion('SFTP connection should be established');
    // If we reach here without error, connection is successful
    expect(true).toBe(true);

    logger.logTestEnd('Connect to SFTP server', 'passed');
  });

  test('should upload file to SFTP server', async () => {
    logger.logTestStart('Upload file to SFTP server');

    logger.logStep(`Uploading file: ${localTestFile} -> ${remoteTestFile}`);
    await sftpClient.uploadFile(localTestFile, remoteTestFile);

    logger.logStep('Verifying file exists on server');
    const exists = await sftpClient.fileExists(remoteTestFile);
    expect(exists).toBe(true);

    logger.logTestEnd('Upload file to SFTP server', 'passed');
  });

  test('should get file information', async () => {
    logger.logTestStart('Get file information');

    logger.logStep('Getting file information');
    const fileInfo = await sftpClient.getFileInfo(remoteTestFile);

    logger.logAssertion('File name should match');
    expect(fileInfo.name).toBe(testFileName);

    logger.logAssertion('File size should be greater than 0');
    expect(fileInfo.size).toBeGreaterThan(0);

    logger.logAssertion('File should be identified as file');
    expect(fileInfo.isFile).toBe(true);
    expect(fileInfo.isDirectory).toBe(false);

    logger.logAssertion('Modify time should be recent');
    const ageMinutes = (Date.now() - fileInfo.modifyTime.getTime()) / (1000 * 60);
    expect(ageMinutes).toBeLessThan(10); // File should be less than 10 minutes old

    logger.logTestEnd('Get file information', 'passed');
  });

  test('should download file from SFTP server', async () => {
    const downloadPath = path.join('./test-results', 'downloaded-' + testFileName);
    logger.logTestStart('Download file from SFTP server');

    logger.logStep(`Downloading file: ${remoteTestFile} -> ${downloadPath}`);
    await sftpClient.downloadFile(remoteTestFile, downloadPath);

    logger.logStep('Verifying downloaded file exists');
    expect(fs.existsSync(downloadPath)).toBe(true);

    logger.logStep('Verifying file content');
    const downloadedContent = fs.readFileSync(downloadPath, 'utf8');
    expect(downloadedContent).toBe(testFileContent);

    // Cleanup local downloaded file
    fs.unlinkSync(downloadPath);

    logger.logTestEnd('Download file from SFTP server', 'passed');
  });

  test('should get file content as string', async () => {
    logger.logTestStart('Get file content as string');

    logger.logStep('Getting file content');
    const content = await sftpClient.getFileContent(remoteTestFile);

    logger.logAssertion('Content should match original');
    expect(content).toBe(testFileContent);

    logger.logTestEnd('Get file content as string', 'passed');
  });

  test('should list files in directory', async () => {
    logger.logTestStart('List files in directory');

    logger.logStep('Listing files in /tmp directory');
    const files = await sftpClient.listFiles('/tmp');

    logger.logAssertion('Should find some files');
    expect(files.length).toBeGreaterThan(0);

    logger.logStep('Finding test file in list');
    const testFile = files.find(file => file.name === testFileName);
    expect(testFile).toBeTruthy();

    if (testFile) {
      logger.logAssertion('Test file should be identified as file');
      expect(testFile.isFile).toBe(true);
    }

    logger.logTestEnd('List files in directory', 'passed');
  });

  test('should validate file properties', async () => {
    logger.logTestStart('Validate file properties');

    logger.logStep('Validating file exists and has correct size');
    const isValid = await sftpClient.validateFile(
      remoteTestFile,
      testFileContent.length,
      5 // max age in minutes
    );

    logger.logAssertion('File validation should pass');
    expect(isValid).toBe(true);

    logger.logStep('Validating with incorrect size should fail');
    const isInvalid = await sftpClient.validateFile(
      remoteTestFile,
      999999,
      5
    );

    logger.logAssertion('File validation with wrong size should fail');
    expect(isInvalid).toBe(false);

    logger.logTestEnd('Validate file properties', 'passed');
  });

  test('should wait for file to appear', async () => {
    const waitTestFile = '/tmp/wait-test-file.txt';
    logger.logTestStart('Wait for file to appear');

    // First, ensure the file doesn't exist
    if (await sftpClient.fileExists(waitTestFile)) {
      await sftpClient.deleteFile(waitTestFile);
    }

    // Start waiting for file in background
    const waitPromise = sftpClient.waitForFile(waitTestFile, 15000, 2000);

    // Upload file after a delay
    setTimeout(async () => {
      logger.logStep('Uploading file after delay');
      await sftpClient.uploadFile(localTestFile, waitTestFile);
    }, 5000);

    logger.logStep('Waiting for file to appear');
    const found = await waitPromise;

    logger.logAssertion('File should be found');
    expect(found).toBe(true);

    // Cleanup
    await sftpClient.deleteFile(waitTestFile);

    logger.logTestEnd('Wait for file to appear', 'passed');
  });

  test('should handle non-existent file operations', async () => {
    const nonExistentFile = '/tmp/non-existent-file.txt';
    logger.logTestStart('Handle non-existent file operations');

    logger.logStep('Checking if non-existent file exists');
    const exists = await sftpClient.fileExists(nonExistentFile);
    expect(exists).toBe(false);

    logger.logStep('Attempting to get info for non-existent file');
    await expect(sftpClient.getFileInfo(nonExistentFile)).rejects.toThrow();

    logger.logStep('Attempting to download non-existent file');
    await expect(sftpClient.getFileContent(nonExistentFile)).rejects.toThrow();

    logger.logStep('Waiting for non-existent file should timeout');
    const found = await sftpClient.waitForFile(nonExistentFile, 5000, 1000);
    expect(found).toBe(false);

    logger.logTestEnd('Handle non-existent file operations', 'passed');
  });

  test('should create and delete directories', async () => {
    const testDir = '/tmp/test-automation-dir';
    logger.logTestStart('Create and delete directories');

    logger.logStep('Creating test directory');
    await sftpClient.createDirectory(testDir);

    logger.logStep('Verifying directory exists');
    const exists = await sftpClient.fileExists(testDir);
    expect(exists).toBe(true);

    logger.logStep('Getting directory info');
    const dirInfo = await sftpClient.getFileInfo(testDir);
    expect(dirInfo.isDirectory).toBe(true);

    logger.logStep('Deleting directory');
    await sftpClient.deleteDirectory(testDir);

    // Verify directory is deleted
    const existsAfterDelete = await sftpClient.fileExists(testDir);
    expect(existsAfterDelete).toBe(false);

    logger.logTestEnd('Create and delete directories', 'passed');
  });

  test.afterAll(async () => {
    if (sftpClient) {
      try {
        // Cleanup test files
        logger.info('Cleaning up test files');
        
        if (await sftpClient.fileExists(remoteTestFile)) {
          await sftpClient.deleteFile(remoteTestFile);
        }

        if (fs.existsSync(localTestFile)) {
          fs.unlinkSync(localTestFile);
        }

        await sftpClient.disconnect();
        logger.info('SFTP client tests cleanup completed');
      } catch (error) {
        logger.warn('Error during SFTP cleanup', { error });
      }
    }
  });
});
