import OrderItems from './OrderItems.jsx';

const STATUSES = ['PENDING', 'COOKING', 'READY', 'DELIVERED'];

const getNextStatus = (currentStatus) => {
  if (currentStatus === 'PENDING') return 'COOKING';
  if (currentStatus === 'COOKING') return 'READY';
  if (currentStatus === 'READY') return 'DELIVERED';
  return null;
};

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(`${value}Z`));
}

export default function OrderCard({ order, onStatusChange, onAddItem, busy, isKitchen, onItemStatusChange, onRemoveItem }) {
  const nextStatus = getNextStatus(order.status);
  const totalItems = order.items ? order.items.length : 0;
  const readyItems = order.items ? order.items.filter(item => item.status === 'READY' || item.status === 'SERVED').length : 0;
  const progressPercent = totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 0;

  let headerBg = 'transparent';
  let headerBorderColor = 'var(--line)';
  let stickyStyle = {};

  if (isKitchen) {
    const orderStatus = order.status.toUpperCase();
    stickyStyle = {
      position: 'sticky',
      top: 0,
      zIndex: 10,
    };
    if (orderStatus === 'PENDING') {
      headerBg = '#fff8ee'; // light amber
      headerBorderColor = 'var(--amber)';
    } else if (orderStatus === 'COOKING') {
      headerBg = '#eaf4fc'; // light blue
      headerBorderColor = 'var(--blue)';
    } else if (orderStatus === 'READY' || orderStatus === 'COMPLETED') {
      headerBg = '#e7f7ed'; // light green
      headerBorderColor = 'var(--green)';
    } else if (orderStatus === 'DELIVERED') {
      headerBg = '#f2ece4'; // light gray
      headerBorderColor = 'var(--muted)';
    }
  }

  const renderHeader = () => {
    if (isKitchen) {
      return (
        <header className="order-card-header-bar" style={{
          borderBottom: `2.5px solid ${headerBorderColor}`,
          backgroundColor: headerBg,
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          ...stickyStyle
        }}>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: 'var(--ink)', lineHeight: '1' }}>
            #{order.token_number}
          </h2>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontWeight: '900', fontSize: '1rem', color: 'var(--ink)', textTransform: 'uppercase' }}>
              {order.order_type === 'DINE_IN' ? `Table ${order.table_number}` : 'Parcel'}
            </span>
            <span style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--muted)' }}>
              {formatTime(order.created_at)}
            </span>
          </div>
        </header>
      );
    }

    return (
      <header className="order-card-header-bar" style={{
        borderBottom: '1px solid var(--line)',
        paddingBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Token</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900 }}>#{order.token_number}</h2>
          </div>
          <span className={`status-pill status-${order.status.toLowerCase()}`} style={{
            fontSize: '0.85rem',
            fontWeight: '900',
            padding: '0.4rem 0.8rem',
            borderRadius: '999px',
            textTransform: 'uppercase',
          }}>{order.status}</span>
        </div>
        <div className="order-meta" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontWeight: 800, fontSize: '0.9rem', margin: 0 }}>
          <span>{order.order_type === 'DINE_IN' ? `Table ${order.table_number}` : 'Parcel'}</span>
          <span>{formatTime(order.created_at)}</span>
        </div>
      </header>
    );
  };

  return (
    <article 
      className={`order-card status-${order.status.toLowerCase()}`} 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: isKitchen ? '0' : '0.8rem', 
        height: '100%', 
        maxHeight: isKitchen ? '540px' : '500px', 
        boxSizing: 'border-box',
        padding: isKitchen ? '0' : '1rem',
        overflow: 'hidden'
      }}
    >
      {/* Top Bar */}
      {renderHeader()}

      {/* Scrollable Items Area (Exactly 4 items in kitchen, up to 5 items in cashier visible) */}
      <div className="order-items-scroll" style={{
        overflowY: 'auto',
        flex: '1 1 auto',
        maxHeight: isKitchen ? '290px' : '255px',
        paddingLeft: isKitchen ? '1rem' : '0',
        paddingRight: isKitchen ? '1rem' : '0.25rem',
        paddingTop: isKitchen ? '1rem' : '0',
      }}>
        <OrderItems 
          items={order.items} 
          hidePrice={isKitchen} 
          showCheckboxes={isKitchen}
          onItemStatusToggle={(itemId, currentStatus) => {
            const status = currentStatus?.toUpperCase() || 'PENDING';
            let nextStatus = 'PENDING';
            if (status === 'PENDING') {
              nextStatus = 'COOKING';
            } else if (status === 'COOKING') {
              nextStatus = 'READY';
            } else if (status === 'READY') {
              nextStatus = 'SERVED';
            } else {
              nextStatus = 'PENDING';
            }
            if (onItemStatusChange) {
              onItemStatusChange(order.id, itemId, nextStatus);
            }
          }}
        />
      </div>

      {/* Bottom Nav Area */}
      <footer className="order-card-bottom-nav" style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        paddingLeft: isKitchen ? '1rem' : '0',
        paddingRight: isKitchen ? '1rem' : '0',
        paddingBottom: isKitchen ? '1rem' : '0',
      }}>
        {isKitchen && totalItems > 0 && (
          <div className="order-progress-section" style={{ borderTop: '1px dashed var(--line)', paddingTop: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontWeight: '800', fontSize: '0.9rem', color: 'var(--ink)' }}>
              <span>Ready Items: {readyItems} / {totalItems}</span>
              <span>Progress: {progressPercent}%</span>
            </div>
            <div className="progress-bar-track" style={{ width: '100%', height: '10px', background: '#eae3d5', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--line)' }}>
              <div className="progress-bar-fill" style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100 ? 'var(--green)' : 'var(--amber)',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}></div>
            </div>
          </div>
        )}

        {!isKitchen && (
          <div className="order-card-total" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px dashed var(--line)',
            paddingTop: '0.75rem',
            marginBottom: '0.5rem',
            fontWeight: '800',
          }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Total Amount</span>
            <strong style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>₹{order.items.reduce((sum, item) => sum + (item.total_price || 0), 0)}</strong>
          </div>
        )}

        {onAddItem && order.status !== 'DELIVERED' && (
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
            <button
              type="button"
              className="add-item-action-btn"
              style={{
                flex: 1,
                margin: 0,
                padding: '0.7rem 0.5rem',
                background: 'var(--green)',
                color: 'white',
                border: '0',
                borderRadius: '0.8rem',
                fontWeight: '900',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
              }}
              onClick={() => onAddItem(order)}
            >
              + Add Item
            </button>
            {onRemoveItem && (
              <button
                type="button"
                className="remove-item-action-btn"
                style={{
                  flex: 1,
                  margin: 0,
                  padding: '0.7rem 0.5rem',
                  background: 'transparent',
                  color: 'var(--primary)',
                  border: '2px solid var(--primary)',
                  borderRadius: '0.8rem',
                  fontWeight: '900',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.2rem',
                }}
                onClick={() => onRemoveItem(order)}
              >
                ✕ Remove
              </button>
            )}
          </div>
        )}

        {isKitchen && (order.status === 'COMPLETED' || order.status === 'READY') && onStatusChange && (
          <button
            type="button"
            className="mark-delivered-btn"
            style={{
              width: '100%',
              padding: '1rem',
              background: 'var(--green)',
              color: 'white',
              border: '0',
              borderRadius: '0.8rem',
              fontWeight: '900',
              fontSize: '1.2rem',
              marginTop: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(19, 138, 69, 0.3)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            disabled={busy}
            onClick={() => onStatusChange(order.id, 'DELIVERED')}
          >
            <span>✓</span> Mark Delivered
          </button>
        )}

        {onStatusChange && !isKitchen && (
          <div className="status-actions" style={{ marginTop: '0.5rem' }} aria-label={`Update status for token ${order.token_number}`}>
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={order.status === status ? 'selected' : ''}
                disabled={busy || status !== nextStatus}
                onClick={() => onStatusChange(order.id, status)}
              >
                {status[0] + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </footer>
    </article>
  );
}
