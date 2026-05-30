import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { menuRouter } from './routes/menuRoutes.js';
import { orderRouter } from './routes/orderRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.json({ ok: true, mode: 'local-network' });
  });

  app.use('/api/menu', menuRouter);
  app.use('/api', orderRouter);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(frontendDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      return res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found.' });
  });

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ message: 'Unexpected server error.' });
  });

  return app;
}
