import { ConfigMenu } from './config-menu/index';

// Make ConfigMenu globally available for backward compatibility
window.ConfigMenu = ConfigMenu as any;

export { ConfigMenu };
export default ConfigMenu;