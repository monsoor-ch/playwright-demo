import * as Client from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as path from 'path';
import { TestConfig } from '../config/test-config';
import { Logger } from './logger';

export interface SftpFileInfo {
  name: string;
  size: number;
  modifyTime: Date;
  accessTime: Date;
  isFile: boolean;
  isDirectory: boolean;
  permissions: string;
}

export interface SftpConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export class SftpClient {
  private client: Client;
  private logger: Logger;
  private config: TestConfig;
  private isConnected: boolean = false;

  constructor() {
    this.config = TestConfig.getInstance();
    this.logger = Logger.getInstance();
    this.client = new Client();

    const sftpConfig = this.config.sftp;
    if (!sftpConfig.host || !sftpConfig.username) {
      throw new Error('SFTP configuration is incomplete');
    }
  }

  /**
   * Connect to SFTP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug('SFTP client is already connected');
      return;
    }

    const sftpConfig = this.config.sftp;
    const connectionConfig: SftpConnectionConfig = {
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
    };

    // Use either password or private key authentication
    if (sftpConfig.password) {
      connectionConfig.password = sftpConfig.password;
    } else if (sftpConfig.privateKeyPath) {
      try {
        connectionConfig.privateKey = fs.readFileSync(sftpConfig.privateKeyPath);
      } catch (error) {
        this.logger.error('Failed to read private key file', { 
          path: sftpConfig.privateKeyPath, 
          error 
        });
        throw error;
      }
    } else {
      throw new Error('Either password or private key must be provided for SFTP authentication');
    }

    try {
      await this.client.connect(connectionConfig);
      this.isConnected = true;
      this.logger.info(`Connected to SFTP server: ${sftpConfig.host}:${sftpConfig.port}`);
    } catch (error) {
      this.logger.error('Failed to connect to SFTP server', { 
        host: sftpConfig.host, 
        port: sftpConfig.port, 
        error 
      });
      throw error;
    }
  }

  /**
   * Disconnect from SFTP server
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
      this.logger.info('Disconnected from SFTP server');
    }
  }

  /**
   * Upload a file to SFTP server
   */
  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ensureConnection();

    try {
      if (!fs.existsSync(localPath)) {
        throw new Error(`Local file does not exist: ${localPath}`);
      }

      // Create remote directory if it doesn't exist
      const remoteDir = path.dirname(remotePath);
      await this.createDirectory(remoteDir);

      await this.client.put(localPath, remotePath);
      this.logger.info(`File uploaded successfully: ${localPath} -> ${remotePath}`);
    } catch (error) {
      this.logger.error('Failed to upload file', { 
        localPath, 
        remotePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Download a file from SFTP server
   */
  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.ensureConnection();

    try {
      // Create local directory if it doesn't exist
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      await this.client.get(remotePath, localPath);
      this.logger.info(`File downloaded successfully: ${remotePath} -> ${localPath}`);
    } catch (error) {
      this.logger.error('Failed to download file', { 
        remotePath, 
        localPath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Check if file exists on SFTP server
   */
  async fileExists(remotePath: string): Promise<boolean> {
    await this.ensureConnection();

    try {
      const exists = await this.client.exists(remotePath);
      this.logger.debug(`File existence check: ${remotePath} - ${exists ? 'exists' : 'not found'}`);
      return exists !== false;
    } catch (error) {
      this.logger.error('Failed to check file existence', { 
        remotePath, 
        error 
      });
      return false;
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(remotePath: string): Promise<SftpFileInfo> {
    await this.ensureConnection();

    try {
      const stats = await this.client.stat(remotePath);
      
      const fileInfo: SftpFileInfo = {
        name: path.basename(remotePath),
        size: stats.size,
        modifyTime: new Date(stats.mtime * 1000),
        accessTime: new Date(stats.atime * 1000),
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        permissions: stats.mode.toString(8)
      };

      this.logger.debug(`Retrieved file info for: ${remotePath}`, fileInfo);
      return fileInfo;
    } catch (error) {
      this.logger.error('Failed to get file info', { 
        remotePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * List files in directory
   */
  async listFiles(remotePath: string): Promise<SftpFileInfo[]> {
    await this.ensureConnection();

    try {
      const files = await this.client.list(remotePath);
      
      const fileInfos: SftpFileInfo[] = files.map(file => ({
        name: file.name,
        size: file.size,
        modifyTime: new Date(file.modifyTime),
        accessTime: new Date(file.accessTime),
        isFile: file.type === '-',
        isDirectory: file.type === 'd',
        permissions: file.rights?.toString() || ''
      }));

      this.logger.info(`Listed ${fileInfos.length} files in directory: ${remotePath}`);
      return fileInfos;
    } catch (error) {
      this.logger.error('Failed to list files', { 
        remotePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Create directory on SFTP server
   */
  async createDirectory(remotePath: string): Promise<void> {
    await this.ensureConnection();

    try {
      const exists = await this.client.exists(remotePath);
      if (!exists) {
        await this.client.mkdir(remotePath, true); // recursive = true
        this.logger.info(`Directory created: ${remotePath}`);
      } else {
        this.logger.debug(`Directory already exists: ${remotePath}`);
      }
    } catch (error) {
      this.logger.error('Failed to create directory', { 
        remotePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Delete file from SFTP server
   */
  async deleteFile(remotePath: string): Promise<void> {
    await this.ensureConnection();

    try {
      await this.client.delete(remotePath);
      this.logger.info(`File deleted: ${remotePath}`);
    } catch (error) {
      this.logger.error('Failed to delete file', { 
        remotePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Delete directory from SFTP server
   */
  async deleteDirectory(remotePath: string, recursive: boolean = false): Promise<void> {
    await this.ensureConnection();

    try {
      await this.client.rmdir(remotePath, recursive);
      this.logger.info(`Directory deleted: ${remotePath}`);
    } catch (error) {
      this.logger.error('Failed to delete directory', { 
        remotePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Validate file exists and has expected properties
   */
  async validateFile(
    remotePath: string, 
    expectedSize?: number, 
    maxAgeMinutes?: number
  ): Promise<boolean> {
    try {
      if (!(await this.fileExists(remotePath))) {
        this.logger.error(`Validation failed: File does not exist - ${remotePath}`);
        return false;
      }

      const fileInfo = await this.getFileInfo(remotePath);

      if (expectedSize !== undefined && fileInfo.size !== expectedSize) {
        this.logger.error(`Validation failed: Size mismatch for ${remotePath}. Expected: ${expectedSize}, Actual: ${fileInfo.size}`);
        return false;
      }

      if (maxAgeMinutes !== undefined) {
        const ageMinutes = (Date.now() - fileInfo.modifyTime.getTime()) / (1000 * 60);
        if (ageMinutes > maxAgeMinutes) {
          this.logger.error(`Validation failed: File is too old - ${remotePath}. Age: ${ageMinutes.toFixed(2)} minutes, Max: ${maxAgeMinutes} minutes`);
          return false;
        }
      }

      this.logger.info(`File validation passed for: ${remotePath}`);
      return true;
    } catch (error) {
      this.logger.error('File validation error', { 
        remotePath, 
        error 
      });
      return false;
    }
  }

  /**
   * Wait for file to appear on SFTP server
   */
  async waitForFile(
    remotePath: string, 
    timeoutMs: number = 30000, 
    pollIntervalMs: number = 5000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        if (await this.fileExists(remotePath)) {
          this.logger.info(`File found: ${remotePath}`);
          return true;
        }

        this.logger.debug(`File not found yet, waiting ${pollIntervalMs}ms...`);
        await this.wait(pollIntervalMs);
      } catch (error) {
        this.logger.warn('Error during file check, retrying...', { error });
        await this.wait(pollIntervalMs);
      }
    }

    this.logger.warn(`File not found within timeout period: ${remotePath}`);
    return false;
  }

  /**
   * Get file content as string
   */
  async getFileContent(remotePath: string): Promise<string> {
    await this.ensureConnection();

    try {
      const buffer = await this.client.get(remotePath);
      const content = buffer.toString();
      this.logger.info(`Retrieved content from file: ${remotePath}`);
      return content;
    } catch (error) {
      this.logger.error('Failed to get file content', { 
        remotePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * Wait helper method
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
