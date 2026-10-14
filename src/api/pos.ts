/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient } from './client';

export interface CashRegister {
  id: string;
  operatorId: string;
  operatorName?: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  expectedBalance: number | null;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
  notes: string | null;
  createdAt: string;
}

export interface CashTransaction {
  id: string;
  cashRegisterId: string;
  type: 'SUPRIMENTO' | 'SANGRIA';
  amount: number;
  reason: string;
  operatorId: string;
  createdAt: string;
}

export interface SaleItem {
  id?: string;
  productId: string;
  productName: string;
  barcode: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  saleNumber: number;
  cashRegisterId: string | null;
  operatorId: string;
  operatorName?: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'FIADO';
  amountPaid: number;
  changeAmount: number;
  customerName: string | null;
  status: 'COMPLETED' | 'CANCELLED';
  cancellationReason: string | null;
  createdAt: string;
  items?: SaleItem[];
}

export interface TodaySalesMetrics {
  totalSalesCount: number;
  totalRevenue: number;
  estimatedProfit: number;
  byPaymentMethod: {
    dinheiro: number;
    pix: number;
    debito: number;
    credito: number;
    fiado: number;
  };
}

export async function fetchCurrentCashRegister(token: string | null): Promise<CashRegister | null> {
  if (!token) return null;
  const res = await apiClient<{ success: boolean; data: CashRegister | null }>('/api/pos/register/current', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function openCashRegister(
  initialBalance: number,
  notes?: string,
  token?: string | null
): Promise<CashRegister> {
  const res = await apiClient<{ success: boolean; data: CashRegister }>('/api/pos/register/open', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ initialBalance, notes }),
  });
  return res.data;
}

export async function closeCashRegister(
  registerId: string,
  countedBalance: number,
  notes?: string,
  token?: string | null
): Promise<CashRegister> {
  const res = await apiClient<{ success: boolean; data: CashRegister }>('/api/pos/register/close', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ registerId, countedBalance, notes }),
  });
  return res.data;
}

export async function addCashTransaction(
  registerId: string,
  type: 'SUPRIMENTO' | 'SANGRIA',
  amount: number,
  reason: string,
  token?: string | null
): Promise<CashTransaction> {
  const res = await apiClient<{ success: boolean; data: CashTransaction }>('/api/pos/register/transaction', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ registerId, type, amount, reason }),
  });
  return res.data;
}

export async function createSale(
  saleData: {
    registerId?: string | null;
    items: Array<{ productId: string; quantity: number; unitPrice?: number }>;
    discount?: number;
    paymentMethod: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'FIADO';
    amountPaid: number;
    customerName?: string;
  },
  token?: string | null
): Promise<Sale> {
  const res = await apiClient<{ success: boolean; data: Sale }>('/api/pos/sales', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(saleData),
  });
  return res.data;
}

export async function fetchSales(
  filters?: { status?: string; limit?: number },
  token?: string | null
): Promise<Sale[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.limit) params.append('limit', String(filters.limit));

  const res = await apiClient<{ success: boolean; data: Sale[] }>(
    `/api/pos/sales${params.toString() ? `?${params.toString()}` : ''}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return res.data || [];
}

export async function cancelSale(
  saleId: string,
  reason: string,
  token?: string | null
): Promise<Sale> {
  const res = await apiClient<{ success: boolean; data: Sale }>(`/api/pos/sales/${saleId}/cancel`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ reason }),
  });
  return res.data;
}

export async function fetchTodaySalesMetrics(token?: string | null): Promise<TodaySalesMetrics> {
  const res = await apiClient<{ success: boolean; data: TodaySalesMetrics }>('/api/pos/metrics/today', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data;
}
