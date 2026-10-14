/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer } from '../types/index.js';

export interface CustomerSummary {
  totalCustomers: number;
  activeCustomers: number;
  blockedCustomers: number;
  customersWithDebt: number;
  totalDebt: number;
  totalCreditLimit: number;
}

export async function fetchCustomers(
  params: {
    search?: string;
    status?: string;
    hasDebtOnly?: boolean;
    overdueOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {},
  token?: string | null
): Promise<{ customers: Customer[]; total: number; summary: CustomerSummary }> {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.status) query.append('status', params.status);
  if (params.hasDebtOnly) query.append('hasDebtOnly', 'true');
  if (params.overdueOnly) query.append('overdueOnly', 'true');
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/customers?${query.toString()}`, { headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao carregar clientes.');
  }

  return {
    customers: json.data || [],
    total: json.total || 0,
    summary: json.summary || {
      totalCustomers: 0,
      activeCustomers: 0,
      blockedCustomers: 0,
      customersWithDebt: 0,
      totalDebt: 0,
      totalCreditLimit: 0,
    },
  };
}

export async function fetchCustomerById(
  id: string,
  token?: string | null
): Promise<{
  customer: Customer;
  debts: any[];
  payments: any[];
  recentSales: any[];
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/customers/${id}`, { headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Cliente não encontrado.');
  }

  return json.data;
}

export async function createCustomer(
  data: {
    name: string;
    phone: string;
    cpf?: string;
    address?: string;
    creditLimit?: number;
    status?: 'ACTIVE' | 'BLOCKED';
    notes?: string;
  },
  token?: string | null
): Promise<Customer> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/customers', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao cadastrar cliente.');
  }

  return json.data;
}

export async function updateCustomer(
  id: string,
  data: Partial<Customer>,
  token?: string | null
): Promise<Customer> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/customers/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao atualizar cliente.');
  }

  return json.data;
}

export async function deleteCustomer(
  id: string,
  token?: string | null
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/customers/${id}`, {
    method: 'DELETE',
    headers,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao excluir cliente.');
  }
}
