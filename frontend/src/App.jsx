import { NavLink, Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="app-shell">
      <nav className="top-nav" aria-label="Primary navigation">
        <div className="brand">Local Orders</div>
        <div className="nav-links">
          <NavLink to="/cashier">Cashier</NavLink>
          <NavLink to="/kitchen">Kitchen</NavLink>
          <NavLink to="/display">Display</NavLink>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
