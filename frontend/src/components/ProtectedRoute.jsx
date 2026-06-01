import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [redirectPath, setRedirectPath] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    const hasAccess = allowedRoles.includes(currentUser.role);
    if (!hasAccess) {
      setShowAccessDenied(true);

      // Determine where this role should go
      let path = '/';
      if (currentUser.role === 'admin') path = '/admin';
      else if (currentUser.role === 'cashier') path = '/cashier';
      else if (currentUser.role === 'kitchen') path = '/kitchen';
      else if (currentUser.role === 'display') path = '/display';

      const timer = setTimeout(() => {
        setRedirectPath(path);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [currentUser, allowedRoles]);

  if (!currentUser) {
    // Show Access Denied for unauthenticated users trying to access protected routes, then redirect to welcome page
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (showAccessDenied) {
    if (redirectPath) {
      return <Navigate to={redirectPath} replace />;
    }

    return (
      <div className="access-denied-container">
        <div className="access-denied-card">
          <div className="access-denied-icon">🚨</div>
          <h1>Access Denied</h1>
          <p>You do not have permission to view this page.</p>
          <div className="access-denied-loader">
            <div className="loader-progress"></div>
          </div>
          <span className="access-denied-redirect-msg">
            Redirecting you to your assigned screen...
          </span>
        </div>
      </div>
    );
  }

  return children;
}
