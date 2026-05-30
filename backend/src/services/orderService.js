import { db } from '../database/db.js';

const orderSelect = `
  SELECT id, token_number, table_number, order_type, status, created_at, updated_at
  FROM orders
`;

function getItemsForOrder(orderId) {
  return db.prepare(`
    SELECT id, order_id, item_name, quantity, portion, unit_price, total_price, order_type, status
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
  return db.prepare(`${orderSelect} WHERE status != 'DELIVERED' ORDER BY token_number DESC`).all().map(attachItems);
}

export function listReadyOrders() {
  return db.prepare(`${orderSelect} WHERE status IN ('READY', 'COMPLETED') ORDER BY token_number ASC LIMIT 20`).all().map(attachItems);
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
    INSERT INTO order_items (order_id, item_name, quantity, portion, unit_price, total_price, order_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((input) => {
    const tokenNumber = nextTokenNumber();
    const result = insertOrder.run(tokenNumber, input.table_number, input.order_type);
    for (const item of input.items) {
      insertItem.run(
        result.lastInsertRowid,
        item.item_name,
        item.quantity,
        item.portion || 'Full',
        item.unit_price || 0,
        item.total_price || 0,
        item.order_type || input.order_type
      );
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
    if (row.status === 'COOKING') stats.cookingOrders += row.count;
    if (row.status === 'PARTIALLY_SERVED') stats.cookingOrders += row.count;
    if (row.status === 'READY') stats.readyOrders += row.count;
    if (row.status === 'COMPLETED') stats.readyOrders += row.count;
    if (row.status === 'DELIVERED') stats.deliveredOrders = row.count;
  }

  return stats;
}

export function getAggregation() {
  return db.prepare(`
    SELECT oi.item_name, oi.portion, SUM(oi.quantity) AS quantity
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'DELIVERED' AND oi.status NOT IN ('READY', 'SERVED')
    GROUP BY oi.item_name, oi.portion
    ORDER BY quantity DESC, oi.item_name ASC, oi.portion ASC
  `).all();
}

export function appendOrderItem(orderId, itemInput) {
  const order = getOrderById(orderId);
  if (!order) return { error: 'Order not found' };
  if (order.status === 'DELIVERED') return { error: 'Cannot edit a delivered order' };

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, item_name, quantity, portion, unit_price, total_price, order_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((input) => {
    insertItem.run(
      orderId,
      input.item_name,
      input.quantity,
      input.portion || 'Full',
      input.unit_price || 0,
      input.total_price || 0,
      input.order_type || order.order_type
    );

    db.prepare(`
      UPDATE orders
      SET updated_at = datetime('now')
      WHERE id = ?
    `).run(orderId);

    return getOrderById(orderId);
  });

  const updatedOrder = transaction(itemInput);
  return { updatedOrder };
}

export function factoryResetSystem() {
  db.transaction(() => {
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    try {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'orders'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'order_items'").run();
    } catch (e) {
      // sqlite_sequence may not exist yet
    }
  })();
}

export function updateOrderItemStatus(orderId, itemId, itemStatus) {
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE order_items
      SET status = ?
      WHERE id = ? AND order_id = ?
    `).run(itemStatus, itemId, orderId);

    const items = db.prepare(`
      SELECT status FROM order_items WHERE order_id = ?
    `).all(orderId);

    const total = items.length;
    const pendingCount = items.filter(i => i.status === 'PENDING').length;
    const cookingCount = items.filter(i => i.status === 'COOKING').length;
    const readyCount = items.filter(i => i.status === 'READY').length;
    const servedCount = items.filter(i => i.status === 'SERVED').length;

    let newOrderStatus = 'COOKING';
    if (servedCount === total && total > 0) {
      newOrderStatus = 'COMPLETED';
    } else if (readyCount === total && total > 0) {
      newOrderStatus = 'READY';
    } else if (pendingCount === total) {
      newOrderStatus = 'PENDING';
    } else if (cookingCount > 0) {
      newOrderStatus = 'COOKING';
    } else if (servedCount > 0) {
      newOrderStatus = 'PARTIALLY_SERVED';
    } else {
      newOrderStatus = 'COOKING';
    }

    db.prepare(`
      UPDATE orders
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newOrderStatus, orderId);

    return getOrderById(orderId);
  });

  return transaction();
}

export function bulkCompleteItem(itemName, portion) {
  const transaction = db.transaction(() => {
    const activeOrders = db.prepare(`
      SELECT id FROM orders WHERE status != 'DELIVERED'
    `).all();

    for (const order of activeOrders) {
      const items = db.prepare(`
        SELECT id, status FROM order_items
        WHERE order_id = ? AND item_name = ? AND portion = ?
      `).all(order.id, itemName, portion || 'Full');

      let updatedAny = false;
      for (const item of items) {
        if (item.status !== 'READY' && item.status !== 'SERVED') {
          db.prepare(`
            UPDATE order_items
            SET status = 'READY'
            WHERE id = ?
          `).run(item.id);
          updatedAny = true;
        }
      }

      if (updatedAny) {
        const allItems = db.prepare(`
          SELECT status FROM order_items WHERE order_id = ?
        `).all(order.id);

        const total = allItems.length;
        const pendingCount = allItems.filter(i => i.status === 'PENDING').length;
        const cookingCount = allItems.filter(i => i.status === 'COOKING').length;
        const readyCount = allItems.filter(i => i.status === 'READY').length;
        const servedCount = allItems.filter(i => i.status === 'SERVED').length;

        let newOrderStatus = 'COOKING';
        if (servedCount === total && total > 0) {
          newOrderStatus = 'COMPLETED';
        } else if (readyCount === total && total > 0) {
          newOrderStatus = 'READY';
        } else if (pendingCount === total) {
          newOrderStatus = 'PENDING';
        } else if (cookingCount > 0) {
          newOrderStatus = 'COOKING';
        } else if (servedCount > 0) {
          newOrderStatus = 'PARTIALLY_SERVED';
        } else {
          newOrderStatus = 'COOKING';
        }

        db.prepare(`
          UPDATE orders
          SET status = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(newOrderStatus, order.id);
      }
    }
  });

  transaction();
}

export function removeOrderItem(orderId, itemId) {
  const transaction = db.transaction(() => {
    const item = db.prepare('SELECT status FROM order_items WHERE id = ? AND order_id = ?').get(itemId, orderId);
    if (!item) {
      return { error: 'Item not found in this order' };
    }

    if (item.status === 'COOKING' || item.status === 'READY' || item.status === 'SERVED') {
      return { error: 'This item is already being prepared and cannot be removed.' };
    }

    db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);

    const remaining = db.prepare('SELECT id FROM order_items WHERE order_id = ?').all(orderId);
    if (remaining.length === 0) {
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
      return { deleted: true };
    }

    // Recalculate order status
    const remainingItems = db.prepare('SELECT status FROM order_items WHERE order_id = ?').all(orderId);
    const total = remainingItems.length;
    const pendingCount = remainingItems.filter(i => i.status === 'PENDING').length;
    const cookingCount = remainingItems.filter(i => i.status === 'COOKING').length;
    const readyCount = remainingItems.filter(i => i.status === 'READY').length;
    const servedCount = remainingItems.filter(i => i.status === 'SERVED').length;

    let newOrderStatus = 'COOKING';
    if (servedCount === total && total > 0) {
      newOrderStatus = 'COMPLETED';
    } else if (readyCount === total && total > 0) {
      newOrderStatus = 'READY';
    } else if (pendingCount === total) {
      newOrderStatus = 'PENDING';
    } else if (cookingCount > 0) {
      newOrderStatus = 'COOKING';
    } else if (servedCount > 0) {
      newOrderStatus = 'PARTIALLY_SERVED';
    } else {
      newOrderStatus = 'COOKING';
    }

    db.prepare(`
      UPDATE orders
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newOrderStatus, orderId);

    return { updatedOrder: getOrderById(orderId) };
  });

  return transaction();
}


