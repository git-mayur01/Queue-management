import { Server } from 'socket.io';
import { config } from '../config.js';
import { getAggregation, getStats, listActiveOrders, listReadyOrders } from '../services/orderService.js';

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PATCH']
    }
  });

  io.on('connection', (socket) => {
    socket.emit('snapshot', buildSnapshot());
  });

  return io;
}

export function buildSnapshot() {
  return {
    activeOrders: listActiveOrders(),
    readyOrders: listReadyOrders(),
    stats: getStats(),
    aggregation: getAggregation()
  };
}

export function emitDataChanged(eventName, payload = {}) {
  if (!io) return;
  io.emit(eventName, payload);
  io.emit('snapshot', buildSnapshot());
}
