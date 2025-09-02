"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestConfig = void 0;
const environment_1 = require("./environment");
class TestConfig {
    constructor() {
        this._environment = environment_1.Environment.getInstance();
        this.config = this._environment.getConfig();
    }
    static getInstance() {
        if (!TestConfig.instance) {
            TestConfig.instance = new TestConfig();
        }
        return TestConfig.instance;
    }
    get baseUrl() {
        return this.config.baseUrl;
    }
    get headless() {
        return this.config.headless;
    }
    get slowMo() {
        return this.config.slowMo;
    }
    get timeout() {
        return this.config.timeout;
    }
    get azure() {
        return this.config.azure;
    }
    get email() {
        return this.config.email;
    }
    get sftp() {
        return this.config.sftp;
    }
    get logging() {
        return this.config.logging;
    }
    get environment() {
        return this.config.environment;
    }
    isCI() {
        return process.env.CI === 'true' || this.config.environment === 'ci';
    }
    isLocal() {
        return this.config.environment === 'local';
    }
}
exports.TestConfig = TestConfig;
