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
      status: 'Concluído e Operacional',
      isCompleted: true,
    },
    {
      stage: 'Etapa 3',
      title: 'Cadastro de Produtos e Gestão de Estoque',
      icon: Package,
      description: 'Catálogo de itens com código de barras, categoria, preço de custo, preço de venda, margem, estoque mínimo e histórico de entradas/perdas.',
      tables: ['categories', 'products', 'stock_movements'],
      status: 'Concluído e Operacional',
      isCompleted: true,
    },
    {
      stage: 'Etapa 4',
      title: 'Frente de Caixa (PDV) e Operação de Caixa',
      icon: ShoppingCart,
      description: 'Operação de caixa com bipagem de código de barras ou busca rápida, abertura/fechamento com conferência cega, suprimento, sangria e múltiplos pagamentos.',
      tables: ['sales', 'sale_items', 'cash_registers', 'cash_transactions'],
      status: 'Concluído e Operacional',
      isCompleted: true,
    },
    {
      stage: 'Etapa 5',
      title: 'Alertas de Validade e Estoque Mínimo',
      icon: Wallet,
      description: 'Abas exclusivas para controle de lotes a vencer (laranja 7d / amarelo 30d), produtos vencidos (vermelho), descarte por avaria e lista de reposição.',
      tables: ['product_batches', 'batch_loss_records', 'alert_settings'],
      status: 'Concluído e Operacional',
      isCompleted: true,
    },
    {
      stage: 'Etapa 6',
      title: 'Clientes, Alerta de Fiado e Baixa de Recebimentos',
      icon: Users,
      description: 'Controle de fiado, ficha do cliente, limites de crédito, alertas de inadimplência com cobrança WhatsApp e recibos oficiais com integração de caixa.',
      tables: ['customers', 'customer_debts', 'debt_payments'],
      status: 'Concluído e Operacional',
      isCompleted: true,
    },
    {
      stage: 'Etapa 7',
      title: 'Financeiro, Fluxo de Caixa e Relatórios (DRE / Curva ABC)',
      icon: BarChart3,
      description: 'Demonstrativo de resultado do exercício (DRE), cálculo do lucro real líquido, produtos mais lucrativos (Curva ABC), despesas operacionais e fechamento.',
      tables: ['expense_categories', 'expenses', 'financial_reports'],
      status: 'PRÓXIMA ETAPA A INICIAR',
      isNext: true,
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
                  <StatusBadge 
                    status={item.isCompleted ? 'success' : item.isNext ? 'warning' : 'neutral'} 
                    label={item.isCompleted ? 'Concluído' : item.isNext ? 'Próxima Etapa' : 'Não Implementado'} 
                  />
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
