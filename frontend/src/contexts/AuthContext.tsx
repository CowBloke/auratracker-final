import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import { clearBanInfo } from '../services/ban';

interface User {
  id: string;
  username: string;
  firstName?: string | null;
  schoolLevel?: 'SECONDE' | 'PREMIERE' | 'TERMINALE' | null;
  classLetter?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  email: string;
  aura: number;
  money: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  usernameColor?: string | null;
  profilePicture?: string | null;
  profileBanner?: string | null;
  referralCode?: string | null;
  referredById?: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, firstName: string, schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE', classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G', email: string, password: string, motivationMessage: string, referralCode?: string) => Promise<void>;
  logout: () => void;
  updateBalance: (aura: number, money: number) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await authApi.me();
        setUser(response.data.user);
        clearBanInfo();
      }
    } catch (error) {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await refreshUser();
      setLoading(false);
    };
    initAuth();
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const response = await authApi.login({ username, password });
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    clearBanInfo();
  };

  const register = async (
    username: string,
    firstName: string,
    schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE',
    classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    email: string,
    password: string,
    motivationMessage: string,
    referralCode?: string
  ) => {
    await authApi.register({ username, firstName, schoolLevel, classLetter, email, password, motivationMessage, referralCode });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateBalance = (aura: number, money: number) => {
    if (user) {
      setUser({ ...user, aura, money });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateBalance, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
