import { Environment, EnvironmentConfig } from './environment';

export class TestConfig {
  private static instance: TestConfig;
  private _environment: Environment;
  private config: EnvironmentConfig;

  private constructor() {
    this._environment = Environment.getInstance();
    this.config = this._environment.getConfig();
  }

  public static getInstance(): TestConfig {
    if (!TestConfig.instance) {
      TestConfig.instance = new TestConfig();
    }
    return TestConfig.instance;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get headless(): boolean {
    return this.config.headless;
  }

  get slowMo(): number {
    return this.config.slowMo;
  }

  get timeout(): number {
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

  get environment(): string {
    return this.config.environment;
  }

  public isCI(): boolean {
    return process.env.CI === 'true' || this.config.environment === 'ci';
  }

  public isLocal(): boolean {
    return this.config.environment === 'local';
  }
}
