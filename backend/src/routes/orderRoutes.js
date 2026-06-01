import { Router } from 'express';
import { emitDataChanged } from '../socket/socket.js';
import {
  createOrder,
  getAggregation,
  getStats,
  listActiveOrders,
  listOrders,
  updateOrderStatus,
  appendOrderItem,
  factoryResetSystem,
  updateOrderItemStatus,
  bulkCompleteItem,
  removeOrderItem
} from '../services/orderService.js';
import { saveMenuItems } from '../services/menuService.js';
import { validateOrderPayload, validateStatus } from '../utils/validation.js';
import { db } from '../database/db.js';
import { verifyPassword } from '../utils/crypto.js';

export const orderRouter = Router();

orderRouter.post('/orders', (req, res, next) => {
  try {
    const validation = validateOrderPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: 'Invalid order.', errors: validation.errors });
    }

    const order = createOrder(validation.value);
    emitDataChanged('order:created', order);
    return res.status(201).json(order);
  } catch (error) {
    return next(error);
  }
});

orderRouter.get('/orders', (req, res, next) => {
  try {
    res.json(listOrders());
  } catch (error) {
    next(error);
  }
});

orderRouter.get('/orders/active', (req, res, next) => {
  try {
    res.json(listActiveOrders());
  } catch (error) {
    next(error);
  }
});

orderRouter.patch('/orders/:id/status', (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!validateStatus(status)) {
      return res.status(400).json({ message: 'status must be PENDING, COOKING, READY, or DELIVERED.' });
    }

    const order = updateOrderStatus(Number(req.params.id), status);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    emitDataChanged('order:statusUpdated', order);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
});

orderRouter.post('/orders/:id/items', (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { item_name, portion, quantity, unit_price, total_price, order_type } = req.body;

    if (!item_name || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'item_name and a positive quantity are required.' });
    }

    const { updatedOrder, error } = appendOrderItem(orderId, {
      item_name: item_name.trim(),
      portion: portion || 'Full',
      quantity,
      unit_price: unit_price || 0,
      total_price: total_price || (unit_price || 0) * quantity,
      order_type: order_type || 'DINE_IN'
    });

    if (error) {
      return res.status(400).json({ message: error });
    }

    emitDataChanged('order:updated', {
      orderId,
      tableNumber: updatedOrder.table_number,
      orderType: updatedOrder.order_type,
      newItem: {
        item_name: item_name.trim(),
        portion: portion || 'Full',
        quantity,
        order_type: order_type || 'DINE_IN'
      }
    });

    return res.json(updatedOrder);
  } catch (error) {
    return next(error);
  }
});

orderRouter.get('/stats', (req, res, next) => {
  try {
    res.json(getStats());
  } catch (error) {
    next(error);
  }
});

orderRouter.get('/aggregation', (req, res, next) => {
  try {
    res.json(getAggregation());
  } catch (error) {
    next(error);
  }
});

orderRouter.post('/system/reset', (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Admin password is required for factory reset.' });
    }

    const adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
    if (!adminUser || !verifyPassword(password, adminUser.password_hash)) {
      return res.status(401).json({ message: 'Incorrect Admin password. Factory reset unauthorized.' });
    }

    factoryResetSystem();
    emitDataChanged('snapshot', { readyOrders: [], activeOrders: [] });
    res.json({ success: true, message: 'Factory Reset Completed Successfully.' });
  } catch (error) {
    next(error);
  }
});

orderRouter.patch('/orders/:orderId/items/:itemId/status', (req, res, next) => {
  try {
    const { status } = req.body;
    const updatedOrder = updateOrderItemStatus(Number(req.params.orderId), Number(req.params.itemId), status);
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order or Item not found.' });
    }
    emitDataChanged('order:itemStatusUpdated', updatedOrder);
    return res.json(updatedOrder);
  } catch (error) {
    return next(error);
  }
});

orderRouter.post('/items/bulk-complete', (req, res, next) => {
  try {
    const { item_name, portion } = req.body;
    if (!item_name) {
      return res.status(400).json({ message: 'item_name is required' });
    }
    bulkCompleteItem(item_name, portion);
    emitDataChanged('items:bulkCompleted', { item_name, portion });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

orderRouter.delete('/orders/:orderId/items/:itemId', (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const itemId = Number(req.params.itemId);

    const result = removeOrderItem(orderId, itemId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    emitDataChanged('order:itemRemoved', { orderId, itemId, ...result });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
