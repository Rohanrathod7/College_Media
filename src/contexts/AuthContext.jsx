import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Authentication Context for managing user authentication state
 * Provides login, logout, register functions and user data
 */
const AuthContext = createContext();

/**
 * AuthProvider component that wraps the app and provides authentication state
 * @param {Object} props - React props
 * @param {React.ReactNode} props.children - Child components
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedRefreshToken = localStorage.getItem('refresh_token');

      if (storedToken && storedRefreshToken) {
        try {
          // Verify token validity (in real app, this would call an API)
          const isValid = await verifyToken(storedToken);
          if (isValid) {
            setToken(storedToken);
            setRefreshToken(storedRefreshToken);
            // Decode user info from token (simplified)
            const userData = JSON.parse(atob(storedToken.split('.')[1]));
            setUser(userData);
          } else {
            // Try to refresh token
            await refreshAccessToken();
          }
        } catch (err) {
          console.error('Token verification failed:', err);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  /**
   * Verify if a token is valid
   * @param {string} token - JWT token to verify
   * @returns {boolean} - Whether token is valid
   */
  const verifyToken = async (token) => {
    // In a real app, this would make an API call to verify the token
    // For now, we'll just check if it exists and hasn't expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  };

  /**
   * Refresh the access token using refresh token
   */
  const refreshAccessToken = async () => {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newToken = data.data.token;
        const newRefreshToken = data.data.refresh_token;

        localStorage.setItem('token', newToken);
        localStorage.setItem('refresh_token', newRefreshToken);
        setToken(newToken);
        setRefreshToken(newRefreshToken);

        // Update user data
        const userData = JSON.parse(atob(newToken.split('.')[1]));
        setUser(userData);
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
    }
  };

  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   */
  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      const { token: newToken, refresh_token: newRefreshToken, ...userData } = data.data;

      // Store tokens
      localStorage.setItem('token', newToken);
      localStorage.setItem('refresh_token', newRefreshToken);

      // Update state
      setToken(newToken);
      setRefreshToken(newRefreshToken);
      setUser(userData);

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   */
  const register = async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      const { token: newToken, refresh_token: newRefreshToken, ...userInfo } = data.data;

      // Store tokens
      localStorage.setItem('token', newToken);
      localStorage.setItem('refresh_token', newRefreshToken);

      // Update state
      setToken(newToken);
      setRefreshToken(newRefreshToken);
      setUser(userInfo);

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout user and clear all authentication data
   */
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setError(null);
  };

  /**
   * Get authorization headers for API requests
   * @returns {Object} - Headers object with authorization
   */
  const getAuthHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const value = {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    getAuthHeaders,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use authentication context
 * @returns {Object} - Authentication context value
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
