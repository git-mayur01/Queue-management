import { db } from '../database/db.js';

const orderSelect = `
  SELECT id, token_number, table_number, order_type, status, created_at, updated_at
  FROM orders
`;

function getItemsForOrder(orderId) {
  return db.prepare(`
    SELECT id, order_id, item_name, quantity
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `).all(orderId);
}

function attachItems(order) {
  return order ? { ...order, items: getItemsForOrder(order.id) } : null;
}

export function getOrderById(id) {
  const order = db.prepare(`${orderSelect} WHERE id = ?`).get(id);
  return attachItems(order);
}

export function listOrders() {
  return db.prepare(`${orderSelect} ORDER BY token_number ASC`).all().map(attachItems);
}

export function listActiveOrders() {
  return db.prepare(`${orderSelect} WHERE status != 'DELIVERED' ORDER BY token_number ASC`).all().map(attachItems);
}

export function listReadyOrders() {
  return db.prepare(`${orderSelect} WHERE status = 'READY' ORDER BY token_number ASC LIMIT 20`).all().map(attachItems);
}

function nextTokenNumber() {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const latestToday = db.prepare(`
    SELECT MAX(token_number) AS latest
    FROM orders
    WHERE date(created_at) = date(?)
  `).get(todayPrefix);

  if (!latestToday?.latest || latestToday.latest < 100) {
    return 101;
  }

  return latestToday.latest + 1;
}

export function createOrder(orderInput) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (token_number, table_number, order_type, status)
    VALUES (?, ?, ?, 'PENDING')
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, item_name, quantity)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction((input) => {
    const tokenNumber = nextTokenNumber();
    const result = insertOrder.run(tokenNumber, input.table_number, input.order_type);
    for (const item of input.items) {
      insertItem.run(result.lastInsertRowid, item.item_name, item.quantity);
    }
    return getOrderById(result.lastInsertRowid);
  });

  return transaction(orderInput);
}

export function updateOrderStatus(id, status) {
  const result = db.prepare(`
    UPDATE orders
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, id);

  if (result.changes === 0) {
    return null;
  }

  return getOrderById(id);
}

export function getStats() {
  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM orders
    WHERE date(created_at) = date('now')
  `).get().count;

  const rows = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM orders
    WHERE date(created_at) = date('now')
    GROUP BY status
  `).all();

  const stats = {
    totalOrdersToday: total,
    pendingOrders: 0,
    cookingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0
  };

  for (const row of rows) {
    if (row.status === 'PENDING') stats.pendingOrders = row.count;
    if (row.status === 'COOKING') stats.cookingOrders = row.count;
    if (row.status === 'READY') stats.readyOrders = row.count;
    if (row.status === 'DELIVERED') stats.deliveredOrders = row.count;
  }

  return stats;
}

export function getAggregation() {
  return db.prepare(`
    SELECT oi.item_name, SUM(oi.quantity) AS quantity
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'DELIVERED'
    GROUP BY oi.item_name
    ORDER BY quantity DESC, oi.item_name ASC
  `).all();
}
