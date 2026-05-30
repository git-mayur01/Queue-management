import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT || 4000),
  databasePath: process.env.DATABASE_PATH || path.join(backendRoot, 'data', 'restaurant.sqlite'),
  menuPath: process.env.MENU_PATH || path.join(backendRoot, 'data', 'menu.json'),
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
