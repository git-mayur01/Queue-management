import { Router } from 'express';
import { getMenuItems, saveMenuItems } from '../services/menuService.js';
import { emitDataChanged } from '../socket/socket.js';

export const menuRouter = Router();

menuRouter.get('/', (req, res, next) => {
  try {
    res.json({ items: getMenuItems() });
  } catch (error) {
    next(error);
  }
});

menuRouter.post('/', (req, res, next) => {
  try {
    const items = req.body?.items;
    const saved = saveMenuItems(items);
    emitDataChanged('menu:updated', saved);
    res.json({ success: true, items: saved });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
