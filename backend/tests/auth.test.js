import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/database/db.js';
import { verifyPassword, hashPassword } from '../src/utils/crypto.js';

test('Password utilities correctly hash and verify', () => {
  const password = 'mySecretPassword';
  const hashed = hashPassword(password);
  
  assert.notEqual(hashed, password);
  assert.equal(verifyPassword(password, hashed), true);
  assert.equal(verifyPassword('wrongPassword', hashed), false);
});

test('Seeded users table exists with correct default entries', () => {
  const users = db.prepare("SELECT * FROM users").all();
  
  assert.ok(users.length >= 4);
  
  const admin = users.find(u => u.role === 'admin');
  assert.equal(admin.username, 'Mayur@NGPtaste');
  assert.equal(verifyPassword('Mayur@8432029195', admin.password_hash), true);

  const cashier = users.find(u => u.role === 'cashier');
  assert.equal(cashier.username, 'cashier_user');
  assert.equal(verifyPassword('cashier_pass', cashier.password_hash), true);

  const kitchen = users.find(u => u.role === 'kitchen');
  assert.equal(kitchen.username, 'kitchen_user');
  assert.equal(verifyPassword('kitchen_pass', kitchen.password_hash), true);

  const display = users.find(u => u.role === 'display');
  assert.equal(display.username, 'display_user');
  assert.equal(verifyPassword('display_pass', display.password_hash), true);
});

test('Database rejects invalid roles via CHECK constraint', () => {
  assert.throws(() => {
    db.prepare(`
      INSERT INTO users (name, username, password_hash, role)
      VALUES ('Test', 'testuser', 'somehash', 'invalid_role')
    `).run();
  });
});
