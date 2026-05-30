import { NavLink, Outlet, useLocation } from 'react-router-dom';

export default function App() {
  const location = useLocation();
  const shouldHideNav = location.pathname === '/display' || location.pathname === '/kitchen' || location.pathname === '/cashier';

  return (
    <div className="app-shell">
      {!shouldHideNav && (
        <nav className="top-nav" aria-label="Primary navigation">
          <div className="brand">Local Orders</div>
          <div className="nav-links">
            <NavLink to="/cashier">Cashier</NavLink>
            <NavLink to="/kitchen">Kitchen</NavLink>
            <NavLink to="/display">Display</NavLink>
            <NavLink to="/menu">Menu Manager</NavLink>
            <NavLink to="/admin">Admin Dashboard</NavLink>
          </div>
        </nav>
      )}
      <Outlet />
    </div>
  );
}
