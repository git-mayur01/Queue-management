import { useEffect, useState, useMemo } from 'react';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { api } from '../services/api.js';
import { createSocket } from '../services/socket.js';

const CATEGORIES = ['NOODLES', 'RICE', 'BURGERS', 'SHAKES', 'FRIES', 'MOMOS', 'MANCHURIAN', 'OTHERS'];

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Form states for creating a new item
  const [newName, setNewName] = useState('');
  const [newHalfPrice, setNewHalfPrice] = useState('');
  const [newFullPrice, setNewFullPrice] = useState('');
  const [newAvailable, setNewAvailable] = useState(true);
  const [newCategory, setNewCategory] = useState('OTHERS');

  useEffect(() => {
    // Load initial menu
    api.getMenu()
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('menu:updated', (newMenu) => {
      setItems(newMenu);
    });

    return () => socket.disconnect();
  }, []);

  // Group menu items dynamically by category
  const groupedItems = useMemo(() => {
    const groups = {};
    items.forEach(item => {
      const cat = item.category || 'OTHERS';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [items]);

  async function handleSave(updatedItems) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.saveMenu(updatedItems);
      setItems(res.items);
      setSuccess('Menu saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(itemName, field, value) {
    const updated = items.map((item) => {
      if (item.name !== itemName) return item;
      return { ...item, [field]: value };
    });
    setItems(updated);
  }

  function handleToggleAvailable(itemName) {
    const updated = items.map((item) => {
      if (item.name !== itemName) return item;
      return { ...item, available: !item.available };
    });
    handleSave(updated);
  }

  function handleRemoveItem(itemName) {
    const updated = items.filter((item) => item.name !== itemName);
    handleSave(updated);
  }

  async function handleAddItem(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setError('Item name is required.');
      return;
    }

    if (items.some((item) => item.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError(`An item named "${trimmedName}" already exists.`);
      return;
    }

    const half = parseFloat(newHalfPrice) || 0;
    const full = parseFloat(newFullPrice) || 0;

    if (half < 0 || full < 0) {
      setError('Prices cannot be negative.');
      return;
    }

    const newItem = {
      name: trimmedName,
      halfPrice: half,
      fullPrice: full,
      available: newAvailable,
      category: newCategory
    };

    const updated = [...items, newItem];
    setSaving(true);
    try {
      const res = await api.saveMenu(updated);
      setItems(res.items);
      setSuccess(`"${trimmedName}" added successfully!`);
      // Reset form
      setNewName('');
      setNewHalfPrice('');
      setNewFullPrice('');
      setNewAvailable(true);
      setNewCategory('OTHERS');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page menu-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Store Configuration</p>
          <h1>Menu Manager</h1>
        </div>
        <ConnectionBadge connected={connected} />
      </div>

      <ErrorMessage message={error} />
      {success && <div className="success-badge">{success}</div>}

      <div className="menu-manager-layout">
        {/* Current Items List */}
        <section className="panel menu-list-panel">
          <div className="section-title-row">
            <h2>Active Menu Items ({items.length})</h2>
            <p>Define pricing for plate portions and manage live stock availability.</p>
          </div>

          {items.length === 0 ? (
            <p className="empty-state">No menu items found. Add your first item below.</p>
          ) : (
            Object.entries(groupedItems).map(([categoryName, catItems]) => (
              <div key={categoryName} style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ background: 'var(--ink)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.75rem', display: 'inline-block', fontSize: '0.85rem', fontWeight: 900, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📂 {categoryName}
                </h3>
                <div className="menu-table-container">
                  <table className="menu-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Half Price</th>
                        <th>Full Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item) => (
                        <tr key={item.name} className={item.available ? '' : 'row-unavailable'}>
                          <td className="cell-name">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleFieldChange(item.name, 'name', e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              value={item.category || 'OTHERS'}
                              onChange={(e) => handleFieldChange(item.name, 'category', e.target.value)}
                              style={{ padding: '0.4rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: '800', background: 'white' }}
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>
                          <td className="cell-price">
                            <div className="price-input-wrapper">
                              <span>₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.halfPrice || ''}
                                placeholder="0"
                                onChange={(e) => handleFieldChange(item.name, 'halfPrice', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </td>
                          <td className="cell-price">
                            <div className="price-input-wrapper">
                              <span>₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.fullPrice || ''}
                                placeholder="0"
                                onChange={(e) => handleFieldChange(item.name, 'fullPrice', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`btn-toggle ${item.available ? 'active' : 'inactive'}`}
                              onClick={() => handleToggleAvailable(item.name)}
                            >
                              {item.available ? 'Available' : 'Out of Stock'}
                            </button>
                          </td>
                          <td>
                            <div className="action-row">
                              <button
                                type="button"
                                className="btn-save-inline"
                                disabled={saving}
                                onClick={() => handleSave(items)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn-delete"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to remove ${item.name}?`)) {
                                    handleRemoveItem(item.name);
                                  }
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {items.length > 0 && (
            <button
              type="button"
              className="primary-action btn-save-all"
              disabled={saving}
              onClick={() => handleSave(items)}
            >
              {saving ? 'Saving changes...' : 'Save All Pricing Changes'}
            </button>
          )}
        </section>

        {/* Add New Item Panel */}
        <section className="panel add-item-panel">
          <h2>Add New Dish</h2>
          <form onSubmit={handleAddItem} className="add-dish-form">
            <label className="field-label">
              Dish Name
              <input
                type="text"
                placeholder="e.g. Schezwan Noodles"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </label>

            <label className="field-label">
              Category
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '1rem', border: '1px solid var(--line)', fontWeight: '800', background: 'white', display: 'block', outline: 'none' }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>

            <div className="form-row-pricing">
              <label className="field-label">
                Half Plate Price (₹)
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 60"
                  value={newHalfPrice}
                  onChange={(e) => setNewHalfPrice(e.target.value)}
                />
              </label>

              <label className="field-label">
                Full Plate Price (₹)
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 100"
                  value={newFullPrice}
                  onChange={(e) => setNewFullPrice(e.target.value)}
                />
              </label>
            </div>

            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                id="newAvailable"
                checked={newAvailable}
                onChange={(e) => setNewAvailable(e.target.checked)}
              />
              <label htmlFor="newAvailable">Mark as instantly available</label>
            </div>

            <button type="submit" className="primary-action btn-add-dish" disabled={saving}>
              {saving ? 'Adding...' : 'Add Dish to Menu'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
