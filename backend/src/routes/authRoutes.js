import { Router } from 'express';
import { db } from '../database/db.js';
import { verifyPassword, hashPassword } from '../utils/crypto.js';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => {
  try {
    const { role, username, password } = req.body;

    if (!role || !username || !password) {
      return res.status(400).json({ message: 'Role, username, and password are required.' });
    }

    const normalizedRole = role.toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND role = ?").get(username, normalizedRole);

    if (!user) {
      return res.status(401).json({ message: 'Username not found for selected role.' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    // Success
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET users: returns current configuration of Cashier, Kitchen, and Display roles
authRouter.get('/users', (req, res, next) => {
  try {
    const usersList = db.prepare("SELECT role, username FROM users WHERE role IN ('cashier', 'kitchen', 'display')").all();
    
    const usersMap = {};
    for (const u of usersList) {
      usersMap[u.role] = { username: u.username };
    }

    return res.json(usersMap);
  } catch (error) {
    next(error);
  }
});

// PUT users: updates configuration of Cashier, Kitchen, and Display roles
authRouter.put('/users', (req, res, next) => {
  try {
    const { cashier, kitchen, display } = req.body;

    if (!cashier || !kitchen || !display) {
      return res.status(400).json({ message: 'Cashier, kitchen, and display configuration are required.' });
    }

    db.transaction(() => {
      const updateWithPassword = db.prepare("UPDATE users SET username = ?, password_hash = ? WHERE role = ?");
      const updateWithoutPassword = db.prepare("UPDATE users SET username = ? WHERE role = ?");

      const roles = { cashier, kitchen, display };
      for (const [roleName, config] of Object.entries(roles)) {
        if (!config.username || !config.username.trim()) {
          throw new Error(`Username for ${roleName} cannot be empty.`);
        }

        if (config.password && config.password.trim()) {
          updateWithPassword.run(config.username.trim(), hashPassword(config.password), roleName);
        } else {
          updateWithoutPassword.run(config.username.trim(), roleName);
        }
      }
    })();

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to update credentials.' });
  }
});
