/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'os';
import { checkDatabaseConnection, DatabaseHealthResult } from '../db/connection.js';
import { getSanitizedEnvSummary } from '../config/env.js';

export interface SystemHealthResponse {
  service: string;
  version: string;
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: DatabaseHealthResult;
  system: {
    nodeVersion: string;
    platform: string;
    memoryUsedMb: number;
    memoryTotalMb: number;
  };
}

const startTime = Date.now();

/**
 * Coleta diagnóstico completo de saúde da aplicação e do banco PostgreSQL
 */
export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const dbHealth = await checkDatabaseConnection();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();
  const envSummary = getSanitizedEnvSummary();

  // Status geral: saudável se o banco estiver conectado, ou degradado se não configurado/desconectado
  const isHealthy = dbHealth.connected;

  return {
    service: 'Mercado API',
    version: '1.0.0',
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    environment: envSummary.environment,
    database: dbHealth,
    system: {
      nodeVersion: process.version,
      platform: os.platform(),
      memoryUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      memoryTotalMb: Math.round(os.totalmem() / 1024 / 1024),
    },
  };
}
