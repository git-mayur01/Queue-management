import { useEffect, useState } from 'react';
import AggregationPanel from '../components/AggregationPanel.jsx';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import OrderCard from '../components/OrderCard.jsx';
import StatsPanel from '../components/StatsPanel.jsx';
import { api } from '../services/api.js';
import { createSocket } from '../services/socket.js';

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [aggregation, setAggregation] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState(null);

  useEffect(() => {
    Promise.all([api.getActiveOrders(), api.getStats(), api.getAggregation()])
      .then(([activeOrders, nextStats, nextAggregation]) => {
        setOrders(activeOrders);
        setStats(nextStats);
        setAggregation(nextAggregation);
      })
      .catch((err) => setError(err.message));

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('snapshot', (snapshot) => {
      setOrders(snapshot.activeOrders);
      setStats(snapshot.stats);
      setAggregation(snapshot.aggregation);
    });

    return () => socket.disconnect();
  }, []);

  async function handleStatusChange(id, status) {
    setBusyOrderId(id);
    setError('');
    try {
      await api.updateStatus(id, status);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <main className="page kitchen-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Kitchen display system</p>
          <h1>Kitchen Dashboard</h1>
        </div>
        <ConnectionBadge connected={connected} />
      </div>

      <StatsPanel stats={stats} />
      <ErrorMessage message={error} />

      <div className="kitchen-layout">
        <AggregationPanel items={aggregation} />
        <section className="panel order-board">
          <div className="section-title-row">
            <h2>Active Orders</h2>
            <p>Serve by token order: first created, first served.</p>
          </div>
          {orders.length === 0 ? (
            <p className="empty-state">No active orders. The board is clear.</p>
          ) : (
            <div className="orders-grid">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} busy={busyOrderId === order.id} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
