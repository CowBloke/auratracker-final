import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, youApi } from '../services/api';
import { clearBanInfo } from '../services/ban';
import type { ClanActiveEffect, YouTemporaryEffect } from '../services/api';
import { emitMoneyIncome } from '../lib/money-income-effects';

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
  isBetaTester: boolean;
  isFiscalInspector: boolean;
  isJudge: boolean;
  usernameColor?: string | null;
  profilePicture?: string | null;
  profileBanner?: string | null;
  referralCode?: string | null;
  referredById?: string | null;
  createdAt: string;
  clanEffects: ClanActiveEffect[];
  hasAdblock: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasTemporaryAdblock: boolean;
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
  const [temporaryEffects, setTemporaryEffects] = useState<YouTemporaryEffect[]>([]);
  const [nowTs, setNowTs] = useState(Date.now());

  const applyUser = useCallback((nextUser: User | null, options?: { animateMoneyGain?: boolean }) => {
    setUser((prevUser) => {
      if (
        options?.animateMoneyGain &&
        prevUser &&
        nextUser &&
        nextUser.money > prevUser.money
      ) {
        emitMoneyIncome(nextUser.money - prevUser.money);
      }

      return nextUser;
    });
  }, []);

  const loadTemporaryEffects = useCallback(async () => {
    if (!user?.id) {
      setTemporaryEffects([]);
      return;
    }

    try {
      const response = await youApi.getTemporaryEffects();
      setTemporaryEffects(response.data.effects ?? []);
    } catch {
      setTemporaryEffects([]);
    }
  }, [user?.id]);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await authApi.me();
        applyUser(response.data.user, { animateMoneyGain: true });
        clearBanInfo();
      }
    } catch (error) {
      localStorage.removeItem('token');
      applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    if (!user) {
      setTemporaryEffects([]);
      return;
    }

    void loadTemporaryEffects();
    const refreshInterval = window.setInterval(() => {
      void loadTemporaryEffects();
    }, 30000);
    const countdownInterval = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(countdownInterval);
    };
  }, [loadTemporaryEffects, user?.id]);

  const hasTemporaryAdblock = temporaryEffects.some(
    (effect) => effect.key === 'YOU_ADBLOCK' && new Date(effect.expiresAt).getTime() > nowTs
  );

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
    applyUser(response.data.user);
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
    applyUser(null);
  };

  const updateBalance = (aura: number, money: number) => {
    setUser((prevUser) => {
      if (!prevUser) return prevUser;
      if (money > prevUser.money) {
        emitMoneyIncome(money - prevUser.money);
      }
      return { ...prevUser, aura, money };
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, hasTemporaryAdblock, login, register, logout, updateBalance, refreshUser }}>
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
