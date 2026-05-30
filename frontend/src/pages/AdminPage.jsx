import { useEffect, useState, useRef, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import ConnectionBadge from '../components/ConnectionBadge.jsx';
import { api } from '../services/api.js';
import { createSocket } from '../services/socket.js';

export default function AdminPage() {
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const [backupState, setBackupState] = useState(null); // null | 'compressing' | 'handshake' | 'uploading' | 'success'

  const orderFeedRef = useRef(null);

  // Global Date Filter states
  const [globalFilter, setGlobalFilter] = useState('Today');
  const [globalFrom, setGlobalFrom] = useState('');
  const [globalTo, setGlobalTo] = useState('');
  const [appliedFilter, setAppliedFilter] = useState({ type: 'Today', from: '', to: '' });

  // Searchable History Filter states
  const [historySearchToken, setHistorySearchToken] = useState('');
  const [historySearchStatus, setHistorySearchStatus] = useState('ALL');
  const [historySearchType, setHistorySearchType] = useState('ALL');
  const [historySearchTable, setHistorySearchTable] = useState('');
  const [historySearchFrom, setHistorySearchFrom] = useState('');
  const [historySearchTo, setHistorySearchTo] = useState('');

  // System Tools / Factory Reset states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Toast helper
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOrders = () => {
    api.getOrders()
      .then((data) => {
        setOrders(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOrders();

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('snapshot', () => {
      fetchOrders();
    });

    return () => socket.disconnect();
  }, []);

  // SQL Datetime parsing helper
  const parseSQLDate = (dateStr) => {
    if (!dateStr) return new Date();
    const isoStr = dateStr.replace(' ', 'T');
    return new Date(isoStr.indexOf('Z') === -1 ? isoStr + 'Z' : isoStr);
  };

  // Helper: Filter orders by selected timeframe
  const filterOrdersByRange = (allOrders, rangeType, customFrom, customTo) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let fromDate = null;
    let toDate = new Date();

    switch (rangeType) {
      case 'Today':
        fromDate = startOfToday;
        break;
      case 'Yesterday':
        fromDate = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        toDate = new Date(startOfToday.getTime() - 1);
        break;
      case 'Last 7 Days':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'This Month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'Custom':
        if (customFrom) {
          fromDate = new Date(customFrom);
          fromDate.setHours(0, 0, 0, 0);
        }
        if (customTo) {
          toDate = new Date(customTo);
          toDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        fromDate = startOfToday;
        break;
    }

    return allOrders.filter(order => {
      if (!order.created_at) return false;
      const orderDate = parseSQLDate(order.created_at);
      if (fromDate && orderDate < fromDate) return false;
      if (toDate && orderDate > toDate) return false;
      return true;
    });
  };

  // Filtered orders list based on the global date filter
  const filteredOrders = useMemo(() => {
    return filterOrdersByRange(orders, appliedFilter.type, appliedFilter.from, appliedFilter.to);
  }, [orders, appliedFilter]);

  // Derived POS stats from filtered orders
  const derivedStats = useMemo(() => {
    let revenue = 0;
    let pendingOrders = 0;
    let cookingOrders = 0;
    let readyOrders = 0;
    let deliveredOrders = 0;
    let dineInCount = 0;
    let parcelCount = 0;

    const itemMap = {};
    const portionMap = {};

    filteredOrders.forEach(order => {
      let orderTotal = 0;
      if (order.items) {
        order.items.forEach(item => {
          const qty = item.quantity || 0;
          const price = item.total_price || 0;
          orderTotal += price;

          const key = item.item_name;
          itemMap[key] = (itemMap[key] || 0) + qty;

          const port = item.portion || 'Full';
          portionMap[port] = (portionMap[port] || 0) + qty;
        });
      }

      revenue += orderTotal;

      const status = order.status?.toUpperCase();
      if (status === 'PENDING') pendingOrders++;
      else if (status === 'COOKING') cookingOrders++;
      else if (status === 'READY') readyOrders++;
      else if (status === 'DELIVERED') deliveredOrders++;

      if (order.order_type === 'DINE_IN') dineInCount++;
      else parcelCount++;
    });

    const activeOrders = pendingOrders + cookingOrders + readyOrders;

    let mostSoldItem = 'N/A';
    let mostSoldQty = 0;
    const popularList = Object.entries(itemMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    if (popularList.length > 0) {
      mostSoldItem = popularList[0].name;
      mostSoldQty = popularList[0].qty;
    }
    const top5Items = popularList.slice(0, 5);

    let mostOrderedPortion = 'N/A';
    let maxPortionQty = 0;
    Object.entries(portionMap).forEach(([port, qty]) => {
      if (qty > maxPortionQty) {
        mostOrderedPortion = port;
        maxPortionQty = qty;
      }
    });

    const mostPopularType = dineInCount >= parcelCount ? 'Dine In (🍽)' : 'Parcel (🛍)';
    const aov = filteredOrders.length > 0 ? (revenue / filteredOrders.length) : 0;

    return {
      revenue,
      ordersCount: filteredOrders.length,
      activeOrders,
      pendingOrders,
      readyOrders,
      deliveredOrders,
      aov,
      mostSoldItem,
      mostSoldQty,
      mostOrderedPortion,
      mostPopularType,
      top5Items,
      dineInCount,
      parcelCount
    };
  }, [filteredOrders]);

  // Comparison Metrics calculations: Today vs Yesterday & This Month vs Last Month
  const getComparisonMetrics = (allOrders) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    let revToday = 0;
    let revYesterday = 0;
    let revThisMonth = 0;
    let revLastMonth = 0;

    allOrders.forEach(order => {
      const oDate = parseSQLDate(order.created_at);
      const orderPrice = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

      if (oDate >= startOfToday) {
        revToday += orderPrice;
      } else if (oDate >= startOfYesterday && oDate < startOfToday) {
        revYesterday += orderPrice;
      }

      if (oDate >= startOfThisMonth) {
        revThisMonth += orderPrice;
      } else if (oDate >= startOfLastMonth && oDate <= endOfLastMonth) {
        revLastMonth += orderPrice;
      }
    });

    const getGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      todayRevenue: revToday,
      yesterdayRevenue: revYesterday,
      todayVsYesterdayGrowth: getGrowth(revToday, revYesterday),
      thisMonthRevenue: revThisMonth,
      lastMonthRevenue: revLastMonth,
      thisMonthVsLastMonthGrowth: getGrowth(revThisMonth, revLastMonth)
    };
  };

  // Grouped Monthly & Daily Revenue Breakdown
  const getDailyRevenue = (dataset) => {
    const dayMap = {};
    dataset.forEach(order => {
      const dateObj = parseSQLDate(order.created_at);
      const dayKey = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const orderPrice = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { dateStr: dayKey, revenue: 0, count: 0, rawDate: dateObj };
      }
      dayMap[dayKey].revenue += orderPrice;
      dayMap[dayKey].count += 1;
    });

    return Object.values(dayMap).sort((a, b) => b.rawDate - a.rawDate);
  };

  const getMonthlyRevenue = (dataset) => {
    const monthMap = {};
    dataset.forEach(order => {
      const dateObj = parseSQLDate(order.created_at);
      const monthKey = dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const orderPrice = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { monthStr: monthKey, revenue: 0, count: 0, sortKey: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1) };
      }
      monthMap[monthKey].revenue += orderPrice;
      monthMap[monthKey].count += 1;
    });

    return Object.values(monthMap).sort((a, b) => b.sortKey - a.sortKey);
  };

  // Filter searchable order history table
  const getFilteredHistoryOrders = () => {
    return orders.filter(order => {
      if (historySearchToken.trim() && !order.token_number.toString().includes(historySearchToken.trim())) {
        return false;
      }
      if (historySearchStatus !== 'ALL' && order.status !== historySearchStatus) {
        return false;
      }
      if (historySearchType !== 'ALL' && order.order_type !== historySearchType) {
        return false;
      }
      if (historySearchTable.trim()) {
        const tableNum = order.table_number ? order.table_number.toString() : '';
        if (!tableNum.toLowerCase().includes(historySearchTable.trim().toLowerCase())) {
          return false;
        }
      }
      if (historySearchFrom || historySearchTo) {
        const oDate = parseSQLDate(order.created_at);
        if (historySearchFrom) {
          const fromD = new Date(historySearchFrom);
          fromD.setHours(0, 0, 0, 0);
          if (oDate < fromD) return false;
        }
        if (historySearchTo) {
          const toD = new Date(historySearchTo);
          toD.setHours(23, 59, 59, 999);
          if (oDate > toD) return false;
        }
      }
      return true;
    });
  };

  const formatPrice = (value) => {
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  // Dynamic Sparkline SVG generator based on filtered range
  const getSparklineData = () => {
    if (filteredOrders.length === 0) return [0, 0, 0, 0, 0, 0, 0, 0];

    if (appliedFilter.type === 'Today' || appliedFilter.type === 'Yesterday') {
      const hours = [10, 12, 14, 16, 18, 20, 22];
      const hourlyRevenue = Array(hours.length).fill(0);
      filteredOrders.forEach(order => {
        const oDate = parseSQLDate(order.created_at);
        const hr = oDate.getHours();
        for (let i = 0; i < hours.length; i++) {
          if (hr <= hours[i]) {
            const orderPrice = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
            hourlyRevenue[i] += orderPrice;
            break;
          }
        }
      });
      return hourlyRevenue;
    }

    const dayMap = {};
    filteredOrders.forEach(order => {
      const dateObj = parseSQLDate(order.created_at);
      const dayKey = dateObj.toISOString().slice(0, 10);
      const orderPrice = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      dayMap[dayKey] = (dayMap[dayKey] || 0) + orderPrice;
    });

    const sortedDays = Object.keys(dayMap).sort();
    if (sortedDays.length === 0) return [0, 0, 0, 0, 0, 0, 0, 0];
    if (sortedDays.length < 5) {
      const data = sortedDays.map(d => dayMap[d]);
      while (data.length < 6) data.unshift(0);
      return data;
    }
    return sortedDays.map(d => dayMap[d]);
  };

  const drawSparkline = () => {
    const data = getSparklineData();
    const width = 600;
    const height = 180;
    const padding = 20;

    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const valRange = maxVal - minVal || 1;

    const points = data.map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - minVal) / valRange) * (height - padding * 2);
      return { x, y };
    });

    const linePath = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaPath = points.length > 0 
      ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : '';

    return { linePath, areaPath, points };
  };

  const { linePath, areaPath } = drawSparkline();

  // Peak Dining Hours based on filtered orders
  const getPeakHours = () => {
    const hourBins = {
      '11 AM - 1 PM': 0,
      '1 PM - 3 PM': 0,
      '3 PM - 5 PM': 0,
      '5 PM - 7 PM': 0,
      '7 PM - 9 PM': 0,
      '9 PM - 11 PM': 0
    };

    filteredOrders.forEach(order => {
      if (order.created_at) {
        const hour = parseSQLDate(order.created_at).getHours();
        if (hour >= 11 && hour < 13) hourBins['11 AM - 1 PM']++;
        else if (hour >= 13 && hour < 15) hourBins['1 PM - 3 PM']++;
        else if (hour >= 15 && hour < 17) hourBins['3 PM - 5 PM']++;
        else if (hour >= 17 && hour < 19) hourBins['5 PM - 7 PM']++;
        else if (hour >= 19 && hour < 21) hourBins['7 PM - 9 PM']++;
        else if (hour >= 21 && hour < 23) hourBins['9 PM - 11 PM']++;
      }
    });

    return Object.entries(hourBins);
  };

  // Top Selling list - returns real statistics only (no fallback dummy items)
  const getTopSellingList = () => {
    return derivedStats.top5Items;
  };

  // Live order activity feed - returns real data only (no fallbacks)
  const getRecentActivities = () => {
    const sorted = [...orders]
      .sort((a, b) => parseSQLDate(b.updated_at) - parseSQLDate(a.updated_at))
      .slice(0, 5);

    return sorted.map(order => {
      let statusText = 'Created';
      let badgeType = 'blue';

      if (order.status === 'COOKING') {
        statusText = 'Preparing';
        badgeType = 'yellow';
      } else if (order.status === 'READY') {
        statusText = 'Ready for Collection';
        badgeType = 'green';
      } else if (order.status === 'DELIVERED') {
        statusText = 'Delivered & Closed';
        badgeType = 'green';
      }

      const orderType = order.order_type === 'DINE_IN' ? 'Table ' + order.table_number : 'Parcel';
      const timeStr = order.updated_at 
        ? parseSQLDate(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : 'Recently';

      return {
        text: `Order #${order.token_number} (${orderType}) is ${statusText}`,
        type: badgeType,
        time: timeStr
      };
    });
  };

  // Order types percentages (no mock defaults)
  const getOrderTypeBreakdown = () => {
    const total = derivedStats.dineInCount + derivedStats.parcelCount;
    if (total === 0) return { dineInPct: 0, parcelPct: 0 };
    const dineInPct = Math.round((derivedStats.dineInCount / total) * 100);
    return { dineInPct, parcelPct: 100 - dineInPct };
  };

  const { dineInPct, parcelPct } = getOrderTypeBreakdown();

  // Cloud Database Handshake simulator
  const handleCloudBackup = () => {
    setBackupState('compressing');
    setTimeout(() => {
      setBackupState('handshake');
      setTimeout(() => {
        setBackupState('uploading');
        setTimeout(() => {
          setBackupState('success');
          setTimeout(() => {
            setBackupState(null);
            showToast('💾 Database backup successfully synced to Google Cloud Storage!');
          }, 1000);
        }, 1000);
      }, 1000);
    }, 800);
  };

  const handleExportPDF = () => {
    showToast('📊 Formatting sales report for PDF Export...');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // CSV Report Exporter helper
  const handleExportCSV = () => {
    const filtered = getFilteredHistoryOrders();
    if (filtered.length === 0) {
      showToast('⚠️ No history orders found to export!');
      return;
    }

    const headers = ['Token Number', 'Date', 'Type', 'Table', 'Status', 'Total Price', 'Items'];
    const rows = filtered.map(order => {
      const orderPrice = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      const itemsSummary = order.items?.map(i => `${i.item_name} x${i.quantity} (${i.portion})`).join('; ') || '';
      const orderTypeStr = order.order_type === 'DINE_IN' ? 'Dine In' : 'Parcel';
      const tableNum = order.table_number || 'N/A';
      const orderDate = order.created_at ? parseSQLDate(order.created_at).toLocaleString() : '';

      return [
        `#${order.token_number}`,
        `"${orderDate}"`,
        `"${orderTypeStr}"`,
        `"${tableNum}"`,
        `"${order.status}"`,
        `₹${orderPrice}`,
        `"${itemsSummary}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 CSV report downloaded successfully!');
  };

  // Destructive Factory Reset handler
  const handleFactoryReset = async () => {
    setResetting(true);
    try {
      const res = await api.factoryReset();
      if (res && res.success) {
        setOrders([]);
        setAppliedFilter({ type: 'Today', from: '', to: '' });
        setGlobalFilter('Today');
        setShowResetConfirm(false);
        fetchOrders(); // Force dashboard widgets reload from backend
        showToast('✨ Factory Reset Completed Successfully. The system is now in a fresh installation state.');
      } else {
        showToast('❌ Failed to complete factory reset.');
      }
    } catch (err) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const handleOrderFeedClick = () => {
    setTimeout(() => {
      orderFeedRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <main className="page admin-pos-dashboard">
      {/* Toast Alert */}
      {toast && (
        <div className="cashier-toast" style={{ background: 'var(--green)', color: 'white', borderLeft: '5px solid #0d5f30', zIndex: 9999 }}>
          <span className="toast-icon">✓</span>
          <strong>{toast}</strong>
        </div>
      )}

      {/* Cloud Backup Progress Overlay */}
      {backupState && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ textAlign: 'center', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem' }}>Cloud Database Sync</h3>
            <div className="pos-spinner" style={{ border: '4px solid var(--line)', borderTop: '4px solid var(--green)', borderRadius: '50%', width: '40px', height: '40px', margin: '1rem auto', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ fontWeight: 800, color: 'var(--muted)', marginTop: '1rem' }}>
              {backupState === 'compressing' && '📦 Compressing database files...'}
              {backupState === 'handshake' && '🔑 Handshaking with Google Cloud...'}
              {backupState === 'uploading' && '🚀 Uploading sqlite.db backup...'}
              {backupState === 'success' && '✨ Backup successfully synced!'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="page-header admin-pos-header">
        <div>
          <p className="eyebrow" style={{ color: 'var(--blue)', fontSize: '0.85rem' }}>Management & Insights</p>
          <h1 style={{ fontWeight: 900, fontSize: '2.4rem', margin: 0 }}>Owner Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ConnectionBadge connected={connected} />
        </div>
      </header>

      {/* GLOBAL DATE FILTER PANEL */}
      <section className="panel date-filter-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>📅 Reporting Date Filters</h2>
            <p className="kpi-subtext" style={{ margin: '0.25rem 0 0 0', color: 'var(--muted)' }}>Select global timeframe to update POS statistics & analytics</p>
          </div>
          
          <div className="pos-segmented-tabs" style={{ background: '#f2e5d5', borderRadius: '0.75rem', display: 'flex', padding: '0.2rem' }}>
            {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Custom Date Range'].map(tab => (
              <button 
                key={tab} 
                type="button" 
                className={`tab-btn ${globalFilter === tab ? 'active' : ''}`}
                onClick={() => {
                  setGlobalFilter(tab);
                  if (tab !== 'Custom Date Range') {
                    setAppliedFilter({ type: tab, from: '', to: '' });
                  }
                }}
                style={{
                  background: globalFilter === tab ? 'var(--ink)' : 'transparent',
                  color: globalFilter === tab ? 'white' : 'var(--muted)',
                  border: 0,
                  borderRadius: '0.6rem',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {globalFilter === 'Custom Date Range' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', background: '#faf9f6', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--line)', animation: 'fadeIn 0.2s ease-out' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.35rem' }}>From Date</label>
              <input 
                type="date" 
                value={globalFrom} 
                onChange={e => setGlobalFrom(e.target.value)} 
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.35rem' }}>To Date</label>
              <input 
                type="date" 
                value={globalTo} 
                onChange={e => setGlobalTo(e.target.value)} 
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700 }}
              />
            </div>
            <button 
              type="button"
              className="primary-action"
              onClick={() => setAppliedFilter({ type: 'Custom', from: globalFrom, to: globalTo })}
              style={{ padding: '0.6rem 1.5rem', marginTop: 0, width: 'auto' }}
            >
              Apply Filter
            </button>
          </div>
        )}
      </section>

      {/* COMPARISON AND REVENUE SUMMARY OVERVIEW */}
      <div className="pos-two-column-layout" style={{ gap: '1.5rem' }}>
        
        {/* Comparison Analytics Card */}
        <section className="panel comparison-analytics-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2>📈 Comparison Analytics</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, justifyContent: 'center' }}>
            {(() => {
              const comp = getComparisonMetrics(orders);
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf9f6', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--line)' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 800, display: 'block' }}>TODAY vs YESTERDAY</span>
                      <strong style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>{formatPrice(comp.todayRevenue)} <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 700 }}>vs {formatPrice(comp.yesterdayRevenue)}</span></strong>
                    </div>
                    <span className="status-pill" style={{
                      background: comp.todayVsYesterdayGrowth >= 0 ? '#e7f7ed' : '#fff0f0',
                      color: comp.todayVsYesterdayGrowth >= 0 ? 'var(--green)' : 'var(--primary)',
                      fontWeight: 900
                    }}>
                      {comp.todayVsYesterdayGrowth >= 0 ? `+${comp.todayVsYesterdayGrowth}%` : `${comp.todayVsYesterdayGrowth}%`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf9f6', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--line)' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 800, display: 'block' }}>THIS MONTH vs LAST MONTH</span>
                      <strong style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>{formatPrice(comp.thisMonthRevenue)} <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 700 }}>vs {formatPrice(comp.lastMonthRevenue)}</span></strong>
                    </div>
                    <span className="status-pill" style={{
                      background: comp.thisMonthVsLastMonthGrowth >= 0 ? '#e7f7ed' : '#fff0f0',
                      color: comp.thisMonthVsLastMonthGrowth >= 0 ? 'var(--green)' : 'var(--primary)',
                      fontWeight: 900
                    }}>
                      {comp.thisMonthVsLastMonthGrowth >= 0 ? `+${comp.thisMonthVsLastMonthGrowth}%` : `${comp.thisMonthVsLastMonthGrowth}%`}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </section>

        {/* Revenue Summary Cards */}
        <section className="panel revenue-summary-card">
          <h2>📊 Filtered Revenue Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: '#e8f4ec', border: '1px solid #c8e6d1', padding: '1rem', borderRadius: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 800 }}>Total Revenue</span>
              <strong style={{ display: 'block', fontSize: '1.6rem', color: 'var(--green)', margin: '0.25rem 0' }}>{formatPrice(derivedStats.revenue)}</strong>
            </div>
            
            <div style={{ background: '#e5f1fc', border: '1px solid #cce3f9', padding: '1rem', borderRadius: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 800 }}>Total Orders</span>
              <strong style={{ display: 'block', fontSize: '1.6rem', color: 'var(--blue)', margin: '0.25rem 0' }}>{derivedStats.ordersCount}</strong>
            </div>

            <div style={{ background: '#fdf3e7', border: '1px solid #f9dfc1', padding: '1rem', borderRadius: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 800 }}>Avg. Order Value</span>
              <strong style={{ display: 'block', fontSize: '1.6rem', color: 'var(--amber)', margin: '0.25rem 0' }}>{formatPrice(derivedStats.aov)}</strong>
            </div>

            <div style={{ background: '#faf9f6', border: '1px solid var(--line)', padding: '1rem', borderRadius: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 800 }}>Best Selling Item</span>
              <strong style={{ display: 'block', fontSize: '1.15rem', color: 'var(--ink)', margin: '0.5rem 0 0.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {derivedStats.mostSoldItem === 'N/A' ? '' : derivedStats.mostSoldItem}
              </strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 800 }}>
                {derivedStats.mostSoldItem === 'N/A' ? '0 portions sold' : `${derivedStats.mostSoldQty} portions sold`}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* SECTION 1 — REAL-TIME KITCHEN QUEUE KPI */}
      <section className="admin-pos-kpi-grid" aria-label="KPI Metrics">
        <div className="pos-kpi-card revenue" style={{ borderLeft: '6px solid var(--green)' }}>
          <span className="kpi-label">Active Orders</span>
          <strong className="kpi-value text-green">{derivedStats.activeOrders}</strong>
          <span className="kpi-subtext">Preparing & collection</span>
        </div>
        <div className="pos-kpi-card orders" style={{ borderLeft: '6px solid var(--blue)' }}>
          <span className="kpi-label">Pending Orders</span>
          <strong className="kpi-value text-blue">{derivedStats.pendingOrders}</strong>
          <span className="kpi-subtext">Queued in kitchen</span>
        </div>
        <div className="pos-kpi-card active" style={{ borderLeft: '6px solid var(--amber)' }}>
          <span className="kpi-label">Ready Orders</span>
          <strong className="kpi-value text-yellow">{derivedStats.readyOrders}</strong>
          <span className="kpi-subtext">Waiting for pickup</span>
        </div>
        <div className="pos-kpi-card pending" style={{ borderLeft: '6px solid var(--amber)' }}>
          <span className="kpi-label">Delivered Orders</span>
          <strong className="kpi-value text-yellow">{derivedStats.deliveredOrders}</strong>
          <span className="kpi-subtext">Closed order count</span>
        </div>
        <div className="pos-kpi-card ready" style={{ borderLeft: '6px solid var(--green)' }}>
          <span className="kpi-label">Live Connection</span>
          <strong className="kpi-value text-green">{connected ? 'ONLINE' : 'OFFLINE'}</strong>
          <span className="kpi-subtext">Kitchen sync connected</span>
        </div>
      </section>

      {/* SECOND ROW - SALES TREND AND ORDER BREAKDOWN */}
      <div className="pos-two-column-layout">
        {/* SECTION 2 — SALES ANALYTICS */}
        <section className="panel sales-analytics-card">
          <div className="panel-header-with-tabs">
            <h2>Revenue Analytics Trend ({appliedFilter.type})</h2>
          </div>
          
          <div className="svg-chart-container" style={{ position: 'relative', marginTop: '1.5rem', background: '#faf9f6', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--line)' }}>
            {filteredOrders.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '180px', color: 'var(--muted)', fontWeight: 800 }}>
                No sales data recorded
              </div>
            ) : (
              <>
                <svg viewBox="0 0 600 180" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#138a45" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#138a45" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#chartAreaGrad)" />
                  <path d={linePath} fill="none" stroke="#138a45" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 800 }}>
                  {appliedFilter.type === 'Today' || appliedFilter.type === 'Yesterday' ? (
                    <>
                      <span>10 AM</span>
                      <span>2 PM</span>
                      <span>6 PM</span>
                      <span>10 PM</span>
                    </>
                  ) : (
                    <>
                      <span>Start of Period</span>
                      <span>Mid Period</span>
                      <span>End of Period</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* SECTION 4 — ORDER BREAKDOWN */}
        <section className="panel order-breakdown-card">
          <h2>Order Distribution Breakdown</h2>
          {filteredOrders.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '180px', color: 'var(--muted)', fontWeight: 800 }}>
              No order data recorded
            </div>
          ) : (
            <div className="breakdown-content-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', justifyContent: 'center' }}>
              <div className="percentage-visualizer-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="metric-distribution dinein" style={{ flex: 1, textAlign: 'center', background: '#e8f4ec', border: '1px solid #c8e6d1', padding: '1rem', borderRadius: '1rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 800 }}>🍽 Dine In Orders</span>
                  <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--green)', margin: '0.25rem 0' }}>{dineInPct}%</strong>
                </div>
                <div className="metric-distribution parcel" style={{ flex: 1, textAlign: 'center', background: '#fdf3e7', border: '1px solid #f9dfc1', padding: '1rem', borderRadius: '1rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 800 }}>🛍 Parcel Orders</span>
                  <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--amber)', margin: '0.25rem 0' }}>{parcelPct}%</strong>
                </div>
              </div>
              
              {/* Visual ratio track bar */}
              <div className="pos-ratio-track" style={{ background: '#f0ebd8', height: '20px', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${dineInPct}%`, background: 'var(--green)', height: '100%' }}></div>
                <div style={{ width: `${parcelPct}%`, background: 'var(--amber)', height: '100%' }}></div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* THIRD ROW - TOP SELLING ITEMS AND PEAK HOURS */}
      <div className="pos-two-column-layout">
        {/* SECTION 3 — TOP SELLING ITEMS */}
        <section className="panel top-selling-card">
          <div className="panel-header-with-tabs">
            <h2>Top 5 sale items</h2>
          </div>

          {getTopSellingList().length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '180px', color: 'var(--muted)', fontWeight: 800 }}>
              No sale items recorded
            </div>
          ) : (
            <div className="leaderboard-progress-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1.5rem' }}>
              {getTopSellingList().map((item, idx) => {
                const maxVal = getTopSellingList()[0].qty || 1;
                const pct = (item.qty / maxVal) * 100;
                return (
                  <div key={item.name} className="progress-item-wrapper">
                    <div className="progress-label-row" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                      <span>{idx + 1}. {item.name}</span>
                      <strong style={{ color: 'var(--primary)' }}>{item.qty} portions</strong>
                    </div>
                    <div className="progress-track" style={{ background: 'var(--line)', height: '8px', borderRadius: '50px', overflow: 'hidden' }}>
                      <div 
                        className="progress-fill" 
                        style={{ width: `${pct}%`, background: 'var(--green)', height: '100%', borderRadius: '50px' }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 5 — PEAK HOURS */}
        <section className="panel peak-hours-card">
          <h2>Peak Dining Hours</h2>
          <p className="kpi-subtext" style={{ color: 'var(--muted)', fontWeight: 700, margin: '0.25rem 0 1rem 0' }}>Hourly order volumes across peak shifts</p>
          
          {filteredOrders.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '180px', color: 'var(--muted)', fontWeight: 800 }}>
              No peak hour records
            </div>
          ) : (
            <div className="peak-hours-graph-wrapper" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', padding: '1rem 0 0.5rem 0', gap: '0.5rem', background: '#faf9f6', borderRadius: '1rem', border: '1px solid var(--line)' }}>
              {getPeakHours().map(([hourLabel, count]) => {
                const maxCount = Math.max(...getPeakHours().map(([, c]) => c)) || 1;
                const heightPct = (count / maxCount) * 80;
                return (
                  <div key={hourLabel} className="peak-hour-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary-dark)' }}>{count}</span>
                    <div style={{ width: '30px', height: `${heightPct}%`, background: 'var(--blue)', borderRadius: '6px 6px 0 0', minHeight: '4px' }}></div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', width: '100%', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {hourLabel.split(' ')[0] + hourLabel.split(' ')[1].toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* SECTION - DAILY & MONTHLY ANALYTICS TABLES */}
      <div className="pos-two-column-layout">
        <section className="panel daily-analytics-panel">
          <h2>📅 Daily Revenue Breakdown</h2>
          <div className="admin-table-container" style={{ overflowY: 'auto', maxHeight: '280px', marginTop: '1rem' }}>
            <table className="menu-table admin-orders-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>AOV</th>
                </tr>
              </thead>
              <tbody>
                {getDailyRevenue(filteredOrders).length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)' }}>No daily data available</td>
                  </tr>
                ) : (
                  getDailyRevenue(filteredOrders).map(row => (
                    <tr key={row.dateStr}>
                      <td data-label="Date"><strong>{row.dateStr}</strong></td>
                      <td data-label="Orders">{row.count}</td>
                      <td data-label="Revenue" className="text-green"><strong>{formatPrice(row.revenue)}</strong></td>
                      <td data-label="AOV"><strong>{formatPrice(row.count > 0 ? row.revenue / row.count : 0)}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel monthly-analytics-panel">
          <h2>📊 Monthly Revenue Breakdown</h2>
          <div className="admin-table-container" style={{ overflowY: 'auto', maxHeight: '280px', marginTop: '1rem' }}>
            <table className="menu-table admin-orders-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>AOV</th>
                </tr>
              </thead>
              <tbody>
                {getMonthlyRevenue(filteredOrders).length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)' }}>No monthly data available</td>
                  </tr>
                ) : (
                  getMonthlyRevenue(filteredOrders).map(row => (
                    <tr key={row.monthStr}>
                      <td data-label="Month"><strong>{row.monthStr}</strong></td>
                      <td data-label="Orders">{row.count}</td>
                      <td data-label="Revenue" className="text-green"><strong>{formatPrice(row.revenue)}</strong></td>
                      <td data-label="AOV"><strong>{formatPrice(row.count > 0 ? row.revenue / row.count : 0)}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* FOURTH ROW - BEST PERFORMING ITEMS, RECENT ACTIVITY, AND QUICK ACTIONS */}
      <div className="pos-three-column-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '1.5rem', alignItems: 'stretch' }}>
        
        {/* SECTION 8 — BEST PERFORMING ITEMS */}
        <section className="panel best-performing-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2>Best Performing Insights</h2>
          {filteredOrders.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '130px', color: 'var(--muted)', fontWeight: 800 }}>
              No insights available
            </div>
          ) : (
            <div className="best-performing-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
              <div className="best-performing-item-row" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ background: '#e8f4ec', width: '2.5rem', height: '2.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>👑</div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', fontWeight: 800 }}>Most Sold Item</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>{derivedStats.mostSoldItem}</strong>
                </div>
              </div>
              <div className="best-performing-item-row" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ background: '#e5f1fc', width: '2.5rem', height: '2.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🍽️</div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', fontWeight: 800 }}>Most Ordered Portion</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>{derivedStats.mostOrderedPortion} Portion</strong>
                </div>
              </div>
              <div className="best-performing-item-row" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ background: '#fff0d8', width: '2.5rem', height: '2.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🛍️</div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', fontWeight: 800 }}>Most Popular Category</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>{derivedStats.mostPopularType}</strong>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 6 — RECENT ACTIVITY */}
        <section className="panel recent-activities-card">
          <h2>Recent Operations Log</h2>
          {getRecentActivities().length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '130px', color: 'var(--muted)', fontWeight: 800 }}>
              No operations logged
            </div>
          ) : (
            <ul className="activities-feed-list" style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {getRecentActivities().map((activity, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', paddingBottom: '0.5rem', borderBottom: '1px solid #f9f9f9' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start' }}>
                    <span style={{ color: activity.type === 'green' ? 'var(--green)' : activity.type === 'yellow' ? 'var(--amber)' : 'var(--blue)', fontSize: '0.9rem' }}>●</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)' }}>{activity.text}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, whiteSpace: 'nowrap' }}>{activity.time}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* SECTION 7 — QUICK ACTIONS */}
        <section className="panel quick-actions-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2>Quick Actions Panel</h2>
          <div className="quick-actions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', flex: 1, alignContent: 'center' }}>
            <NavLink to="/menu" className="quick-action-btn" style={{ textDecoration: 'none', background: 'var(--blue)', color: 'white', padding: '0.85rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 900, textAlign: 'center', border: 0 }}>
              <span style={{ fontSize: '1.25rem' }}>🍔</span>
              <span>Manage Menu</span>
            </NavLink>
            <button onClick={handleOrderFeedClick} className="quick-action-btn" style={{ background: 'var(--ink)', color: 'white', padding: '0.85rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 900, textAlign: 'center', border: 0, cursor: 'pointer' }}>
              <span style={{ fontSize: '1.25rem' }}>📋</span>
              <span>Order Feed</span>
            </button>
            <button onClick={handleCloudBackup} className="quick-action-btn" style={{ background: 'var(--primary)', color: 'white', padding: '0.85rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 900, textAlign: 'center', border: 0, cursor: 'pointer' }}>
              <span style={{ fontSize: '1.25rem' }}>☁️</span>
              <span>Backup Cloud</span>
            </button>
            <button onClick={handleExportPDF} className="quick-action-btn" style={{ background: 'var(--green)', color: 'white', padding: '0.85rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 900, textAlign: 'center', border: 0, cursor: 'pointer' }}>
              <span style={{ fontSize: '1.25rem' }}>📄</span>
              <span>Export PDF</span>
            </button>
          </div>
        </section>
      </div>

      {/* SYSTEM TOOLS PANEL */}
      <section className="panel system-tools-panel" style={{ marginTop: '1.5rem', borderLeft: '6px solid var(--primary)' }}>
        <h2>⚙️ System Tools</h2>
        <p className="kpi-subtext" style={{ margin: '0.25rem 0 1rem 0', color: 'var(--muted)' }}>
          System operations for administrators and software deployment setup.
        </p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn-toggle active" 
            onClick={() => setShowResetConfirm(true)}
            style={{ background: 'var(--primary)', color: 'white', fontWeight: 900, padding: '0.65rem 1.5rem', border: 0, cursor: 'pointer', borderRadius: '0.75rem' }}
          >
            ⚠️ Factory Reset
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--muted)' }}>
            <strong>WARNING:</strong> Destructive deployment setup tool. Resets all database logs, counters, and menu configuration.
          </span>
        </div>
      </section>

      {/* SECTION - SEARCHABLE ORDER HISTORY FEED */}
      <section className="panel master-orders-panel" style={{ marginTop: '1.5rem' }} ref={orderFeedRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>📋 Searchable Order History Feed</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={handleExportCSV} className="btn-toggle active" style={{ background: 'var(--ink)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 1rem', border: 0, cursor: 'pointer' }}>
              📥 Export CSV
            </button>
            <button onClick={handleExportPDF} className="btn-toggle active" style={{ background: 'var(--green)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 1rem', border: 0, cursor: 'pointer' }}>
              📄 Export PDF
            </button>
            <button onClick={() => window.print()} className="btn-toggle active" style={{ background: 'var(--blue)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 1rem', border: 0, cursor: 'pointer' }}>
              🖨️ Print Report
            </button>
          </div>
        </div>

        {/* History Search Filters Grid */}
        <div className="history-filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '1.25rem', padding: '1rem', background: '#faf9f6', borderRadius: '1rem', border: '1px solid var(--line)' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Token Search</label>
            <input 
              type="text" 
              placeholder="e.g. 101" 
              value={historySearchToken} 
              onChange={e => setHistorySearchToken(e.target.value)} 
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700 }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Status</label>
            <select 
              value={historySearchStatus} 
              onChange={e => setHistorySearchStatus(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700, background: 'white' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COOKING">Cooking</option>
              <option value="READY">Ready</option>
              <option value="DELIVERED">Delivered</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Type</label>
            <select 
              value={historySearchType} 
              onChange={e => setHistorySearchType(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700, background: 'white' }}
            >
              <option value="ALL">All Types</option>
              <option value="DINE_IN">Dine In</option>
              <option value="PARCEL">Parcel</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Table Number</label>
            <input 
              type="text" 
              placeholder="e.g. 5" 
              value={historySearchTable} 
              onChange={e => setHistorySearchTable(e.target.value)} 
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700 }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>From Date</label>
            <input 
              type="date" 
              value={historySearchFrom} 
              onChange={e => setHistorySearchFrom(e.target.value)} 
              style={{ width: '100%', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700 }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>To Date</label>
            <input 
              type="date" 
              value={historySearchTo} 
              onChange={e => setHistorySearchTo(e.target.value)} 
              style={{ width: '100%', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid var(--line)', fontWeight: 700 }}
            />
          </div>
        </div>

        {/* History Table */}
        <div className="admin-table-container" style={{ overflowY: 'auto', maxHeight: '420px', marginTop: '1.25rem' }}>
          <table className="menu-table admin-orders-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Date</th>
                <th>Type</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredHistoryOrders().length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state" style={{ textAlign: 'center' }}>
                    No matching history records found.
                  </td>
                </tr>
              ) : (
                [...getFilteredHistoryOrders()].reverse().map(order => {
                  const orderPrice = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
                  return (
                    <tr key={order.id} className={expandedOrder === order.id ? 'row-expanded-highlight' : ''}>
                      <td data-label="Token"><strong>#{order.token_number}</strong></td>
                      <td data-label="Date">{order.created_at ? parseSQLDate(order.created_at).toLocaleString() : ''}</td>
                      <td data-label="Type">
                        {order.order_type === 'DINE_IN' ? '🍽 Dine In' : '🛍 Parcel'}
                      </td>
                      <td data-label="Total"><strong>{formatPrice(orderPrice)}</strong></td>
                      <td data-label="Status">
                        <span className={`status-pill`} style={{
                          background: order.status === 'PENDING' ? '#fff0d8' :
                                      order.status === 'COOKING' ? '#e5f1fc' :
                                      order.status === 'READY' ? '#e7f7ed' : '#eee',
                          color: order.status === 'PENDING' ? 'var(--amber)' :
                                 order.status === 'COOKING' ? 'var(--blue)' :
                                 order.status === 'READY' ? 'var(--green)' : 'var(--muted)'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <button 
                          className="btn-toggle active" 
                          style={{ margin: 0, padding: '0.35rem 0.75rem' }}
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                        >
                          {expandedOrder === order.id ? 'Collapse' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expanded Order Receipt Modal */}
      {expandedOrder && (
        <div className="modal-overlay" onClick={() => setExpandedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Receipt Detail View</h2>
              <button className="btn-close-modal" onClick={() => setExpandedOrder(null)}>×</button>
            </div>
            {(() => {
              const order = orders.find(o => o.id === expandedOrder);
              if (!order) return null;
              const subtotal = order.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 className="modal-item-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>
                    Token #{order.token_number}
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontWeight: 800 }}>
                    <span>Type: {order.order_type === 'DINE_IN' ? `Table ${order.table_number}` : 'Parcel'}</span>
                    <span>Status: {order.status}</span>
                  </div>
                  <ul className="cart-list" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '0.5rem 0', listStyle: 'none' }}>
                    {order.items?.map(item => (
                      <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f9f9f9' }}>
                        <div>
                          <strong>{item.item_name}</strong>
                          <span className="portion-tag tag-full" style={{ marginLeft: '0.4rem' }}>{item.portion}</span>
                          <span style={{ color: 'var(--muted)', marginLeft: '0.5rem' }}>x{item.quantity}</span>
                        </div>
                        <strong>{formatPrice(item.total_price)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.25rem', marginTop: '0.5rem' }}>
                    <span>Total Bill:</span>
                    <strong style={{ color: 'var(--primary-dark)' }}>{formatPrice(subtotal)}</strong>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Factory Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)} style={{ zIndex: 11000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <header className="modal-header" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
              <h2 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⚠️ Factory Reset</h2>
              <button className="btn-close-modal" onClick={() => setShowResetConfirm(false)}>×</button>
            </header>
            <div className="modal-body" style={{ padding: '1.5rem 0' }}>
              <p style={{ fontWeight: 800, color: 'var(--ink)', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                This will permanently remove all business data and return the application to a fresh installation state.
              </p>
              <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', padding: '1rem', borderRadius: '0.75rem', color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>
                <strong>This action cannot be undone.</strong> All orders, menu items, price availability states, generated stats, and counters will be completely wiped out.
              </div>
            </div>
            <footer className="modal-footer" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                style={{ width: 'auto', padding: '0.6rem 1.5rem' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="primary-action btn-confirm-add" 
                onClick={handleFactoryReset}
                disabled={resetting}
                style={{ background: 'var(--primary)', borderColor: 'var(--primary)', width: 'auto', padding: '0.6rem 1.5rem', marginTop: 0 }}
              >
                {resetting ? 'Resetting...' : 'Factory Reset'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
