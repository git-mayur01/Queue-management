import fs from 'node:fs';
import { config } from '../config.js';

export function getMenuItems() {
  const raw = fs.readFileSync(config.menuPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error('Menu file must be a JSON array of item names.');
  }
  return parsed.map((item) => item.trim());
}
