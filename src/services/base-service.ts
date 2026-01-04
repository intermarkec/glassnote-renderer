/**
 * Base service class providing common functionality for all services
 */
export abstract class BaseService {
  protected initialized: boolean = false;
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.onInitialize();
      this.initialized = true;
      console.log(`Service ${this.name} initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize service ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Clean up the service
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.onCleanup();
      this.initialized = false;
      console.log(`Service ${this.name} cleaned up successfully`);
    } catch (error) {
      console.error(`Failed to cleanup service ${this.name}:`, error);
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get service name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Abstract method for service-specific initialization
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Abstract method for service-specific cleanup
   */
  protected abstract onCleanup(): Promise<void>;
}