export function initializeSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number INTEGER NOT NULL UNIQUE,
      table_number TEXT,
      order_type TEXT NOT NULL CHECK (order_type IN ('DINE_IN', 'PARCEL')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COOKING', 'READY', 'DELIVERED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token_number);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);
}
