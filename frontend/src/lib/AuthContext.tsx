'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { authApi } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const { user } = await authApi.getMe();
      setUser(user);
      if (typeof window !== 'undefined') {
        if (user?.activeFamilyId) {
          window.localStorage.setItem('activeFamilyId', user.activeFamilyId);
        } else {
          window.localStorage.removeItem('activeFamilyId');
        }
      }
    } catch (err) {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('activeFamilyId');
      }
      // Don't set error for 401 (not logged in)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('activeFamilyId');
      }
      window.location.href = '/login';
    } catch (err) {
      setError('Logout failed');
    }
  };

  const refresh = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
