import { useEffect, useState } from 'react';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import { api } from '../services/api.js';
import { createSocket } from '../services/socket.js';

export default function DisplayPage() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    api.getActiveOrders()
      .then((orders) => setReadyOrders(orders.filter((order) => order.status === 'READY')))
      .catch(() => {});

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('snapshot', (snapshot) => setReadyOrders(snapshot.readyOrders));

    return () => socket.disconnect();
  }, []);

  return (
    <main className="display-page">
      <div className="display-topbar">
        <ConnectionBadge connected={connected} />
      </div>
      <section className="display-card">
        <p className="eyebrow">Now Ready</p>
        <h1>Now Ready</h1>
        {readyOrders.length === 0 ? (
          <p className="display-empty">Please wait for your token.</p>
        ) : (
          <div className="display-token-grid">
            {readyOrders.map((order) => <div className="display-token" key={order.id}>Token {order.token_number}</div>)}
          </div>
        )}
      </section>
    </main>
  );
}
