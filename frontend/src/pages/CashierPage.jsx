import { useEffect, useMemo, useState } from 'react';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import OrderItems from '../components/OrderItems.jsx';
import StatsPanel from '../components/StatsPanel.jsx';
import { api } from '../services/api.js';
import { createSocket } from '../services/socket.js';

export default function CashierPage() {
  const [menu, setMenu] = useState([]);
  const [orderType, setOrderType] = useState('DINE_IN');
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const [stats, setStats] = useState(null);
  const [readyOrders, setReadyOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getMenu().then((data) => setMenu(data.items)).catch((err) => setError(err.message));
    api.getStats().then(setStats).catch(() => {});

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('snapshot', (snapshot) => {
      setStats(snapshot.stats);
      setReadyOrders(snapshot.readyOrders);
    });

    return () => socket.disconnect();
  }, []);

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function addItem(itemName) {
    setCart((current) => {
      const existing = current.find((item) => item.item_name === itemName);
      if (existing) {
        return current.map((item) => item.item_name === itemName ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { item_name: itemName, quantity: 1 }];
    });
  }

  function changeQuantity(itemName, delta) {
    setCart((current) => current
      .map((item) => item.item_name === itemName ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('Add at least one item before generating an order.');
      return;
    }

    if (orderType === 'DINE_IN' && !tableNumber.trim()) {
      setError('Enter a table number for dine-in orders.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await api.createOrder({
        order_type: orderType,
        table_number: tableNumber.trim(),
        items: cart
      });
      setLastOrder(order);
      setCart([]);
      setTableNumber('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page cashier-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Mobile terminal</p>
          <h1>Cashier</h1>
        </div>
        <ConnectionBadge connected={connected} />
      </div>

      <StatsPanel stats={stats} />

      {readyOrders.length > 0 && (
        <section className="panel ready-alert">
          <h2>Ready for pickup</h2>
          <div className="ready-token-row">
            {readyOrders.map((order) => <span key={order.id}>Token #{order.token_number}</span>)}
          </div>
        </section>
      )}

      <form className="cashier-layout" onSubmit={submitOrder}>
        <section className="panel">
          <h2>1. Order type</h2>
          <div className="segmented-control">
            <button type="button" className={orderType === 'DINE_IN' ? 'active' : ''} onClick={() => setOrderType('DINE_IN')}>Dine In</button>
            <button type="button" className={orderType === 'PARCEL' ? 'active' : ''} onClick={() => setOrderType('PARCEL')}>Parcel</button>
          </div>
          {orderType === 'DINE_IN' && (
            <label className="field-label">
              Table number
              <input value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} placeholder="Example: 4" inputMode="numeric" />
            </label>
          )}
        </section>

        <section className="panel menu-panel">
          <h2>2. Add items</h2>
          <div className="menu-grid">
            {menu.map((item) => (
              <button type="button" key={item} onClick={() => addItem(item)}>{item}</button>
            ))}
          </div>
        </section>

        <section className="panel cart-panel">
          <h2>3. Current order</h2>
          {cart.length === 0 ? <p className="empty-state">Tap menu items to add them.</p> : (
            <ul className="cart-list">
              {cart.map((item) => (
                <li key={item.item_name}>
                  <span>{item.item_name}</span>
                  <div className="qty-controls">
                    <button type="button" onClick={() => changeQuantity(item.item_name, -1)}>-</button>
                    <strong>{item.quantity}</strong>
                    <button type="button" onClick={() => changeQuantity(item.item_name, 1)}>+</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ErrorMessage message={error} />
          <button className="primary-action" type="submit" disabled={submitting || cart.length === 0}>
            {submitting ? 'Generating...' : `Generate order (${totalItems})`}
          </button>
        </section>
      </form>

      {lastOrder && (
        <section className="panel token-card">
          <p>Generated successfully</p>
          <h2>Token #{lastOrder.token_number}</h2>
          <p>{lastOrder.order_type === 'DINE_IN' ? `Table ${lastOrder.table_number}` : 'Parcel'}</p>
          <OrderItems items={lastOrder.items} />
        </section>
      )}
    </main>
  );
}
