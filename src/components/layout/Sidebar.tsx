/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Activity, 
  Layers, 
  Database, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  Server,
  Package,
  ShoppingCart
} from 'lucide-react';
import { ActiveTab } from '../../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const menuItems = [
    {
      id: 'overview' as ActiveTab,
      label: 'Visão Geral do Sistema',
      shortLabel: 'Visão Geral',
      icon: Activity,
      description: 'Saúde da API e conexão',
    },
    {
      id: 'pos' as ActiveTab,
      label: 'Frente de Caixa (PDV)',
      shortLabel: 'PDV',
      icon: ShoppingCart,
      description: 'Vendas rápidas e balcão',
    },
    {
      id: 'products' as ActiveTab,
      label: 'Produtos e Estoque',
      shortLabel: 'Produtos',
      icon: Package,
      description: 'Catálogo, preços e inventário',
    },
    {
      id: 'architecture' as ActiveTab,
      label: 'Arquitetura e Fluxo',
      shortLabel: 'Arquitetura',
      icon: Layers,
      description: 'Comunicação e segurança',
    },
    {
      id: 'database' as ActiveTab,
      label: 'Banco e Migrações',
      shortLabel: 'Banco',
      icon: Database,
      description: 'PostgreSQL e esquemas',
    },
    {
      id: 'roadmap' as ActiveTab,
      label: 'Módulos Previstos',
      shortLabel: 'Módulos',
      icon: Clock,
      description: 'Etapas futuras planejadas',
    },
  ];

  return (
    <>
      {/* Overlay Mobile */}
      {mobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Barra Lateral */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 bg-slate-900 text-slate-100 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 ${
          collapsed ? 'md:w-20' : 'md:w-64'
        } ${mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Cabeçalho do Menu Lateral */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white tracking-wider shrink-0 shadow-sm">
              M
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="min-w-0">
                <h1 className="font-bold text-base text-white tracking-tight truncate">
                  Mercado
                </h1>
                <p className="text-[11px] text-slate-400 truncate">
                  Sistema de Gestão
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Itens de Navegação */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={19} className="shrink-0" />
                {(!collapsed || mobileOpen) && (
                  <div className="min-w-0 flex-1">
                    <div className="truncate leading-tight">{item.label}</div>
                    <div className={`text-[11px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {item.description}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rodapé do Menu com Dados do Ambiente */}
        <div className="p-3 border-t border-slate-800 shrink-0">
          {(!collapsed || mobileOpen) ? (
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-medium mb-1">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                <span className="truncate">Etapa 1: Arquitetura</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Render · PostgreSQL · Node.js
              </p>
            </div>
          ) : (
            <div className="flex justify-center" title="Etapa 1: Arquitetura Inicial">
              <Server size={18} className="text-slate-400" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
