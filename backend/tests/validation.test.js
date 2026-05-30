import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderPayload, validateStatus } from '../src/utils/validation.js';

test('validates and merges duplicate order items', () => {
  const result = validateOrderPayload({
    order_type: 'DINE_IN',
    table_number: '4',
    items: [
      { item_name: 'Veg Momos', quantity: 2 },
      { item_name: 'veg momos', quantity: 1 },
      { item_name: 'Cold Drink', quantity: 1 }
    ]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    order_type: 'DINE_IN',
    table_number: '4',
    items: [
      { item_name: 'Veg Momos', portion: 'Full', quantity: 3, unit_price: 0, total_price: 0, order_type: 'DINE_IN' },
      { item_name: 'Cold Drink', portion: 'Full', quantity: 1, unit_price: 0, total_price: 0, order_type: 'DINE_IN' }
    ]
  });
});

test('requires table number for dine-in orders', () => {
  const result = validateOrderPayload({
    order_type: 'DINE_IN',
    table_number: '',
    items: [{ item_name: 'Pizza', quantity: 1 }]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /table_number/);
});

test('accepts only supported statuses', () => {
  assert.equal(validateStatus('READY'), true);
  assert.equal(validateStatus('CANCELLED'), false);
});
