"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
const dotenv = require("dotenv");
// Load environment variables from .env file
dotenv.config();
class Environment {
    constructor() {
        this.config = {
            environment: process.env.ENVIRONMENT || 'local',
            baseUrl: process.env.BASE_URL || 'https://www.google.com',
            headless: process.env.HEADLESS === 'true' || process.env.CI === 'true',
            slowMo: parseInt(process.env.SLOW_MO || '0'),
            timeout: parseInt(process.env.TIMEOUT || '30000'),
            azure: {
                connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
                containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'test-container',
            },
            email: {
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.EMAIL_PORT || '587'),
                user: process.env.EMAIL_USER || '',
                password: process.env.EMAIL_PASSWORD || '',
                secure: process.env.EMAIL_SECURE === 'true',
            },
            sftp: {
                host: process.env.SFTP_HOST || '',
                port: parseInt(process.env.SFTP_PORT || '22'),
                username: process.env.SFTP_USERNAME || '',
                password: process.env.SFTP_PASSWORD,
                privateKeyPath: process.env.SFTP_PRIVATE_KEY_PATH,
            },
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                toFile: process.env.LOG_TO_FILE === 'true',
                filePath: process.env.LOG_FILE_PATH || './logs/test.log',
            },
        };
        this.validateConfig();
    }
    static getInstance() {
        if (!Environment.instance) {
            Environment.instance = new Environment();
        }
        return Environment.instance;
    }
    getConfig() {
        return this.config;
    }
    validateConfig() {
        const errors = [];
        if (!this.config.baseUrl) {
            errors.push('BASE_URL is required');
        }
        if (this.config.azure.connectionString === '') {
            console.warn('AZURE_STORAGE_CONNECTION_STRING is not set. Azure Blob Storage utilities will not work.');
        }
        if (this.config.email.user === '' || this.config.email.password === '') {
            console.warn('Email credentials are not set. Email validation utilities will not work.');
        }
        if (this.config.sftp.host === '' || this.config.sftp.username === '') {
            console.warn('SFTP credentials are not set. SFTP utilities will not work.');
        }
        if (errors.length > 0) {
            throw new Error(`Environment configuration errors: ${errors.join(', ')}`);
        }
    }
}
exports.Environment = Environment;
