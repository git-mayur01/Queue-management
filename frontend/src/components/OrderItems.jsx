export default function OrderItems({ items }) {
  return (
    <ul className="item-list">
      {items.map((item) => (
        <li key={`${item.id || item.item_name}-${item.item_name}`}>
          <span>{item.item_name}</span>
          <strong>x{item.quantity}</strong>
        </li>
      ))}
    </ul>
  );
}
