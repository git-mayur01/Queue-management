import { useEffect, useState, useMemo, useRef } from 'react';
import AggregationPanel from '../components/AggregationPanel.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import OrderCard from '../components/OrderCard.jsx';
import StatsPanel from '../components/StatsPanel.jsx';
import { api } from '../services/api.js';
import { createSocket } from '../services/socket.js';

// ── Compact summary strip (mobile only) ─────────────────────────
function KitchenSummaryStrip({ stats, activeCount }) {
  return (
    <div className="kitchen-summary-strip">
      <div className="kss-item">
        <span className="kss-label">Active</span>
        <strong className="kss-value kss-active">{activeCount}</strong>
      </div>
      <div className="kss-divider" />
      <div className="kss-item">
        <span className="kss-label">Pending</span>
        <strong className="kss-value">{stats?.pendingOrders ?? 0}</strong>
      </div>
      <div className="kss-divider" />
      <div className="kss-item">
        <span className="kss-label">Cooking</span>
        <strong className="kss-value kss-cooking">{stats?.cookingOrders ?? 0}</strong>
      </div>
      <div className="kss-divider" />
      <div className="kss-item">
        <span className="kss-label">Ready</span>
        <strong className="kss-value kss-ready">{stats?.readyOrders ?? 0}</strong>
      </div>
    </div>
  );
}

// ── Mobile Pending Items List ─────────────────────────────────────
function MobilePendingItems({ items }) {
  // Sort by quantity descending
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.quantity - a.quantity),
    [items]
  );

  if (sorted.length === 0) {
    return (
      <div className="kitchen-tab-empty">
        <span className="kitchen-tab-empty-icon">🍳</span>
        <p>No pending items right now. All clear!</p>
      </div>
    );
  }

  return (
    <ul className="mobile-pending-list">
      {sorted.map((item, idx) => (
        <li
          key={`${item.item_name}-${item.portion}`}
          className="mobile-pending-row"
          style={{ animationDelay: `${idx * 40}ms` }}
        >
          <div className="mpr-left">
            <span className="mpr-rank">#{idx + 1}</span>
            <div className="mpr-info">
              <span className="mpr-name">{item.item_name}</span>
              <span className={`portion-tag tag-${(item.portion || 'full').toLowerCase()}`}>
                {item.portion || 'Full'}
              </span>
            </div>
          </div>
          <div className="mpr-qty-wrap">
            <span className="mpr-qty">{item.quantity}</span>
            <span className="mpr-qty-label">qty</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Main KitchenPage ─────────────────────────────────────────────
export default function KitchenPage() {
  const isMounted = useRef(true);
  const activeTimers = useRef(new Set());

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      activeTimers.current.forEach(clearTimeout);
    };
  }, []);

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [aggregation, setAggregation] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Mobile tab state: 'active' | 'pending'
  const [activeTab, setActiveTab] = useState('active');
  const [tabDirection, setTabDirection] = useState('none'); // 'left' | 'right'

  useEffect(() => {
    Promise.all([api.getActiveOrders(), api.getStats(), api.getAggregation()])
      .then(([activeOrders, nextStats, nextAggregation]) => {
        if (isMounted.current) {
          setOrders(activeOrders);
          setStats(nextStats);
          setAggregation(nextAggregation);
        }
      })
      .catch((err) => {
        if (isMounted.current) setError(err.message);
      });

    const socket = createSocket();
    socket.on('connect', () => {
      if (isMounted.current) setConnected(true);
    });
    socket.on('disconnect', () => {
      if (isMounted.current) setConnected(false);
    });
    socket.on('snapshot', (snapshot) => {
      if (isMounted.current) {
        setOrders(snapshot.activeOrders);
        setStats(snapshot.stats);
        setAggregation(snapshot.aggregation);
      }
    });

    socket.on('order:updated', (data) => {
      if (isMounted.current) {
        const newNotif = {
          id: Date.now() + Math.random(),
          title: 'ORDER UPDATED',
          subtitle: data.orderType === 'DINE_IN' ? `Table ${data.tableNumber}` : 'Parcel',
          message: `New Item Added: ${data.newItem.quantity}x ${data.newItem.item_name} (${data.newItem.portion})`
        };
        setNotifications((prev) => [...prev, newNotif]);
        const timer = setTimeout(() => {
          if (isMounted.current) {
            setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
          }
          activeTimers.current.delete(timer);
        }, 8000);
        activeTimers.current.add(timer);
      }
    });

    return () => socket.disconnect();
  }, []);

  function switchTab(tab) {
    if (tab === activeTab) return;
    setTabDirection(tab === 'pending' ? 'right' : 'left');
    setActiveTab(tab);
  }

  async function handleStatusChange(id, status) {
    if (isMounted.current) {
      setBusyOrderId(id);
      setError('');
    }
    try {
      await api.updateStatus(id, status);
    } catch (err) {
      if (isMounted.current) setError(err.message);
    } finally {
      if (isMounted.current) setBusyOrderId(null);
    }
  }

  async function handleItemStatusChange(orderId, itemId, status) {
    if (isMounted.current) setError('');
    try {
      await api.updateItemStatus(orderId, itemId, status);
    } catch (err) {
      if (isMounted.current) setError(err.message);
    }
  }

  async function handleBulkComplete(itemName, portion) {
    if (isMounted.current) setError('');
    try {
      await api.bulkCompleteItem(itemName, portion);
    } catch (err) {
      if (isMounted.current) setError(err.message);
    }
  }

  const sortedOrders = orders.slice().sort((a, b) => a.token_number - b.token_number);

  return (
    <main className="page kitchen-page">
      <PageHeader title="Kitchen" connected={connected} />

      <ErrorMessage message={error} />

      {/* ═══════════ DESKTOP VIEW (≥ 768px) ═══════════ */}
      <div className="kitchen-desktop-view">
        <StatsPanel stats={stats} />
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
                {sortedOrders.map((order) => (
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
      </div>

      {/* ═══════════ MOBILE VIEW (< 768px) ═══════════ */}
      <div className="kitchen-mobile-view">

        {/* Compact summary strip */}
        <KitchenSummaryStrip stats={stats} activeCount={orders.length} />

        {/* Segmented tab nav */}
        <div className="kitchen-tab-nav" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'active'}
            className={`kitchen-tab-btn ${activeTab === 'active' ? 'ktab-active' : ''}`}
            onClick={() => switchTab('active')}
            id="tab-active"
          >
            <span className="ktab-icon">🍳</span>
            <span>Active Orders</span>
            {orders.length > 0 && (
              <span className="ktab-badge">{orders.length}</span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'pending'}
            className={`kitchen-tab-btn ${activeTab === 'pending' ? 'ktab-active' : ''}`}
            onClick={() => switchTab('pending')}
            id="tab-pending"
          >
            <span className="ktab-icon">📋</span>
            <span>Pending Items</span>
            {aggregation.length > 0 && (
              <span className="ktab-badge ktab-badge-amber">{aggregation.length}</span>
            )}
          </button>
        </div>

        {/* Sliding tab content */}
        <div
          className="kitchen-tab-content-wrap"
          aria-live="polite"
        >
          {/* Active Orders panel */}
          <div
            role="tabpanel"
            aria-labelledby="tab-active"
            className={`kitchen-tab-panel ${
              activeTab === 'active'
                ? 'ktab-panel-visible'
                : tabDirection === 'right'
                ? 'ktab-panel-exit-left'
                : 'ktab-panel-hidden-right'
            }`}
          >
            {sortedOrders.length === 0 ? (
              <div className="kitchen-tab-empty">
                <span className="kitchen-tab-empty-icon">✅</span>
                <p>No active orders — the board is clear!</p>
              </div>
            ) : (
              <div className="orders-grid kitchen-mobile-orders-grid">
                {sortedOrders.map((order) => (
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
          </div>

          {/* Pending Items panel */}
          <div
            role="tabpanel"
            aria-labelledby="tab-pending"
            className={`kitchen-tab-panel ${
              activeTab === 'pending'
                ? 'ktab-panel-visible'
                : tabDirection === 'left'
                ? 'ktab-panel-exit-right'
                : 'ktab-panel-hidden-left'
            }`}
          >
            <MobilePendingItems items={aggregation} />
          </div>
        </div>
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
