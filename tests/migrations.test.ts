/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { getMigrationFiles } from '../server/db/migrations/runner.js';

describe('Integridade das Migrações Versionadas', () => {
  it('deve identificar arquivos de migração .sql no diretório', () => {
    const migrations = getMigrationFiles();
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0].name).toMatch(/^\d+_.+\.sql$/);
  });

  it('não deve conter comandos destrutivos DROP TABLE ou DROP DATABASE', () => {
    const migrations = getMigrationFiles();

    for (const migration of migrations) {
      const content = fs.readFileSync(migration.filePath, 'utf-8');
      
      // Regra de segurança: proibir comandos destrutivos
      expect(content).not.toMatch(/DROP\s+TABLE/i);
      expect(content).not.toMatch(/DROP\s+DATABASE/i);
      expect(content).not.toMatch(/TRUNCATE/i);
    }
  });

  it('deve possuir a criação da tabela de rastreamento _migrations', () => {
    const migrations = getMigrationFiles();
    const initialMigration = migrations.find(m => m.name.includes('001_initial_schema'));
    expect(initialMigration).toBeDefined();

    if (initialMigration) {
      const content = fs.readFileSync(initialMigration.filePath, 'utf-8');
      expect(content).toContain('CREATE TABLE IF NOT EXISTS _migrations');
    }
  });
});
