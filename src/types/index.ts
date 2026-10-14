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
  | 'architecture' 
  | 'database' 
  | 'roadmap';
