import { BlobServiceClient, ContainerClient, BlobClient } from '@azure/storage-blob';
import { TestConfig } from '../config/test-config';
import { Logger } from './logger';

export interface BlobInfo {
  name: string;
  size: number;
  lastModified: Date;
  contentType: string;
  etag: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  overwrite?: boolean;
}

export class AzureBlobClient {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private logger: Logger;
  private config: TestConfig;

  constructor() {
    this.config = TestConfig.getInstance();
    this.logger = Logger.getInstance();

    const connectionString = this.config.azure.connectionString;
    if (!connectionString) {
      throw new Error('Azure Storage connection string is not configured');
    }

    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(this.config.azure.containerName);
      this.logger.info(`Azure Blob Client initialized for container: ${this.config.azure.containerName}`);
    } catch (error) {
      this.logger.error('Failed to initialize Azure Blob Client', { error });
      throw error;
    }
  }

  /**
   * Create container if it doesn't exist
   */
  async createContainerIfNotExists(): Promise<void> {
    try {
      const createResponse = await this.containerClient.createIfNotExists({
        access: 'blob'
      });
      
      if (createResponse.succeeded) {
        this.logger.info(`Container '${this.config.azure.containerName}' created successfully`);
      } else {
        this.logger.debug(`Container '${this.config.azure.containerName}' already exists`);
      }
    } catch (error) {
      this.logger.error('Failed to create container', { error });
      throw error;
    }
  }

  /**
   * Upload a file to blob storage
   */
  async uploadFile(localFilePath: string, blobName: string, options?: UploadOptions): Promise<void> {
    try {
      const blobClient = this.containerClient.getBlockBlobClient(blobName);
      
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: options?.contentType || 'application/octet-stream'
        },
        metadata: options?.metadata,
        overwrite: options?.overwrite ?? true
      };

      await blobClient.uploadFile(localFilePath, uploadOptions);
      this.logger.info(`File uploaded successfully: ${localFilePath} -> ${blobName}`);
    } catch (error) {
      this.logger.error('Failed to upload file', { 
        localFilePath, 
        blobName, 
        error 
      });
      throw error;
    }
  }

  /**
   * Upload buffer/string content to blob storage
   */
  async uploadContent(content: string | Buffer, blobName: string, options?: UploadOptions): Promise<void> {
    try {
      const blobClient = this.containerClient.getBlockBlobClient(blobName);
      
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: options?.contentType || 'text/plain'
        },
        metadata: options?.metadata,
        overwrite: options?.overwrite ?? true
      };

      await blobClient.upload(content, content.length, uploadOptions);
      this.logger.info(`Content uploaded successfully to: ${blobName}`);
    } catch (error) {
      this.logger.error('Failed to upload content', { 
        blobName, 
        error 
      });
      throw error;
    }
  }

  /**
   * Download a blob to local file
   */
  async downloadFile(blobName: string, localFilePath: string): Promise<void> {
    try {
      const blobClient = this.containerClient.getBlobClient(blobName);
      await blobClient.downloadToFile(localFilePath);
      this.logger.info(`File downloaded successfully: ${blobName} -> ${localFilePath}`);
    } catch (error) {
      this.logger.error('Failed to download file', { 
        blobName, 
        localFilePath, 
        error 
      });
      throw error;
    }
  }

  /**
   * Download blob content as string
   */
  async downloadContent(blobName: string): Promise<string> {
    try {
      const blobClient = this.containerClient.getBlobClient(blobName);
      const downloadResponse = await blobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('No content available for download');
      }

      const content = await this.streamToString(downloadResponse.readableStreamBody);
      this.logger.info(`Content downloaded successfully from: ${blobName}`);
      return content;
    } catch (error) {
      this.logger.error('Failed to download content', { 
        blobName, 
        error 
      });
      throw error;
    }
  }

  /**
   * Check if blob exists
   */
  async blobExists(blobName: string): Promise<boolean> {
    try {
      const blobClient = this.containerClient.getBlobClient(blobName);
      const exists = await blobClient.exists();
      this.logger.debug(`Blob existence check: ${blobName} - ${exists ? 'exists' : 'not found'}`);
      return exists;
    } catch (error) {
      this.logger.error('Failed to check blob existence', { 
        blobName, 
        error 
      });
      return false;
    }
  }

  /**
   * Get blob information
   */
  async getBlobInfo(blobName: string): Promise<BlobInfo> {
    try {
      const blobClient = this.containerClient.getBlobClient(blobName);
      const properties = await blobClient.getProperties();
      
      const blobInfo: BlobInfo = {
        name: blobName,
        size: properties.contentLength || 0,
        lastModified: properties.lastModified || new Date(),
        contentType: properties.contentType || 'unknown',
        etag: properties.etag || ''
      };

      this.logger.debug(`Retrieved blob info for: ${blobName}`, blobInfo);
      return blobInfo;
    } catch (error) {
      this.logger.error('Failed to get blob info', { 
        blobName, 
        error 
      });
      throw error;
    }
  }

  /**
   * List all blobs in container
   */
  async listBlobs(prefix?: string): Promise<BlobInfo[]> {
    try {
      const blobs: BlobInfo[] = [];
      const options = prefix ? { prefix } : {};
      
      for await (const blob of this.containerClient.listBlobsFlat(options)) {
        blobs.push({
          name: blob.name,
          size: blob.properties.contentLength || 0,
          lastModified: blob.properties.lastModified || new Date(),
          contentType: blob.properties.contentType || 'unknown',
          etag: blob.properties.etag || ''
        });
      }

      this.logger.info(`Listed ${blobs.length} blobs${prefix ? ` with prefix '${prefix}'` : ''}`);
      return blobs;
    } catch (error) {
      this.logger.error('Failed to list blobs', { prefix, error });
      throw error;
    }
  }

  /**
   * Delete a blob
   */
  async deleteBlob(blobName: string): Promise<void> {
    try {
      const blobClient = this.containerClient.getBlobClient(blobName);
      await blobClient.delete();
      this.logger.info(`Blob deleted successfully: ${blobName}`);
    } catch (error) {
      this.logger.error('Failed to delete blob', { 
        blobName, 
        error 
      });
      throw error;
    }
  }

  /**
   * Validate file exists and has expected properties
   */
  async validateFile(blobName: string, expectedSize?: number, expectedContentType?: string): Promise<boolean> {
    try {
      if (!(await this.blobExists(blobName))) {
        this.logger.error(`Validation failed: Blob does not exist - ${blobName}`);
        return false;
      }

      const blobInfo = await this.getBlobInfo(blobName);
      
      if (expectedSize !== undefined && blobInfo.size !== expectedSize) {
        this.logger.error(`Validation failed: Size mismatch for ${blobName}. Expected: ${expectedSize}, Actual: ${blobInfo.size}`);
        return false;
      }

      if (expectedContentType && blobInfo.contentType !== expectedContentType) {
        this.logger.error(`Validation failed: Content type mismatch for ${blobName}. Expected: ${expectedContentType}, Actual: ${blobInfo.contentType}`);
        return false;
      }

      this.logger.info(`File validation passed for: ${blobName}`);
      return true;
    } catch (error) {
      this.logger.error('File validation error', { 
        blobName, 
        error 
      });
      return false;
    }
  }

  /**
   * Helper method to convert stream to string
   */
  private async streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks).toString());
      });
      readableStream.on('error', reject);
    });
  }
}
