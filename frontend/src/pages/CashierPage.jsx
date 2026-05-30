import { useEffect, useMemo, useState } from 'react';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import OrderCard from '../components/OrderCard.jsx';
import OrderItems from '../components/OrderItems.jsx';
import { api } from '../services/api.js';
import { createSocket } from '../services/socket.js';

export default function CashierPage() {
  const [menu, setMenu] = useState([]);
  const [orderType, setOrderType] = useState('DINE_IN');
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const [readyOrders, setReadyOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Portion selection modal states
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [selectedPortion, setSelectedPortion] = useState('Full');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Active Orders and Add/Remove Item to existing order modal states
  const [activeOrders, setActiveOrders] = useState([]);
  const [activeOrderEditing, setActiveOrderEditing] = useState(null);
  const [selectedModalItem, setSelectedModalItem] = useState(null);
  const [selectedModalPortion, setSelectedModalPortion] = useState('Full');
  const [selectedModalQuantity, setSelectedModalQuantity] = useState(1);
  const [selectedModalOrderType, setSelectedModalOrderType] = useState('DINE_IN');
  const [activeOrderRemoving, setActiveOrderRemoving] = useState(null);
  const [selectedItemToRemove, setSelectedItemToRemove] = useState(null);
  const [removeError, setRemoveError] = useState('');

  useEffect(() => {
    // Load initial menu
    api.getMenu().then((data) => setMenu(data.items)).catch((err) => setError(err.message));
    // Load active orders
    api.getActiveOrders().then((data) => setActiveOrders(data)).catch((err) => setError(err.message));

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('snapshot', (snapshot) => {
      setReadyOrders(snapshot.readyOrders);
      setActiveOrders(snapshot.activeOrders);
    });
    // Dynamically sync menu changes in realtime
    socket.on('menu:updated', (newMenu) => {
      setMenu(newMenu);
    });

    return () => socket.disconnect();
  }, []);

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const billAmount = useMemo(() => cart.reduce((sum, item) => sum + item.total_price, 0), [cart]);

  const sortedMenu = useMemo(() => {
    return [...menu].sort((a, b) => a.name.localeCompare(b.name));
  }, [menu]);

  function handleTableNumberChange(event) {
    const val = event.target.value.replace(/\D/g, ''); // only digits
    if (val === '') {
      setTableNumber('');
      return;
    }
    const num = parseInt(val, 10);
    if (num <= 15) {
      setTableNumber(num.toString());
    }
  }

  function handleMenuClick(item) {
    if (!item.available) return; // ignore if out of stock
    setActiveModalItem(item);
    // Set default portion based on what is available
    if (item.fullPrice > 0) {
      setSelectedPortion('Full');
    } else if (item.halfPrice > 0) {
      setSelectedPortion('Half');
    } else {
      setSelectedPortion('Full');
    }
    setSelectedQuantity(1);
  }

  function addToCart() {
    if (!activeModalItem) return;

    const portion = selectedPortion;
    const qty = selectedQuantity;
    const unitPrice = portion === 'Half' ? activeModalItem.halfPrice : activeModalItem.fullPrice;

    setCart((current) => {
      const existing = current.find(
        (item) => item.item_name === activeModalItem.name && item.portion === portion
      );
      if (existing) {
        return current.map((item) =>
          item.item_name === activeModalItem.name && item.portion === portion
            ? { ...item, quantity: item.quantity + qty, total_price: (item.quantity + qty) * unitPrice }
            : item
        );
      }
      return [
        ...current,
        {
          item_name: activeModalItem.name,
          portion,
          quantity: qty,
          unit_price: unitPrice,
          total_price: qty * unitPrice
        }
      ];
    });

    setActiveModalItem(null);
  }

  function changeQuantity(itemName, portion, delta) {
    setCart((current) => current
      .map((item) => {
        if (item.item_name === itemName && item.portion === portion) {
          const newQty = item.quantity + delta;
          return { ...item, quantity: newQty, total_price: newQty * item.unit_price };
        }
        return item;
      })
      .filter((item) => item.quantity > 0));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('Add at least one item before generating an order.');
      return;
    }

    if (orderType === 'DINE_IN') {
      const tableNum = parseInt(tableNumber, 10);
      if (!tableNumber.trim()) {
        setError('Enter a table number for dine-in orders.');
        return;
      }
      if (isNaN(tableNum) || tableNum < 1 || tableNum > 15) {
        setError('Table number must be between 1 and 15.');
        return;
      }
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
      setTimeout(() => {
        setLastOrder(null);
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenAddItemModal(order) {
    setActiveOrderEditing(order);
    setSelectedModalItem(null);
    setSelectedModalPortion('Full');
    setSelectedModalQuantity(1);
    setSelectedModalOrderType(order.order_type);
  }

  function handleCloseAddItemModal() {
    setActiveOrderEditing(null);
    setSelectedModalItem(null);
    setSelectedModalPortion('Full');
    setSelectedModalQuantity(1);
  }

  function handleSelectModalItem(item) {
    setSelectedModalItem(item);
    if (item.fullPrice > 0) {
      setSelectedModalPortion('Full');
    } else if (item.halfPrice > 0) {
      setSelectedModalPortion('Half');
    } else {
      setSelectedModalPortion('Full');
    }
    setSelectedModalQuantity(1);
  }

  async function handleSaveAddItem() {
    if (!activeOrderEditing || !selectedModalItem) return;

    const unitPrice = selectedModalPortion === 'Half' ? selectedModalItem.halfPrice : selectedModalItem.fullPrice;
    const itemPayload = {
      item_name: selectedModalItem.name,
      portion: selectedModalPortion,
      quantity: selectedModalQuantity,
      unit_price: unitPrice,
      total_price: selectedModalQuantity * unitPrice,
      order_type: selectedModalOrderType
    };

    try {
      await api.addOrderItem(activeOrderEditing.id, itemPayload);
      handleCloseAddItemModal();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleOpenRemoveItemModal(order) {
    setActiveOrderRemoving(order);
    setSelectedItemToRemove(null);
    setRemoveError('');
  }

  function handleCloseRemoveItemModal() {
    setActiveOrderRemoving(null);
    setSelectedItemToRemove(null);
    setRemoveError('');
  }

  async function handleRemoveItemSubmit() {
    if (!selectedItemToRemove) {
      setRemoveError('Please select an item to remove.');
      return;
    }

    const item = activeOrderRemoving.items.find(i => i.id === selectedItemToRemove);
    if (!item) return;

    if (item.status === 'COOKING' || item.status === 'READY' || item.status === 'SERVED') {
      setRemoveError('This item is already being prepared and cannot be removed.');
      return;
    }

    if (activeOrderRemoving.items.length === 1) {
      const confirmText = 'This will make the order empty. Continue?';
      if (!window.confirm(confirmText)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to remove ${item.portion || 'Full'} ${item.item_name} from the order?`)) {
        return;
      }
    }

    try {
      await api.removeOrderItem(activeOrderRemoving.id, selectedItemToRemove);
      handleCloseRemoveItemModal();
    } catch (err) {
      setRemoveError(err.message);
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

      {readyOrders.length > 0 && (
        <section className="panel ready-alert">
          <h2>Ready for pickup</h2>
          <div className="ready-token-row">
            {readyOrders.map((order) => <span key={order.id}>Token #{order.token_number}</span>)}
          </div>
        </section>
      )}

      <form className="cashier-layout" onSubmit={submitOrder}>
        {/* Step 1: Order Type */}
        <section className="panel">
          <h2>1. Order type</h2>
          <div className="segmented-control">
            <button type="button" className={orderType === 'DINE_IN' ? 'active' : ''} onClick={() => setOrderType('DINE_IN')}>Dine In</button>
            <button type="button" className={orderType === 'PARCEL' ? 'active' : ''} onClick={() => setOrderType('PARCEL')}>Parcel</button>
          </div>
          {orderType === 'DINE_IN' && (
            <label className="field-label">
              Table number
              <input 
                type="text"
                pattern="[0-9]*"
                value={tableNumber} 
                onChange={handleTableNumberChange} 
                placeholder="1 to 15" 
                inputMode="numeric" 
              />
            </label>
          )}
        </section>

        {/* Step 2: Add Items */}
        <section className="panel menu-panel">
          <h2>2. Add items</h2>
          <div className="menu-grid">
            {sortedMenu.map((item) => (
              <button
                type="button"
                key={item.name}
                className={`menu-item-card ${item.available ? 'item-available' : 'item-unavailable'}`}
                onClick={() => handleMenuClick(item)}
                disabled={!item.available}
              >
                <span className="item-title">{item.name}</span>
                {!item.available && <span className="unavailable-badge">Out of Stock</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Step 3: Current Order Summary */}
        <section className="panel cart-panel">
          <h2>3. Current order</h2>
          {cart.length === 0 ? <p className="empty-state">Tap menu items to add them.</p> : (
            <>
              <ul className="cart-list">
                {cart.map((item) => (
                  <li key={`${item.item_name}-${item.portion}`} className="cart-item-row">
                    <div className="cart-item-meta">
                      <span className="cart-item-name">{item.item_name}</span>
                      <span className="cart-item-portion">{item.portion}</span>
                      <span className="cart-item-unit">₹{item.unit_price} each</span>
                    </div>
                    <div className="cart-item-controls">
                      <div className="qty-controls">
                        <button type="button" onClick={() => changeQuantity(item.item_name, item.portion, -1)}>-</button>
                        <strong>{item.quantity}</strong>
                        <button type="button" onClick={() => changeQuantity(item.item_name, item.portion, 1)}>+</button>
                      </div>
                      <span className="cart-item-subtotal">₹{item.total_price}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="cart-summary-total">
                <span>Total Items: <strong>{totalItems}</strong></span>
                <span>Bill Amount: <strong>₹{billAmount}</strong></span>
              </div>
            </>
          )}
          <ErrorMessage message={error} />
          <button className="primary-action" type="submit" disabled={submitting || cart.length === 0}>
            {submitting ? 'Generating...' : `Generate order (₹${billAmount})`}
          </button>
        </section>
      </form>

      {/* Portion Selection Modal */}
      {activeModalItem && (
        <div className="modal-overlay" onClick={() => setActiveModalItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Select Portion & Quantity</h2>
              <button type="button" className="btn-close-modal" onClick={() => setActiveModalItem(null)}>×</button>
            </header>
            
            <div className="modal-body">
              <h3 className="modal-item-title">{activeModalItem.name}</h3>
              
              <div className="portion-selector-row">
                <span className="selector-label">Portion:</span>
                <div className="portion-options">
                  {activeModalItem.halfPrice > 0 && (
                    <button
                      type="button"
                      className={`portion-btn ${selectedPortion === 'Half' ? 'selected' : ''}`}
                      onClick={() => setSelectedPortion('Half')}
                    >
                      Half Plate (₹{activeModalItem.halfPrice})
                    </button>
                  )}
                  {activeModalItem.fullPrice > 0 && (
                    <button
                      type="button"
                      className={`portion-btn ${selectedPortion === 'Full' ? 'selected' : ''}`}
                      onClick={() => setSelectedPortion('Full')}
                    >
                      Full Plate (₹{activeModalItem.fullPrice})
                    </button>
                  )}
                </div>
              </div>

              <div className="quantity-selector-row">
                <span className="selector-label">Quantity:</span>
                <div className="qty-controls modal-qty-controls">
                  <button type="button" disabled={selectedQuantity <= 1} onClick={() => setSelectedQuantity(q => q - 1)}>-</button>
                  <strong>{selectedQuantity}</strong>
                  <button type="button" onClick={() => setSelectedQuantity(q => q + 1)}>+</button>
                </div>
              </div>

              <div className="modal-total-bar">
                <span>Portion Total:</span>
                <strong>₹{((selectedPortion === 'Half' ? activeModalItem.halfPrice : activeModalItem.fullPrice) * selectedQuantity)}</strong>
              </div>
            </div>

            <footer className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setActiveModalItem(null)}>Cancel</button>
              <button type="button" className="primary-action btn-confirm-add" onClick={addToCart}>
                Add to Cart
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Active Orders Section */}
      <section className="panel cashier-active-orders-panel" style={{ marginTop: '2rem' }}>
        <div className="section-title-row">
          <h2>Active Orders</h2>
          <p>Orders currently in progress. Tap "Add Item" to append new items.</p>
        </div>
        {activeOrders.length === 0 ? (
          <p className="empty-state">No active orders at the moment.</p>
        ) : (
          <div className="orders-grid">
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAddItem={handleOpenAddItemModal}
                onRemoveItem={handleOpenRemoveItemModal}
              />
            ))}
          </div>
        )}
      </section>

      {/* Add Item to Existing Order Modal */}
      {activeOrderEditing && (
        <div className="modal-overlay" onClick={handleCloseAddItemModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Add Item to Order</h2>
              <button type="button" className="btn-close-modal" onClick={handleCloseAddItemModal}>×</button>
            </header>
            
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--line)' }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: '0.2rem' }}>Target Order</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--ink)' }}>
                  Token #{activeOrderEditing.token_number} — {activeOrderEditing.order_type === 'DINE_IN' ? `Table ${activeOrderEditing.table_number}` : 'Parcel'}
                </strong>
              </div>

              {/* Step A: Select Item */}
              <div style={{ marginBottom: '1.2rem' }}>
                <span className="selector-label" style={{ display: 'block', marginBottom: '0.5rem' }}>1. Select Item:</span>
                <div className="menu-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '0.8rem', padding: '0.5rem', background: '#fff' }}>
                  {sortedMenu.map((item) => (
                    <button
                      type="button"
                      key={item.name}
                      className={`menu-item-card ${item.available ? 'item-available' : 'item-unavailable'} ${selectedModalItem?.name === item.name ? 'selected-item' : ''}`}
                      style={selectedModalItem?.name === item.name ? { borderColor: 'var(--primary)', background: '#fff5f5' } : {}}
                      onClick={() => handleSelectModalItem(item)}
                      disabled={!item.available}
                    >
                      <span className="item-title" style={{ fontSize: '0.85rem' }}>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step B: Portion & Quantity Selectors */}
              {selectedModalItem && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                  <div className="portion-selector-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span className="selector-label">Portion Type</span>
                    <div style={{ display: 'flex', gap: '1.25rem' }}>
                      {selectedModalItem.halfPrice > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="modalPortion"
                            value="Half"
                            checked={selectedModalPortion === 'Half'}
                            onChange={() => setSelectedModalPortion('Half')}
                            style={{ width: 'auto', margin: 0 }}
                          />
                          Half Plate (₹{selectedModalItem.halfPrice})
                        </label>
                      )}
                      {selectedModalItem.fullPrice > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="modalPortion"
                            value="Full"
                            checked={selectedModalPortion === 'Full'}
                            onChange={() => setSelectedModalPortion('Full')}
                            style={{ width: 'auto', margin: 0 }}
                          />
                          Full Plate (₹{selectedModalItem.fullPrice})
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="order-type-selector-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span className="selector-label">Order Type</span>
                    <div style={{ display: 'flex', gap: '1.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="modalOrderType"
                          value="DINE_IN"
                          checked={selectedModalOrderType === 'DINE_IN'}
                          onChange={() => setSelectedModalOrderType('DINE_IN')}
                          style={{ width: 'auto', margin: 0 }}
                        />
                        Dine In
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="modalOrderType"
                          value="PARCEL"
                          checked={selectedModalOrderType === 'PARCEL'}
                          onChange={() => setSelectedModalOrderType('PARCEL')}
                          style={{ width: 'auto', margin: 0 }}
                        />
                        Parcel
                      </label>
                    </div>
                  </div>

                  <div className="quantity-selector-row">
                    <span className="selector-label">3. Quantity:</span>
                    <div className="qty-controls modal-qty-controls">
                      <button type="button" disabled={selectedModalQuantity <= 1} onClick={() => setSelectedModalQuantity(q => q - 1)}>-</button>
                      <strong>{selectedModalQuantity}</strong>
                      <button type="button" onClick={() => setSelectedModalQuantity(q => q + 1)}>+</button>
                    </div>
                  </div>

                  <div className="modal-total-bar">
                    <span>Item Total:</span>
                    <strong>₹{((selectedModalPortion === 'Half' ? selectedModalItem.halfPrice : selectedModalItem.fullPrice) * selectedModalQuantity)}</strong>
                  </div>
                </div>
              )}
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseAddItemModal}>Cancel</button>
              <button
                type="button"
                className="primary-action btn-confirm-add"
                onClick={handleSaveAddItem}
                disabled={!selectedModalItem}
              >
                Save
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Remove Item Modal */}
      {activeOrderRemoving && (
        <div className="modal-overlay" onClick={handleCloseRemoveItemModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Remove Item (Token #{activeOrderRemoving.token_number})</h2>
              <button type="button" className="btn-close-modal" onClick={handleCloseRemoveItemModal}>×</button>
            </header>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
              {removeError && <div className="error-message">{removeError}</div>}
              
              <p style={{ margin: 0, fontWeight: 800, color: 'var(--muted)', fontSize: '0.95rem' }}>Select item to remove:</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                {activeOrderRemoving.items.map((item) => {
                  const isSelectable = !(item.status === 'COOKING' || item.status === 'READY' || item.status === 'SERVED');
                  return (
                    <label 
                      key={item.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '0.75rem 1rem', 
                        borderRadius: '0.8rem', 
                        border: `1px solid ${selectedItemToRemove === item.id ? 'var(--primary)' : 'var(--line)'}`, 
                        background: selectedItemToRemove === item.id ? '#fdf8f7' : isSelectable ? 'white' : '#f5f5f5', 
                        cursor: isSelectable ? 'pointer' : 'not-allowed',
                        opacity: isSelectable ? 1 : 0.6,
                        fontWeight: '800'
                      }}
                    >
                      <input
                        type="radio"
                        name="itemToRemove"
                        value={item.id}
                        disabled={!isSelectable}
                        checked={selectedItemToRemove === item.id}
                        onChange={() => {
                          setRemoveError('');
                          setSelectedItemToRemove(item.id);
                        }}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        <span style={{ fontSize: '1rem', color: isSelectable ? 'var(--ink)' : 'var(--muted)' }}>
                          {item.portion || 'Full'} {item.item_name} x{item.quantity}
                        </span>
                        {!isSelectable && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 900, textTransform: 'uppercase', marginTop: '0.15rem' }}>
                            {item.status === 'COOKING' ? '🍳 Being Prepared' : item.status === 'READY' ? '🟢 Ready' : '🍽 Served'}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <footer className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseRemoveItemModal}>Cancel</button>
              <button
                type="button"
                className="primary-action"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 0,
                  borderRadius: '0.8rem',
                  fontWeight: '900',
                  padding: '0.8rem 1.5rem',
                  cursor: 'pointer',
                }}
                onClick={handleRemoveItemSubmit}
                disabled={!selectedItemToRemove}
              >
                Remove
              </button>
            </footer>
          </div>
        </div>
      )}

      {lastOrder && (
        <div className="cashier-toast">
          <span className="toast-icon">✅</span>
          <div>
            <strong>Order Generated Successfully!</strong>
            <span>Token #{lastOrder.token_number} ({lastOrder.order_type === 'DINE_IN' ? `Table ${lastOrder.table_number}` : 'Parcel'})</span>
          </div>
        </div>
      )}
    </main>
  );
}
