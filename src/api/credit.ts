/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreditAlertItem, CreditSummary, CustomerDebt, DebtPayment } from '../types/index.js';

export async function fetchCreditAlerts(
  params: {
    status?: 'ALL' | 'OVERDUE' | '7_DAYS' | 'LIMIT_EXCEEDED';
    search?: string;
    customerId?: string;
  } = {},
  token?: string | null
): Promise<{ alerts: CreditAlertItem[]; summary: CreditSummary }> {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.customerId) query.append('customerId', params.customerId);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/credit/alerts?${query.toString()}`, { headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao buscar alertas de fiado.');
  }

  return {
    alerts: json.data || [],
    summary: json.summary || {
      totalDebtsCount: 0,
      totalOpenDebt: 0,
      totalOverdueAmount: 0,
      overdueCount: 0,
      expiring7DaysCount: 0,
      expiring30DaysCount: 0,
      exceededLimitCount: 0,
      delinquentCustomersCount: 0,
      delinquencyRate: 0,
    },
  };
}

export async function fetchCreditCounts(
  token?: string | null
): Promise<{
  overdueCount: number;
  expiring7DaysCount: number;
  exceededLimitCount: number;
  totalCreditAlerts: number;
  totalOpenDebt: number;
  totalOverdueAmount: number;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/credit/counts', { headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao buscar contadores de fiado.');
  }

  return json.data;
}

export async function fetchDebts(
  params: {
    status?: string;
    customerId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
  token?: string | null
): Promise<{ debts: CustomerDebt[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.customerId) query.append('customerId', params.customerId);
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/credit/debts?${query.toString()}`, { headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao buscar títulos de fiado.');
  }

  return {
    debts: json.data || [],
    total: json.total || 0,
  };
}

export async function receivePayment(
  data: {
    customerId: string;
    debtId?: string;
    amount: number;
    paymentMethod: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO';
    notes?: string;
  },
  token?: string | null
): Promise<DebtPayment> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/credit/payments', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao registrar pagamento.');
  }

  return json.data;
}

export async function fetchPaymentReceipts(
  params: {
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
  token?: string | null
): Promise<{ receipts: DebtPayment[]; total: number }> {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/credit/receipts?${query.toString()}`, { headers });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao buscar recibos.');
  }

  return {
    receipts: json.data || [],
    total: json.total || 0,
  };
}
