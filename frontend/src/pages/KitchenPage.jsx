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
  const [notifications, setNotifications] = useState([]);

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

    socket.on('order:updated', (data) => {
      const newNotif = {
        id: Date.now() + Math.random(),
        title: 'ORDER UPDATED',
        subtitle: data.orderType === 'DINE_IN' ? `Table ${data.tableNumber}` : 'Parcel',
        message: `New Item Added: ${data.newItem.quantity}x ${data.newItem.item_name} (${data.newItem.portion})`
      };
      setNotifications((prev) => [...prev, newNotif]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
      }, 8000);
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

  async function handleItemStatusChange(orderId, itemId, status) {
    setError('');
    try {
      await api.updateItemStatus(orderId, itemId, status);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBulkComplete(itemName, portion) {
    setError('');
    try {
      await api.bulkCompleteItem(itemName, portion);
    } catch (err) {
      setError(err.message);
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
          </div>
          {orders.length === 0 ? (
            <p className="empty-state">No active orders. The board is clear.</p>
          ) : (
            <div className="orders-grid">
              {orders
                .slice()
                .sort((a, b) => a.token_number - b.token_number)
                .map((order) => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onStatusChange={handleStatusChange} 
                    busy={busyOrderId === order.id} 
                    isKitchen={true} 
                    onItemStatusChange={handleItemStatusChange}
                  />
                ))}
            </div>
          )}
        </section>
      </div>
      {/* Floating Notifications */}
      <div className="kitchen-notifications-container">
        {notifications.map((notif) => (
          <div key={notif.id} className="kitchen-notification-card">
            <header className="notification-header">
              <span className="notification-badge-icon">🔔</span>
              <strong>{notif.title}</strong>
            </header>
            <div className="notification-body">
              <h3 className="notification-table">{notif.subtitle}</h3>
              <p className="notification-message">{notif.message}</p>
            </div>
            <button
              className="notification-close-btn"
              onClick={() => setNotifications((prev) => prev.filter((n) => n.id !== notif.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
