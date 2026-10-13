/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  UserProfile, 
  SetupStatusResponse, 
  fetchSetupStatus, 
  loginUser, 
  setupInitialAdmin, 
  fetchCurrentUser, 
  logoutUser 
} from '../api/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  setupStatus: SetupStatusResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setupAdmin: (data: { name: string; email: string; password: string; confirmPassword: string }) => Promise<void>;
  logout: () => void;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'mercado_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await fetchSetupStatus();
      setSetupStatus(status);
    } catch {
      // Falha silenciosa se o backend estiver em transição
    }
  }, []);

  // Restaura sessão existente se houver token salvo
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      await refreshStatus();

      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        try {
          const res = await fetchCurrentUser(savedToken);
          setUser(res.user);
          setToken(savedToken);
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshStatus]);

  const login = async (email: string, password: string) => {
    const res = await loginUser({ email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setToken(res.token);
    await refreshStatus();
  };

  const setupAdmin = async (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    const res = await setupInitialAdmin(data);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setToken(res.token);
    await refreshStatus();
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignora falhas de rede no logout
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        setupStatus,
        loading,
        login,
        setupAdmin,
        logout,
        refreshStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
