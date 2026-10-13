/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient } from './client';
import { SystemHealth, MigrationReport, SystemConfigSummary } from '../types';

export async function fetchSystemHealth(): Promise<SystemHealth> {
  return apiClient<SystemHealth>('/api/health');
}

export async function fetchMigrationStatus(): Promise<MigrationReport> {
  return apiClient<MigrationReport>('/api/health/migrations');
}

export async function fetchSystemConfig(): Promise<SystemConfigSummary> {
  return apiClient<SystemConfigSummary>('/api/health/config');
}
