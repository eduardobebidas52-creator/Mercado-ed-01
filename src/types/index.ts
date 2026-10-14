/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DatabaseHealth {
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  message: string;
}

export interface SystemHealth {
  service: string;
  version: string;
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: DatabaseHealth;
  system: {
    nodeVersion: string;
    platform: string;
    memoryUsedMb: number;
    memoryTotalMb: number;
  };
}

export interface MigrationReport {
  configured: boolean;
  appliedCount: number;
  pendingCount: number;
  availableMigrations: string[];
  appliedMigrations: string[];
  pendingMigrations: string[];
  message: string;
}

export interface SystemConfigSummary {
  config: {
    environment: string;
    port: number;
    hasDatabaseUrl: boolean;
    hasJwtSecret: boolean;
    jwtExpiresIn: string;
    appUrl: string;
  };
  note: string;
}

export type ActiveTab = 
  | 'overview' 
  | 'pos' 
  | 'products' 
  | 'expiry-alerts' 
  | 'stock-alerts' 
  | 'credit-alerts'
  | 'customers'
  | 'receivables'
  | 'architecture' 
  | 'database' 
  | 'roadmap';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  address: string | null;
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  status: 'ACTIVE' | 'BLOCKED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalPurchasesCount?: number;
  totalPurchasesAmount?: number;
  totalDebtsCount?: number;
  openDebtsCount?: number;
  overdueDebtsCount?: number;
}

export interface CustomerDebt {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  creditLimit?: number;
  currentDebt?: number;
  saleId: string | null;
  description: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  daysOverdue: number;
  notes: string | null;
  createdAt: string;
}

export interface DebtPayment {
  id: string;
  receiptNumber: number;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  paymentMethod: string;
  previousDebt: number;
  remainingDebt: number;
  operatorName: string;
  notes: string | null;
  createdAt: string;
}

export interface CreditAlertItem {
  debtId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerCpf: string | null;
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  isLimitExceeded: boolean;
  saleId: string | null;
  description: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  daysRemainingOrOverdue: number;
  urgency: 'OVERDUE' | 'CRITICAL_7_DAYS' | 'WARNING_30_DAYS' | 'OK';
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  createdAt: string;
}

export interface CreditSummary {
  totalDebtsCount: number;
  totalOpenDebt: number;
  totalOverdueAmount: number;
  overdueCount: number;
  expiring7DaysCount: number;
  expiring30DaysCount: number;
  exceededLimitCount: number;
  delinquentCustomersCount: number;
  delinquencyRate: number;
}

