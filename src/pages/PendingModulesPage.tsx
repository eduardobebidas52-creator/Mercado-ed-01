/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Wallet, 
  Users, 
  BarChart3, 
  Lock,
  Clock
} from 'lucide-react';
import { StatusBadge } from '../components/ui/StatusBadge';

export const PendingModulesPage: React.FC = () => {
  const futureModules = [
    {
      stage: 'Etapa 2',
      title: 'Autenticação e Perfil de Usuários',
      icon: Lock,
      description: 'Criação da conta inicial do administrador Eduardo com hash seguro de senha, geração de tokens JWT e gestão de operadores e caixas.',
      tables: ['users', 'user_sessions', 'audit_logs'],
      status: 'Aguardando Aprovação da Etapa 1',
    },
    {
      stage: 'Etapa 3',
      title: 'Cadastro de Produtos e Gestão de Estoque',
      icon: Package,
      description: 'Catálogo de itens com código de barras, categoria, preço de custo, preço de venda, margem, estoque mínimo e histórico de entradas/perdas.',
      tables: ['categories', 'products', 'stock_movements'],
      status: 'Aguardando Etapas Anteriores',
    },
    {
      stage: 'Etapa 4',
      title: 'Frente de Caixa (PDV) e Vendas Rápidas',
      icon: ShoppingCart,
      description: 'Operação de caixa com bipagem de código de barras ou busca rápida, cálculo centralizado no backend de totais, troco e múltiplos pagamentos (dinheiro, PIX, cartão).',
      tables: ['sales', 'sale_items', 'payments'],
      status: 'Aguardando Etapas Anteriores',
    },
    {
      stage: 'Etapa 5',
      title: 'Controle de Caixa (Abertura, Sangria e Fechamento)',
      icon: Wallet,
      description: 'Abertura de turno com valor inicial, sangrias e suprimentos com justificativa, conferência cega e fechamento de caixa auditado.',
      tables: ['cash_registers', 'cash_transactions'],
      status: 'Aguardando Etapas Anteriores',
    },
    {
      stage: 'Etapa 6',
      title: 'Controle de Fiado (Contas a Receber de Clientes)',
      icon: Users,
      description: 'Cadastro de clientes com limite de crédito autorizado, lançamento de compras a prazo, emissão de comprovantes e abatimento parcial ou total de dívidas.',
      tables: ['customers', 'credit_accounts', 'credit_ledger'],
      status: 'Aguardando Etapas Anteriores',
    },
    {
      stage: 'Etapa 7',
      title: 'Relatórios Gerenciais e Indicadores de Desempenho',
      icon: BarChart3,
      description: 'Curva ABC de produtos mais vendidos, margem de contribuição bruta, fechamento financeiro diário/mensal e fluxo de caixa consolidado.',
      tables: ['daily_summaries', 'analytics_cache'],
      status: 'Aguardando Etapas Anteriores',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Módulos Comerciais Previstos no Roadmap
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Conforme definido no escopo da Etapa 1, nenhum módulo foi implementado previamente com dados fictícios ou simulações artificiais. O desenvolvimento ocorrerá de forma gradual e segura.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
            <Clock size={15} />
            <span>Desenvolvimento por Etapas</span>
          </div>
        </div>
      </div>

      {/* Grade de Módulos Futuros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {futureModules.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.stage} className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-blue-700">{item.stage}</span>
                      <h3 className="text-sm font-semibold text-slate-900 leading-tight">{item.title}</h3>
                    </div>
                  </div>
                  <StatusBadge status="neutral" label="Não Implementado" />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>Tabelas planejadas: <strong className="font-mono text-slate-700">{item.tables.join(', ')}</strong></span>
                <span className="italic">{item.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
