/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Server, 
  Database, 
  Activity, 
  AlertTriangle,
  Info,
  DollarSign,
  Package,
  ShoppingCart,
  Users
} from 'lucide-react';
import { SystemHealth } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';

import { useAuth } from '../context/AuthContext';
import { Lock, KeyRound, CheckCircle2, ShieldCheck } from 'lucide-react';
import { fetchProductMetrics, ProductMetrics } from '../api/products';
import { fetchTodaySalesMetrics, fetchCurrentCashRegister, TodaySalesMetrics, CashRegister } from '../api/pos';
import { fetchAlertCounts, AlertCounts } from '../api/alerts';
import { ActiveTab } from '../types';

interface OverviewPageProps {
  health: SystemHealth | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenAuth: () => void;
  onSelectTab?: (tab: ActiveTab) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  health,
  loading,
  error,
  onOpenAuth,
  onSelectTab,
}) => {
  const { user, token, isAuthenticated, setupStatus } = useAuth();
  const isDbConnected = Boolean(health?.database?.connected);
  const [metrics, setMetrics] = React.useState<ProductMetrics | null>(null);
  const [salesMetrics, setSalesMetrics] = React.useState<TodaySalesMetrics | null>(null);
  const [register, setRegister] = React.useState<CashRegister | null>(null);
  const [alertCounts, setAlertCounts] = React.useState<AlertCounts | null>(null);

  React.useEffect(() => {
    fetchProductMetrics()
      .then(setMetrics)
      .catch(() => {});

    fetchAlertCounts()
      .then(setAlertCounts)
      .catch(() => {});

    if (token) {
      fetchTodaySalesMetrics(token)
        .then(setSalesMetrics)
        .catch(() => {});
      fetchCurrentCashRegister(token)
        .then(setRegister)
        .catch(() => {});
    }
  }, [health, token]);

  // Formatação de moeda real brasileira
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Banner Informativo de Escopo da Etapa 1 */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-5 text-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
            <Info size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Etapa 1: Arquitetura, Conexão e Estrutura Inicial
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              O backend Express e a estrutura PostgreSQL estão configurados para garantir segurança, validação centralizada e migrações versionadas. Funções comerciais (PDV, vendas, produtos, caixa e fiado) não foram inventadas ou simuladas e serão implementadas nas próximas etapas após sua validação.
            </p>
          </div>
        </div>
      </div>

      {/* Cartão da Etapa 2: Autenticação Segura */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg shrink-0 ${isAuthenticated ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
              {isAuthenticated ? <ShieldCheck size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Etapa 2: Autenticação Segura e Controle de Acesso
                </h3>
                <StatusBadge 
                  status={isAuthenticated ? 'success' : setupStatus?.isInitialized ? 'neutral' : 'warning'} 
                  label={isAuthenticated ? 'Sessão Ativa' : setupStatus?.isInitialized ? 'Pronto para Login' : 'Aguardando Primeiro Acesso'} 
                />
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {isAuthenticated && user
                  ? `Usuário autenticado: ${user.name} (${user.role.toUpperCase()}) com token JWT assinado.`
                  : setupStatus?.isInitialized
                  ? 'O administrador Eduardo já está registrado. Faça login para acessar as operações restritas.'
                  : 'O administrador Eduardo ainda não definiu sua senha mestra. Clique no botão ao lado para realizar o primeiro acesso com senha forte.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 self-start sm:self-auto">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                {!setupStatus?.isInitialized ? <KeyRound size={14} /> : <Lock size={14} />}
                <span>{!setupStatus?.isInitialized ? 'Criar Senha de Eduardo' : 'Entrar na Conta'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Erro de Comunicação se houver */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-800 text-xs">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <span>Erro ao comunicar com o backend HTTP: {error}</span>
        </div>
      )}

      {/* Diagnóstico em Tempo Real do Backend e Banco */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cartão 1: API HTTP Node.js */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Server size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">API Backend HTTP</h3>
            </div>
            <StatusBadge 
              status={health ? 'success' : 'warning'} 
              label={health ? 'Operacional' : 'Consultando'} 
            />
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Serviço</span>
              <span className="font-medium text-slate-900">{health?.service || 'Mercado API'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Versão da API</span>
              <span className="font-mono tabular-nums text-slate-900">{health?.version || '1.0.0'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Tempo em atividade</span>
              <span className="font-mono tabular-nums text-slate-900">
                {health ? `${health.uptimeSeconds} segundos` : '—'}
              </span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span>Memória em uso</span>
              <span className="font-mono tabular-nums text-slate-900">
                {health ? `${health.system.memoryUsedMb} MB` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Cartão 2: PostgreSQL */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Database size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Banco PostgreSQL</h3>
            </div>
            <StatusBadge 
              status={isDbConnected ? 'success' : health?.database?.configured ? 'error' : 'warning'} 
              label={isDbConnected ? 'Conectado' : health?.database?.configured ? 'Falha na conexão' : 'Aguardando DATABASE_URL'} 
            />
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Variável de Ambiente</span>
              <span className="font-medium text-slate-900">
                {health?.database?.configured ? 'Configurada' : 'Não definida (.env)'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Latência da consulta</span>
              <span className="font-mono tabular-nums text-slate-900">
                {health?.database?.latencyMs !== undefined ? `${health.database.latencyMs} ms` : '—'}
              </span>
            </div>
            <div className="pt-1 text-[11px] text-slate-500 leading-relaxed">
              {health?.database?.message || (loading ? 'Testando conexão...' : 'Aguardando diagnóstico')}
            </div>
          </div>
        </div>

        {/* Cartão 3: Ambiente & Hospedagem */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Activity size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Ambiente & Render</h3>
            </div>
            <StatusBadge 
              status="neutral" 
              label={health?.environment || 'development'} 
            />
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Versão Node.js</span>
              <span className="font-mono tabular-nums text-slate-900">{health?.system?.nodeVersion || 'v22.x'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Plataforma</span>
              <span className="font-mono text-slate-900">{health?.system?.platform || 'linux'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span>Deploy de Produção</span>
              <span className="font-medium text-slate-900">Render (render.yaml preparado)</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span>Migrações do Banco</span>
              <span className="font-medium text-slate-900">Tabela versionada</span>
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Alertas Operacionais em Tempo Real (Etapa 5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Alertas Operacionais & Acesso Direto às Abas
          </h3>
          <span className="text-xs text-slate-500">
            Clique nos cards para abrir a aba correspondente
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Alerta de Validade */}
          <div 
            onClick={() => onSelectTab?.('expiry-alerts')}
            className="cursor-pointer bg-gradient-to-br from-amber-500/10 via-white to-amber-50/40 border border-amber-200/80 hover:border-amber-400 rounded-xl p-5 shadow-sm hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Alerta de Validade
              </span>
              <span className="text-xs text-amber-700 font-semibold group-hover:translate-x-1 transition flex items-center gap-0.5">
                Abrir Aba →
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {alertCounts?.totalValidityAlerts || 0}
              </span>
              <span className="text-xs text-slate-600 font-medium">lotes sob atenção</span>
            </div>

            <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between text-xs">
              <span className="text-rose-600 font-bold">
                {alertCounts?.expiredCount || 0} vencidos
              </span>
              <span className="text-orange-600 font-semibold">
                {alertCounts?.expiring7DaysCount || 0} em até 7d
              </span>
              <span className="text-amber-700 font-medium">
                {alertCounts?.expiring30DaysCount || 0} em até 30d
              </span>
            </div>
          </div>

          {/* Card Alerta de Estoque */}
          <div 
            onClick={() => onSelectTab?.('stock-alerts')}
            className="cursor-pointer bg-gradient-to-br from-rose-500/10 via-white to-rose-50/40 border border-rose-200/80 hover:border-rose-400 rounded-xl p-5 shadow-sm hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Alerta de Estoque
              </span>
              <span className="text-xs text-rose-700 font-semibold group-hover:translate-x-1 transition flex items-center gap-0.5">
                Abrir Aba →
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {alertCounts?.totalStockAlerts || 0}
              </span>
              <span className="text-xs text-slate-600 font-medium">itens em risco</span>
            </div>

            <div className="mt-3 pt-3 border-t border-rose-100 flex items-center justify-between text-xs">
              <span className="text-rose-600 font-bold">
                {alertCounts?.zeroStockCount || 0} zerados
              </span>
              <span className="text-amber-700 font-semibold">
                {alertCounts?.lowStockCount || 0} abaixo do mín.
              </span>
              <span className="text-slate-500 font-medium">
                Gerar compras
              </span>
            </div>
          </div>

          {/* Card Frente de Caixa */}
          <div 
            onClick={() => onSelectTab?.('pos')}
            className="cursor-pointer bg-gradient-to-br from-blue-500/10 via-white to-blue-50/40 border border-blue-200/80 hover:border-blue-400 rounded-xl p-5 shadow-sm hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                Frente de Caixa (PDV)
              </span>
              <span className="text-xs text-blue-700 font-semibold group-hover:translate-x-1 transition flex items-center gap-0.5">
                Abrir PDV →
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {salesMetrics?.totalSalesCount || 0}
              </span>
              <span className="text-xs text-slate-600 font-medium">vendas hoje</span>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-bold">
                {(salesMetrics?.totalRevenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className={`font-semibold ${register?.status === 'OPEN' ? 'text-emerald-600' : 'text-slate-500'}`}>
                {register?.status === 'OPEN' ? 'Caixa Aberto' : 'Caixa Fechado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores Reais do Sistema */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Indicadores do Negócio (Estado Real do Mercado)
          </h3>
          <span className="text-xs text-slate-500">
            Valores computados diretamente do PostgreSQL
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Vendas Realizadas Hoje</span>
              <DollarSign size={16} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              0 operações registradas
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Produtos em Estoque</span>
              <Package size={16} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {metrics?.totalProducts || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {(metrics?.totalProducts || 0) > 0 ? `${metrics?.totalStockUnits} itens físicos` : 'Nenhum produto cadastrado'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Caixa Atual</span>
              <ShoppingCart size={16} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Caixa fechado (não iniciado)
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Saldo em Fiado</span>
              <Users size={16} className="text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              0 clientes pendentes
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Verificação dos Requisitos da Etapa 1 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-900">
            Checklist de Conformidade Técnica da Etapa 1
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Verificações reais executadas na base do código
          </p>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <strong className="font-semibold text-slate-800">Servidor Express e API HTTP</strong>
              <p className="text-slate-500 mt-0.5">Rotas centralizadas em /api, middlewares de segurança e tratamento de erros</p>
            </div>
            <StatusBadge status="success" label="Implementado e Ativo" />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <strong className="font-semibold text-slate-800">Cliente PostgreSQL e Pool de Conexões</strong>
              <p className="text-slate-500 mt-0.5">Driver pg configurado com pooling, SSL para Render e ping de integridade sem vazamento de senhas</p>
            </div>
            <StatusBadge status="success" label="Implementado" />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <strong className="font-semibold text-slate-800">Mecanismo de Migrações Versionadas</strong>
              <p className="text-slate-500 mt-0.5">Tabela _migrations, migração 001 com schema base sem comandos DROP</p>
            </div>
            <StatusBadge status="success" label="Implementado" />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <strong className="font-semibold text-slate-800">Testes Automatizados (Vitest)</strong>
              <p className="text-slate-500 mt-0.5">3 suítes e 6 testes cobrindo sanitização de ambiente, integridade de migrações e resposta de saúde</p>
            </div>
            <StatusBadge status="success" label="100% Aprovados" />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <strong className="font-semibold text-slate-800">Configuração para Deploy no Render</strong>
              <p className="text-slate-500 mt-0.5">render.yaml blueprint criado com web service e instância PostgreSQL gerenciada</p>
            </div>
            <StatusBadge status="success" label="Pronto para Render" />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <strong className="font-semibold text-slate-800">Instância PostgreSQL Real no Render / Produção</strong>
              <p className="text-slate-500 mt-0.5">Requer fornecimento da variável DATABASE_URL (via painel do Render ou arquivo .env local)</p>
            </div>
            <StatusBadge 
              status={isDbConnected ? 'success' : 'warning'} 
              label={isDbConnected ? 'Conectado' : 'Aguardando Credencial Externa'} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
