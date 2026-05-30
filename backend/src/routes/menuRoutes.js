import { Router } from 'express';
import { getMenuItems } from '../services/menuService.js';

export const menuRouter = Router();

menuRouter.get('/', (req, res, next) => {
  try {
    res.json({ items: getMenuItems() });
  } catch (error) {
    next(error);
  }
});
