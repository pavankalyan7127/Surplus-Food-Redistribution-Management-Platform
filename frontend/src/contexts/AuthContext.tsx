import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import {
  AuthResponse,
  LoginPayload,
  NgoSignupPayload,
  ProviderSignupPayload,
  User,
  UserRole,
} from '../types/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  signupProvider: (payload: ProviderSignupPayload) => Promise<User>;
  signupNgo: (payload: NgoSignupPayload) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem('access_token');
    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (payload: LoginPayload): Promise<User> => {
    try {
      const data: AuthResponse = await authApi.login(payload);
      localStorage.setItem('access_token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const signupProvider = async (payload: ProviderSignupPayload): Promise<User> => {
    try {
      return await authApi.signupProvider(payload);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const signupNgo = async (payload: NgoSignupPayload): Promise<User> => {
    try {
      return await authApi.signupNgo(payload);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const value: AuthContextType = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    signupProvider,
    signupNgo,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
