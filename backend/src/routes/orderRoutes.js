import { Router } from 'express';
import { emitDataChanged } from '../socket/socket.js';
import {
  createOrder,
  getAggregation,
  getStats,
  listActiveOrders,
  listOrders,
  updateOrderStatus
} from '../services/orderService.js';
import { validateOrderPayload, validateStatus } from '../utils/validation.js';

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
