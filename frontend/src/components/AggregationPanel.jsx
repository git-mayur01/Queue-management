export default function AggregationPanel({ items }) {
  return (
    <section className="panel aggregation-panel">
      <div className="section-title-row">
        <h2>Pending Item Counts</h2>
        <p>Batch similar dishes without changing FCFS serving order.</p>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">No pending kitchen items.</p>
      ) : (
        <ul className="aggregation-list">
          {items.map((item) => (
            <li key={item.item_name}>
              <span>{item.item_name}</span>
              <strong>{item.quantity}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
