import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { TestConfig } from '../config/test-config';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    const config = TestConfig.getInstance();
    const logConfig = config.logging;

    // Create logs directory if it doesn't exist
    if (logConfig.toFile) {
      const logDir = path.dirname(logConfig.filePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }

    // Configure winston logger
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(meta).length > 0) {
              log += ` ${JSON.stringify(meta)}`;
            }
            return log;
          })
        )
      })
    ];

    if (logConfig.toFile) {
      transports.push(
        new winston.transports.File({
          filename: logConfig.filePath,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json()
          )
        })
      );
    }

    this.logger = winston.createLogger({
      level: logConfig.level,
      transports,
      exitOnError: false
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  public verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  public logTestStart(testName: string): void {
    this.info(`🧪 Test started: ${testName}`);
  }

  public logTestEnd(testName: string, status: 'passed' | 'failed'): void {
    const emoji = status === 'passed' ? '✅' : '❌';
    this.info(`${emoji} Test ${status}: ${testName}`);
  }

  public logStep(step: string): void {
    this.info(`📝 Step: ${step}`);
  }

  public logAction(action: string): void {
    this.info(`🔧 Action: ${action}`);
  }

  public logAssertion(assertion: string): void {
    this.info(`✔️ Assertion: ${assertion}`);
  }
}
