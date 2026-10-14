/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, RefreshCw, CheckCircle2, AlertCircle, User, LogOut, KeyRound } from 'lucide-react';
import { ActiveTab, SystemHealth } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenMobile: () => void;
  health: SystemHealth | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobile,
  health,
  loading,
  onRefresh,
  onOpenAuth,
}) => {
  const { user, isAuthenticated, setupStatus, logout } = useAuth();

  const titles: Record<ActiveTab, string> = {
    overview: 'Visão Geral do Sistema',
    pos: 'Frente de Caixa (PDV)',
    products: 'Produtos e Controle de Estoque',
    'expiry-alerts': 'Alerta de Validade e Controle de Lotes',
    'stock-alerts': 'Alerta de Estoque e Ponto de Reposição',
    'credit-alerts': 'Alerta de Fiado e Inadimplência',
    customers: 'Gestão de Clientes e Limites de Crédito',
    receivables: 'Fiado e Baixa de Recebimentos',
    architecture: 'Arquitetura e Comunicação',
    database: 'Banco de Dados e Migrações',
    roadmap: 'Módulos Previstos e Escopo',
  };

  const isDbConnected = Boolean(health?.database?.connected);
  const isFirstSetup = !setupStatus?.isInitialized;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 gap-6 shrink-0">
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
      <div className="hidden lg:flex items-center gap-4 text-xs">
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

      {/* Zona 3: Autenticação + Atualização de Diagnóstico */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          title="Consultar novamente o status da API e banco"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden xl:inline">{loading ? 'Verificando...' : 'Diagnóstico'}</span>
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="font-semibold text-slate-900 leading-tight truncate max-w-[120px]">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                  {user.role}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
              title="Encerrar sessão"
              aria-label="Encerrar sessão"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-2xs ${
              isFirstSetup
                ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isFirstSetup ? <KeyRound size={14} /> : <User size={14} />}
            <span>{isFirstSetup ? 'Primeiro Acesso (Eduardo)' : 'Entrar'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
