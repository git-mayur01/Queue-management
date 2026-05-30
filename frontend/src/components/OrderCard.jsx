import OrderItems from './OrderItems.jsx';

const STATUSES = ['PENDING', 'COOKING', 'READY', 'DELIVERED'];

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(`${value}Z`));
}

export default function OrderCard({ order, onStatusChange, busy }) {
  return (
    <article className={`order-card status-${order.status.toLowerCase()}`}>
      <header className="order-card-header">
        <div>
          <p className="eyebrow">Token</p>
          <h2>#{order.token_number}</h2>
        </div>
        <span className="status-pill">{order.status}</span>
      </header>

      <div className="order-meta">
        <span>{order.order_type === 'DINE_IN' ? `Table ${order.table_number}` : 'Parcel'}</span>
        <span>{formatTime(order.created_at)}</span>
      </div>

      <OrderItems items={order.items} />

      <div className="status-actions" aria-label={`Update status for token ${order.token_number}`}>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={order.status === status ? 'selected' : ''}
            disabled={busy || order.status === status}
            onClick={() => onStatusChange(order.id, status)}
          >
            {status[0] + status.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
    </article>
  );
}
