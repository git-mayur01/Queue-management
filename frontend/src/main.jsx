import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import CashierPage from './pages/CashierPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import DisplayPage from './pages/DisplayPage.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/cashier" replace />} />
          <Route path="cashier" element={<CashierPage />} />
          <Route path="kitchen" element={<KitchenPage />} />
          <Route path="display" element={<DisplayPage />} />
          <Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/cashier">Go to Cashier</Link></main>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
