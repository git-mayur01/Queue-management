import http from 'node:http';
import os from 'node:os';
import { createApp } from './app.js';
import { config } from './config.js';
import { initSocket } from './socket/socket.js';
import './database/db.js';

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  return Object.values(interfaces)
    .flat()
    .filter((address) => address && address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}

const app = createApp();
const server = http.createServer(app);
initSocket(server);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Backend API running at http://localhost:${config.port}`);
  for (const ip of getLocalIPv4Addresses()) {
    console.log(`Local network API: http://${ip}:${config.port}`);
  }
});
