import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export function getMenuItems() {
  if (!fs.existsSync(config.menuPath)) {
    fs.mkdirSync(path.dirname(config.menuPath), { recursive: true });
    fs.writeFileSync(config.menuPath, JSON.stringify([]));
  }

  const raw = fs.readFileSync(config.menuPath, 'utf8');
  let parsed = JSON.parse(raw);
  
  if (!Array.isArray(parsed)) {
    throw new Error('Menu file must contain a JSON array.');
  }

  let migrated = false;
  const migratedItems = parsed.map((item) => {
    if (typeof item === 'string') {
      migrated = true;
      return {
        name: item.trim(),
        halfPrice: 0,
        fullPrice: 0,
        available: true,
        category: 'OTHERS'
      };
    }

    const name = typeof item?.name === 'string' ? item.name.trim() : 'Unnamed';
    const halfPrice = typeof item?.halfPrice === 'number' ? item.halfPrice : 0;
    const fullPrice = typeof item?.fullPrice === 'number' ? item.fullPrice : 0;
    const available = typeof item?.available === 'boolean' ? item.available : true;
    const category = typeof item?.category === 'string' ? item.category.trim() : 'OTHERS';

    return { name, halfPrice, fullPrice, available, category };
  });

  if (migrated) {
    fs.writeFileSync(config.menuPath, JSON.stringify(migratedItems, null, 2), 'utf8');
  }

  return migratedItems;
}

export function saveMenuItems(items) {
  if (!Array.isArray(items)) {
    throw new Error('Menu items must be a JSON array.');
  }

  const validated = items.map((item) => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name) {
      throw new Error('Each menu item must have a non-empty name.');
    }
    const halfPrice = typeof item?.halfPrice === 'number' ? item.halfPrice : 0;
    const fullPrice = typeof item?.fullPrice === 'number' ? item.fullPrice : 0;
    const available = typeof item?.available === 'boolean' ? item.available : true;
    const category = typeof item?.category === 'string' ? item.category.trim() : 'OTHERS';

    if (halfPrice < 0 || fullPrice < 0) {
      throw new Error(`Prices for ${name} cannot be negative.`);
    }

    return { name, halfPrice, fullPrice, available, category };
  });

  fs.writeFileSync(config.menuPath, JSON.stringify(validated, null, 2), 'utf8');
  return validated;
}
