/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  FileCode, 
  HardDriveDownload, 
  AlertCircle,
  CheckCircle2, 
  Terminal,
  RefreshCw,
  FolderGit2
} from 'lucide-react';
import { fetchMigrationStatus } from '../api/health';
import { MigrationReport, SystemHealth } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';

interface DatabaseStatusPageProps {
  health: SystemHealth | null;
}

export const DatabaseStatusPage: React.FC<DatabaseStatusPageProps> = ({ health }) => {
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMigrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMigrationStatus();
      setMigrationReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar migrações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMigrations();
  }, []);

  const isDbConnected = Boolean(health?.database?.connected);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Banco de Dados PostgreSQL & Migrações
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Persistência relacional, versionamento de tabelas e planejamento de cópias de segurança.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMigrations}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 self-start sm:self-auto shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Atualizar Migrações</span>
        </button>
      </div>

      {/* Cartões de Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Conexão Ativa</span>
            <Database size={16} className="text-blue-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {isDbConnected ? 'PostgreSQL Ativo' : 'Aguardando Banco'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {health?.database?.configured ? 'DATABASE_URL detectada' : 'Variável DATABASE_URL ausente'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Migrações Criadas</span>
            <FileCode size={16} className="text-blue-600" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
            {migrationReport?.availableMigrations?.length || 1} arquivo(s)
          </div>
          <div className="text-xs text-slate-500 mt-1">
            001_initial_schema.sql
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Controle de Versão</span>
            <FolderGit2 size={16} className="text-blue-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            Tabela _migrations
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Rastreamento automático por nome
          </div>
        </div>
      </div>

      {/* Diagnóstico da Conexão */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          Diagnóstico de Conexão com o Banco de Dados
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          O backend testa a conectividade via <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">SELECT 1</code> com sanitização rigorosa de credenciais.
        </p>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2 mb-2">
            {isDbConnected ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
            )}
            <span className="font-semibold text-slate-800">
              {health?.database?.message || 'Aguardando diagnóstico'}
            </span>
          </div>
          <div className="text-slate-500 space-y-1">
            <p>
              • No <strong>Render</strong>: A variável <code className="font-mono text-slate-700">DATABASE_URL</code> é injetada automaticamente ao associar a instância PostgreSQL gerenciada com o Web Service.
            </p>
            <p>
              • No <strong>Ambiente Local</strong>: Crie o arquivo <code className="font-mono text-slate-700">.env</code> a partir de <code className="font-mono text-slate-700">.env.example</code> apontando para a sua instância PostgreSQL local.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Migrações Versionadas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Histórico de Migrações Versionadas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Localizadas em <code className="font-mono text-slate-700">server/db/migrations/</code>
            </p>
          </div>
          {migrationReport && (
            <StatusBadge 
              status={isDbConnected ? 'success' : 'neutral'} 
              label={`${migrationReport.availableMigrations.length} migração(ões) identificada(s)`} 
            />
          )}
        </div>

        {error && (
          <div className="p-4 text-xs text-rose-700 bg-rose-50 border-b border-rose-100">
            {error}
          </div>
        )}

        <div className="divide-y divide-slate-100 text-xs">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileCode size={15} className="text-blue-600" />
                <span className="font-mono font-medium text-slate-900">001_initial_schema.sql</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Cria tabela _migrations, extensão pgcrypto, tabela users (com RBAC seguro) e logs de auditoria.
              </p>
            </div>
            <StatusBadge 
              status={isDbConnected ? 'success' : 'warning'} 
              label={isDbConnected ? 'Pronta para execução' : 'Aguardando PostgreSQL'} 
            />
          </div>
        </div>
      </div>

      {/* Plano de Cópias de Segurança (Backups) e Recuperação de Desastres */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-sm mb-3">
          <HardDriveDownload size={18} className="text-blue-600" />
          <span>Procedimentos de Backup e Recuperação (Plano para Produção)</span>
        </div>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Antes de colocar o sistema em operação real no Render, as rotinas de backup e restauração devem estar homologadas para garantir que nenhuma venda ou dado financeiro seja perdido.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
              <Terminal size={14} className="text-slate-600" />
              <span>1. Backup Lógico (pg_dump)</span>
            </div>
            <p className="text-slate-500 text-[11px] mb-2 leading-relaxed">
              Exportação completa e consistente das tabelas e esquemas sem interrupção de leituras:
            </p>
            <pre className="p-2.5 bg-slate-900 text-slate-100 rounded text-[11px] font-mono overflow-x-auto">
pg_dump -Fc "$DATABASE_URL" &gt; backup_mercado_$(date +%Y%m%d).dump
            </pre>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
              <Terminal size={14} className="text-slate-600" />
              <span>2. Restauração Segura (pg_restore)</span>
            </div>
            <p className="text-slate-500 text-[11px] mb-2 leading-relaxed">
              Recuperação de desastres direcionada a um banco limpo de homologação ou recuperação:
            </p>
            <pre className="p-2.5 bg-slate-900 text-slate-100 rounded text-[11px] font-mono overflow-x-auto">
pg_restore --clean --if-exists -d "$DATABASE_URL" backup_mercado.dump
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
