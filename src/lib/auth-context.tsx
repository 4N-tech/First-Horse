import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Permission, ROLE_PERMISSIONS } from '../types/index.ts';
import { api, tokenStorage } from './api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  canAccessModule: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user profile on startup if token exists
  useEffect(() => {
    async function loadUser() {
      const storedToken = tokenStorage.get();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.auth.me();
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          tokenStorage.remove();
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.error('Failed to load authenticated user profile:', err);
        tokenStorage.remove();
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login(credentials);
      if (res.success && res.token && res.user) {
        tokenStorage.set(res.token);
        setToken(res.token);
        setUser(res.user);
      } else {
        throw new Error('فشل تسجيل الدخول');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout().catch(() => {});
    } finally {
      tokenStorage.remove();
      setUser(null);
      setToken(null);
    }
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes(permission);
  };

  const canAccessModule = (module: string): boolean => {
    if (!user) return false;
    switch (module) {
      case 'dashboard':
        return true;
      case 'orders':
        return true; // Worker sees assigned, Admin & Manager see all
      case 'products':
      case 'categories':
        return user.role === 'ADMIN' || user.role === 'MANAGER';
      case 'customers':
        return user.role === 'ADMIN' || user.role === 'MANAGER';
      case 'employees':
        return user.role === 'ADMIN'; // Admin only
      case 'reports':
        return user.role === 'ADMIN' || user.role === 'MANAGER';
      case 'settings':
        return user.role === 'ADMIN'; // Admin only
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        hasRole,
        hasPermission,
        canAccessModule,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
