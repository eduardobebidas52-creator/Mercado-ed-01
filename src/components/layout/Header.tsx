/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { ActiveTab, SystemHealth } from '../../types';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenMobile: () => void;
  health: SystemHealth | null;
  loading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobile,
  health,
  loading,
  onRefresh,
}) => {
  const titles: Record<ActiveTab, string> = {
    overview: 'Visão Geral do Sistema',
    architecture: 'Arquitetura e Comunicação',
    database: 'Banco de Dados e Migrações',
    roadmap: 'Módulos Previstos e Escopo',
  };

  const isDbConnected = Boolean(health?.database?.connected);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 gap-8 shrink-0">
      {/* Zona 1: Botão mobile + Trilha de Contexto */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Abrir menu de navegação"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
          <span className="font-semibold text-slate-900 tracking-tight whitespace-nowrap">
            Mercado
          </span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="text-slate-700 truncate font-medium">
            {titles[activeTab]}
          </span>
        </div>
      </div>

      {/* Zona 2: Indicador de Conexão com o Backend e Banco */}
      <div className="hidden sm:flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          {health?.status === 'healthy' ? (
            <CheckCircle2 size={15} className="text-emerald-600" />
          ) : (
            <AlertCircle size={15} className="text-amber-600" />
          )}
          <span>
            API Node.js: <strong className="font-semibold text-slate-800">{health ? 'Ativa' : 'Aguardando'}</strong>
          </span>
        </div>

        <span aria-hidden="true" className="text-slate-200">|</span>

        <div className="flex items-center gap-1.5 text-slate-600">
          {isDbConnected ? (
            <CheckCircle2 size={15} className="text-emerald-600" />
          ) : (
            <AlertCircle size={15} className="text-amber-600" />
          )}
          <span>
            PostgreSQL: <strong className="font-semibold text-slate-800">{isDbConnected ? 'Conectado' : 'Não conectado'}</strong>
          </span>
        </div>
      </div>

      {/* Zona 3: Ação de Atualização de Diagnóstico */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          title="Consultar novamente o status da API e banco"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Verificando...' : 'Atualizar Diagnóstico'}</span>
        </button>
      </div>
    </header>
  );
};
