/**
 * Service Registry - Central registry for all application services
 * Provides dependency injection and service location capabilities
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, any> = new Map();
  private initialized: boolean = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of ServiceRegistry
   */
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service with the registry
   * @param name - Unique service name
   * @param service - Service instance
   */
  register<T>(name: string, service: T): void {
    if (this.services.has(name)) {
      console.warn(`Service ${name} is already registered. Overwriting.`);
    }
    this.services.set(name, service);
  }

  /**
   * Get a service from the registry
   * @param name - Service name
   * @returns Service instance
   * @throws Error if service not found
   */
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not registered`);
    }
    return service;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Initialize all registered services
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const initializationOrder = [
      'userDataManager',
      'electronBridge',
      'appInit',
      'websocketManager',
      'glassSystem',
      'configMenu',
      'soundSystem',
      'windowVisibility',
      'passthrough',
      'domEvents'
    ];

    for (const serviceName of initializationOrder) {
      if (this.has(serviceName)) {
        const service = this.get<any>(serviceName);
        if (typeof service.initialize === 'function') {
          try {
            await service.initialize();
            console.log(`Service ${serviceName} initialized successfully`);
          } catch (error) {
            console.error(`Failed to initialize service ${serviceName}:`, error);
          }
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Get all registered service names
   */
  getAllServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();