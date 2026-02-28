import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

try {
  // Read the package.json
  const packageJsonPath = join(__dirname, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  // Create a reduced version with only essential fields
  const reducedPackage = {
    name: packageJson.name,
    version: packageJson.version,
    type: packageJson.type
  };
  
  // Ensure dist folder exists
  const distDir = join(__dirname, 'dist');
  try {
    mkdirSync(distDir, { recursive: true });
  } catch (err) {
    // Directory might already exist, ignore
  }
  
  // Write to dist folder
  const distPath = join(distDir, 'package.json');
  writeFileSync(distPath, JSON.stringify(reducedPackage, null, 2), 'utf8');
  
  // Copy index.html as glassnote.html for compatibility
  const indexPath = join(distDir, 'index.html');
  const glassnotePath = join(distDir, 'glassnote.html');
  
  try {
    if (existsSync(indexPath)) {
      copyFileSync(indexPath, glassnotePath);
    } else {
      console.warn('Warning: index.html not found in dist folder');
      console.warn('This may happen if Vite build failed or the file has a different name');
    }
  } catch (copyError) {
    console.warn('Warning: Could not copy index.html to glassnote.html:', copyError.message);
  }
  
} catch (error) {
  console.error('Error copying package.json to dist:', error);
  process.exit(1);
}