import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('authToken');
  });

  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('authToken'));
    };

    // Listen for storage changes (in case token is cleared elsewhere)
    window.addEventListener('storage', checkAuth);
    // Custom event for login/logout
    window.addEventListener('auth:login', checkAuth);
    window.addEventListener('auth:logout', checkAuth);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('auth:login', checkAuth);
      window.removeEventListener('auth:logout', checkAuth);
    };
  }, []);

  return { isAuthenticated };
}
