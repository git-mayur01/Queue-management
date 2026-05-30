export const ORDER_TYPES = new Set(['DINE_IN', 'PARCEL']);
export const ORDER_STATUSES = new Set(['PENDING', 'COOKING', 'READY', 'DELIVERED']);

export function validateOrderPayload(payload) {
  const errors = [];
  const orderType = payload?.order_type;
  const tableNumber = typeof payload?.table_number === 'string' ? payload.table_number.trim() : '';
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!ORDER_TYPES.has(orderType)) {
    errors.push('order_type must be DINE_IN or PARCEL.');
  }

  if (orderType === 'DINE_IN' && !tableNumber) {
    errors.push('table_number is required for dine-in orders.');
  }

  if (items.length === 0) {
    errors.push('At least one item is required.');
  }

  const normalizedItems = [];
  for (const item of items) {
    const itemName = typeof item?.item_name === 'string' ? item.item_name.trim() : '';
    const quantity = Number(item?.quantity);

    if (!itemName) {
      errors.push('Each item needs an item_name.');
      continue;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push(`Quantity for ${itemName} must be a positive whole number.`);
      continue;
    }

    const existing = normalizedItems.find((entry) => entry.item_name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
      existing.quantity += quantity;
    } else {
      normalizedItems.push({ item_name: itemName, quantity });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      order_type: orderType,
      table_number: orderType === 'DINE_IN' ? tableNumber : null,
      items: normalizedItems
    }
  };
}

export function validateStatus(status) {
  return ORDER_STATUSES.has(status);
}
