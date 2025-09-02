"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston = require("winston");
const path = require("path");
const fs = require("fs");
const test_config_1 = require("../config/test-config");
class Logger {
    constructor() {
        const config = test_config_1.TestConfig.getInstance();
        const logConfig = config.logging;
        // Create logs directory if it doesn't exist
        if (logConfig.toFile) {
            const logDir = path.dirname(logConfig.filePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
        // Configure winston logger
        const transports = [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let log = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(meta).length > 0) {
                        log += ` ${JSON.stringify(meta)}`;
                    }
                    return log;
                }))
            })
        ];
        if (logConfig.toFile) {
            transports.push(new winston.transports.File({
                filename: logConfig.filePath,
                format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.json())
            }));
        }
        this.logger = winston.createLogger({
            level: logConfig.level,
            transports,
            exitOnError: false
        });
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    verbose(message, meta) {
        this.logger.verbose(message, meta);
    }
    logTestStart(testName) {
        this.info(`🧪 Test started: ${testName}`);
    }
    logTestEnd(testName, status) {
        const emoji = status === 'passed' ? '✅' : '❌';
        this.info(`${emoji} Test ${status}: ${testName}`);
    }
    logStep(step) {
        this.info(`📝 Step: ${step}`);
    }
    logAction(action) {
        this.info(`🔧 Action: ${action}`);
    }
    logAssertion(assertion) {
        this.info(`✔️ Assertion: ${assertion}`);
    }
}
exports.Logger = Logger;
