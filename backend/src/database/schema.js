export function initializeSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Check if we need to migrate the tables for SERVED and PARTIALLY_SERVED check constraints
  const ordersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'").get()?.sql || '';
  if (ordersSql && !ordersSql.includes('PARTIALLY_SERVED')) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        ALTER TABLE orders RENAME TO orders_old;
        ALTER TABLE order_items RENAME TO order_items_old;

        CREATE TABLE orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_number INTEGER NOT NULL UNIQUE,
          table_number TEXT,
          order_type TEXT NOT NULL CHECK (order_type IN ('DINE_IN', 'PARCEL')),
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COOKING', 'READY', 'PARTIALLY_SERVED', 'COMPLETED', 'DELIVERED')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          portion TEXT DEFAULT 'Full',
          unit_price REAL DEFAULT 0.0,
          total_price REAL DEFAULT 0.0,
          order_type TEXT DEFAULT 'DINE_IN',
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COOKING', 'READY', 'SERVED')),
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );

        INSERT INTO orders (id, token_number, table_number, order_type, status, created_at, updated_at)
        SELECT id, token_number, table_number, order_type, status, created_at, updated_at FROM orders_old;

        INSERT INTO order_items (id, order_id, item_name, quantity, portion, unit_price, total_price, order_type, status)
        SELECT id, order_id, item_name, quantity, portion, unit_price, total_price, order_type, status FROM order_items_old;

        DROP TABLE orders_old;
        DROP TABLE order_items_old;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number INTEGER NOT NULL UNIQUE,
      table_number TEXT,
      order_type TEXT NOT NULL CHECK (order_type IN ('DINE_IN', 'PARCEL')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COOKING', 'READY', 'PARTIALLY_SERVED', 'COMPLETED', 'DELIVERED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      portion TEXT DEFAULT 'Full',
      unit_price REAL DEFAULT 0.0,
      total_price REAL DEFAULT 0.0,
      order_type TEXT DEFAULT 'DINE_IN',
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COOKING', 'READY', 'SERVED')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token_number);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);

  // Migrate existing order_items table if new columns are missing
  const tableInfo = db.prepare("PRAGMA table_info(order_items)").all();
  const hasPortion = tableInfo.some(col => col.name === 'portion');
  const hasUnitPrice = tableInfo.some(col => col.name === 'unit_price');
  const hasTotalPrice = tableInfo.some(col => col.name === 'total_price');
  const hasOrderType = tableInfo.some(col => col.name === 'order_type');
  const hasStatus = tableInfo.some(col => col.name === 'status');

  if (!hasPortion) {
    db.exec("ALTER TABLE order_items ADD COLUMN portion TEXT DEFAULT 'Full'");
  }
  if (!hasUnitPrice) {
    db.exec("ALTER TABLE order_items ADD COLUMN unit_price REAL DEFAULT 0.0");
  }
  if (!hasTotalPrice) {
    db.exec("ALTER TABLE order_items ADD COLUMN total_price REAL DEFAULT 0.0");
  }
  if (!hasOrderType) {
    db.exec("ALTER TABLE order_items ADD COLUMN order_type TEXT DEFAULT 'DINE_IN'");
  }
  if (!hasStatus) {
    db.exec("ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COOKING', 'READY', 'SERVED'))");
  }
}
