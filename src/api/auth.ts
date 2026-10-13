/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient } from './client';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'gerente' | 'operador';
  createdAt?: string;
}

export interface SetupStatusResponse {
  isInitialized: boolean;
  hasDatabase: boolean;
  adminName?: string;
  message: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: UserProfile;
  token: string;
}

export async function fetchSetupStatus(): Promise<SetupStatusResponse> {
  return apiClient<SetupStatusResponse>('/api/auth/setup-status');
}

export async function setupInitialAdmin(data: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/api/auth/setup-initial-admin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchCurrentUser(token: string): Promise<{ user: UserProfile }> {
  return apiClient<{ user: UserProfile }>('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function logoutUser(): Promise<void> {
  await apiClient('/api/auth/logout', { method: 'POST' });
}
