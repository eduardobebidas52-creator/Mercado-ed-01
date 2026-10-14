/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AlertCounts {
  expiredCount: number;
  expiring7DaysCount: number;
  expiring30DaysCount: number;
  totalValidityAlerts: number;
  zeroStockCount: number;
  lowStockCount: number;
  totalStockAlerts: number;
}

export interface ExpiryAlertItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string | null;
  unit: string;
  categoryName: string | null;
  categoryColor: string | null;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  supplierName: string | null;
  costPrice: number;
  sellingPrice: number;
  isChecked: boolean;
  checkedAt: string | null;
  status: string;
  notes: string | null;
  daysRemaining: number;
  alertLevel: 'EXPIRED' | 'WARNING_7' | 'WARNING_30' | 'SAFE';
}

export interface StockAlertItem {
  id: string;
  barcode: string | null;
  name: string;
  unit: string;
  categoryName: string | null;
  categoryColor: string | null;
  supplierName: string | null;
  stockQuantity: number;
  minStockAlert: number;
  idealStock: number;
  costPrice: number;
  sellingPrice: number;
  status: 'ZERO' | 'LOW';
  suggestedReplenishment: number;
  estimatedCost: number;
}

export interface AlertSettings {
  yellowDaysThreshold: number;
  orangeDaysThreshold: number;
}

export interface ShoppingListItem {
  productId: string;
  barcode: string | null;
  productName: string;
  categoryName: string | null;
  supplierName: string | null;
  currentStock: number;
  minStock: number;
  idealStock: number;
  suggestedQuantity: number;
  unit: string;
  costPrice: number;
  totalEstimatedCost: number;
  urgency: 'CRITICAL' | 'HIGH';
}

export interface ShoppingListResponse {
  items: ShoppingListItem[];
  totalItems: number;
  totalSuggestedUnits: number;
  totalEstimatedBudget: number;
}

/**
 * Consulta os contadores em tempo real para badges e dashboard
 */
export async function fetchAlertCounts(): Promise<AlertCounts> {
  const res = await fetch('/api/alerts/counts');
  if (!res.ok) {
    throw new Error('Falha ao buscar contadores de alerta.');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Lista alertas de validade de lotes
 */
export async function fetchExpiryAlerts(filters?: {
  status?: string;
  categoryId?: string;
  search?: string;
}): Promise<ExpiryAlertItem[]> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters?.categoryId) params.append('categoryId', filters.categoryId);
  if (filters?.search) params.append('search', filters.search);

  const res = await fetch(`/api/alerts/expiry?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Falha ao carregar alertas de validade.');
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Cadastra um novo lote de mercadoria com data de validade
 */
export async function createProductBatch(
  data: {
    productId: string;
    batchNumber: string;
    expirationDate: string;
    quantity: number;
    supplierName?: string;
    notes?: string;
    addToStock?: boolean;
  },
  token: string | null
): Promise<ExpiryAlertItem> {
  const res = await fetch('/api/alerts/expiry/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao cadastrar lote de validade.');
  }
  return json.data;
}

/**
 * Marca lote como conferido pelo operador
 */
export async function markBatchChecked(
  batchId: string,
  isChecked: boolean,
  token: string | null
): Promise<void> {
  const res = await fetch(`/api/alerts/expiry/${batchId}/check`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ isChecked }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao atualizar conferência do lote.');
  }
}

/**
 * Registra perda ou baixa por validade vencida de um lote
 */
export async function registerBatchLoss(
  batchId: string,
  options: {
    quantity: number;
    reason: 'VENCIDO' | 'AVARIA' | 'PERDA' | 'OUTRO';
    notes?: string;
  },
  token: string | null
): Promise<void> {
  const res = await fetch(`/api/alerts/expiry/${batchId}/loss`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(options),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao registrar baixa do lote.');
  }
}

/**
 * Lista alertas de estoque (zerados e abaixo do mínimo)
 */
export async function fetchStockAlerts(filters?: {
  status?: string;
  categoryId?: string;
  search?: string;
}): Promise<StockAlertItem[]> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters?.categoryId) params.append('categoryId', filters.categoryId);
  if (filters?.search) params.append('search', filters.search);

  const res = await fetch(`/api/alerts/stock?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Falha ao carregar alertas de estoque.');
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Carrega a sugestão da lista de compras
 */
export async function fetchShoppingList(): Promise<ShoppingListResponse> {
  const res = await fetch('/api/alerts/stock/shopping-list');
  if (!res.ok) {
    throw new Error('Falha ao gerar lista de reposição.');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Consulta as regras de dias dos alertas
 */
export async function fetchAlertSettings(): Promise<AlertSettings> {
  const res = await fetch('/api/alerts/settings');
  if (!res.ok) {
    throw new Error('Falha ao carregar configurações de alertas.');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Salva as regras de dias dos alertas
 */
export async function updateAlertSettings(
  yellowDays: number,
  orangeDays: number,
  token: string | null
): Promise<AlertSettings> {
  const res = await fetch('/api/alerts/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      yellowDaysThreshold: yellowDays,
      orangeDaysThreshold: orangeDays,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao salvar configurações.');
  }
  return json.data;
}

/**
 * Popula lotes de teste para validação imediata
 */
export async function seedDemoBatches(token: string | null): Promise<string> {
  const res = await fetch('/api/alerts/seed-demo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao gerar lotes de teste.');
  }
  return json.message;
}
