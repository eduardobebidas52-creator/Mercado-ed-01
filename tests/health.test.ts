/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { getSystemHealth } from '../server/services/health.service.js';

describe('Serviço de Integridade e Saúde da API', () => {
  it('deve retornar estrutura sanitizada do sistema e banco de dados', async () => {
    const health = await getSystemHealth();

    expect(health).toHaveProperty('service', 'Mercado API');
    expect(health).toHaveProperty('version');
    expect(health).toHaveProperty('status');
    expect(['healthy', 'degraded']).toContain(health.status);
    expect(health).toHaveProperty('uptimeSeconds');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(health).toHaveProperty('database');
    expect(health.database).toHaveProperty('configured');
    expect(health.database).toHaveProperty('connected');
    expect(health.database).toHaveProperty('message');
    expect(health).toHaveProperty('system');
    expect(health.system).toHaveProperty('nodeVersion');
    expect(health.system).toHaveProperty('platform');
  });
});
