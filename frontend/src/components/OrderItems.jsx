export default function OrderItems({ items, hidePrice, showCheckboxes, onItemStatusToggle }) {
  return (
    <ul className="item-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: 0, margin: 0, listStyle: 'none' }}>
      {items.map((item) => {
        const status = item.status?.toUpperCase() || 'PENDING';
        const isReady = status === 'READY';
        const isCooking = status === 'COOKING';
        const displayName = `${item.portion || 'Full'} ${item.item_name}`;

        if (showCheckboxes) {
          let bg = '#fff';
          let borderColor = 'var(--line)';
          let badgeTextColor = 'var(--ink)';
          let badgeBg = '#fff';
          let badgeBorder = '1px solid var(--line)';
          let textDecor = 'none';
          let textColor = 'var(--ink)';
          let opacity = '1';

          if (status === 'PENDING') {
            bg = '#fffdf5';
            borderColor = '#ffeeba';
            badgeTextColor = 'var(--amber)';
            badgeBg = '#fffbeb';
            badgeBorder = '1px solid #ffeeba';
          } else if (status === 'COOKING') {
            bg = '#eff6ff';
            borderColor = '#b3d7f5';
            badgeTextColor = 'var(--blue)';
            badgeBg = '#e5f1fc';
            badgeBorder = '1px solid #b3d7f5';
          } else if (status === 'READY') {
            bg = '#f0fdf4';
            borderColor = '#b7e2c8';
            badgeTextColor = 'var(--green)';
            badgeBg = '#e7f7ed';
            badgeBorder = '1px solid #b7e2c8';
            textDecor = 'line-through';
            textColor = 'var(--muted)';
          } else if (status === 'SERVED') {
            bg = '#f5f5f5';
            borderColor = '#eadfce';
            badgeTextColor = 'var(--muted)';
            badgeBg = '#eee';
            badgeBorder = '1px solid #ccc';
            textDecor = 'line-through';
            textColor = 'var(--muted)';
            opacity = '0.5';
          }

          return (
            <li 
              key={`${item.id || item.item_name}-${item.item_name}-${item.portion}`} 
              className={`order-item-row status-${status.toLowerCase()}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.8rem',
                background: bg,
                border: `1px solid ${borderColor}`,
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.2s ease',
                opacity: opacity
              }}
              onClick={() => onItemStatusToggle && onItemStatusToggle(item.id, item.status)}
            >
              {/* First Line: Name and Qty */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span 
                  className="order-item-name" 
                  style={{ 
                    fontWeight: '800', 
                    fontSize: '1.05rem',
                    textDecoration: textDecor,
                    color: textColor,
                    lineHeight: '1.2'
                  }}
                >
                  {displayName}
                </span>
                <strong style={{ fontSize: '1.2rem', color: isReady || status === 'SERVED' ? 'var(--muted)' : 'var(--primary-dark)', marginLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                  x{item.quantity}
                </strong>
              </div>

              {/* Second Line: Badges */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Status Badge */}
                <span style={{
                  fontSize: '0.72rem',
                  background: badgeBg,
                  color: badgeTextColor,
                  border: badgeBorder,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  display: 'inline-block'
                }}>
                  {status}
                </span>

                {/* Destination Tag */}
                {item.order_type && (
                  <span 
                    className={`portion-tag tag-${item.order_type.toLowerCase() === 'dine_in' ? 'dinein' : 'parcel'}`} 
                    style={{ 
                      textTransform: 'uppercase', 
                      fontSize: '0.72rem', 
                      fontWeight: '800',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: item.order_type === 'DINE_IN' ? '#e2f0fd' : '#fde8e5', 
                      color: item.order_type === 'DINE_IN' ? '#1769aa' : '#c0392b', 
                      border: item.order_type === 'DINE_IN' ? '1px solid #b3d7f5' : '1px solid #f2b8ae',
                      margin: 0
                    }}
                  >
                    {item.order_type === 'DINE_IN' ? 'DINE IN' : 'PARCEL'}
                  </span>
                )}
              </div>
            </li>
          );
        }

        // Default layout for Cashier
        return (
          <li key={`${item.id || item.item_name}-${item.item_name}-${item.portion}`} className="order-item-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--line)' }}>
            <div className="order-item-desc">
              <span className="order-item-name" style={{ fontWeight: '800', display: 'block' }}>{item.item_name}</span>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                {item.portion && (
                  <span className={`portion-tag tag-${item.portion.toLowerCase()}`}>
                    {item.portion}
                  </span>
                )}
                {item.order_type && (
                  <span className={`portion-tag tag-${item.order_type.toLowerCase() === 'dine_in' ? 'dinein' : 'parcel'}`} style={{ textTransform: 'uppercase', fontSize: '0.72rem', background: item.order_type === 'DINE_IN' ? '#e2f0fd' : '#fde8e5', color: item.order_type === 'DINE_IN' ? '#1769aa' : '#c0392b', border: item.order_type === 'DINE_IN' ? '1px solid #b3d7f5' : '1px solid #f2b8ae' }}>
                    {item.order_type === 'DINE_IN' ? 'DINE IN' : 'PARCEL'}
                  </span>
                )}
              </div>
            </div>
            <div className="order-item-qty-price">
              <strong>x{item.quantity}</strong>
              {!hidePrice && item.unit_price > 0 && (
                <span className="order-item-price" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'right' }}>
                  @ ₹{item.unit_price} = ₹{item.total_price}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

