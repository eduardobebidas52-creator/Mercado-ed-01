/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  Sliders, 
  ShieldAlert, 
  Check, 
  X, 
  Sparkles,
  PackageCheck,
  AlertOctagon,
  CalendarDays,
  Building,
  DollarSign
} from 'lucide-react';
import { 
  ExpiryAlertItem, 
  AlertSettings, 
  fetchExpiryAlerts, 
  fetchAlertSettings, 
  updateAlertSettings, 
  markBatchChecked, 
  registerBatchLoss, 
  createProductBatch,
  seedDemoBatches
} from '../api/alerts';
import { fetchProducts, fetchCategories, Product, Category } from '../api/products';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';

export const ExpiryAlertsPage: React.FC = () => {
  const { token, isAuthenticated } = useAuth();

  const [alerts, setAlerts] = useState<ExpiryAlertItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AlertSettings>({ yellowDaysThreshold: 30, orangeDaysThreshold: 7 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'WARNING_7' | 'WARNING_30' | 'NOT_CHECKED'>('ALL');

  // Modais
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [selectedBatchForLoss, setSelectedBatchForLoss] = useState<ExpiryAlertItem | null>(null);

  // Estados dos formulários
  const [yellowDaysInput, setYellowDaysInput] = useState(30);
  const [orangeDaysInput, setOrangeDaysInput] = useState(7);

  // Formulário de novo lote
  const [newBatchProductId, setNewBatchProductId] = useState('');
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchExpiration, setNewBatchExpiration] = useState('');
  const [newBatchQuantity, setNewBatchQuantity] = useState('10');
  const [newBatchSupplier, setNewBatchSupplier] = useState('');
  const [newBatchNotes, setNewBatchNotes] = useState('');
  const [newBatchAddToStock, setNewBatchAddToStock] = useState(true);

  // Formulário de perda
  const [lossQuantity, setLossQuantity] = useState('');
  const [lossReason, setLossReason] = useState<'VENCIDO' | 'AVARIA' | 'PERDA' | 'OUTRO'>('VENCIDO');
  const [lossNotes, setLossNotes] = useState('');

  // Notificação temporária
  const showFeedback = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsData, settingsData, catsData, prodsData] = await Promise.all([
        fetchExpiryAlerts({
          status: statusFilter,
          categoryId: selectedCategory || undefined,
          search: search.trim() || undefined,
        }),
        fetchAlertSettings().catch(() => ({ yellowDaysThreshold: 30, orangeDaysThreshold: 7 })),
        fetchCategories().catch(() => []),
        fetchProducts().catch(() => []),
      ]);

      setAlerts(alertsData);
      setSettings(settingsData);
      setYellowDaysInput(settingsData.yellowDaysThreshold);
      setOrangeDaysInput(settingsData.orangeDaysThreshold);
      setCategories(catsData);
      setProducts(prodsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados de validade.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedCategory, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Contadores analíticos
  const expiredCount = alerts.filter(a => a.alertLevel === 'EXPIRED').length;
  const warning7Count = alerts.filter(a => a.alertLevel === 'WARNING_7').length;
  const warning30Count = alerts.filter(a => a.alertLevel === 'WARNING_30').length;
  const notCheckedCount = alerts.filter(a => !a.isChecked).length;
  const totalValueAtRisk = alerts
    .filter(a => a.alertLevel === 'EXPIRED' || a.alertLevel === 'WARNING_7')
    .reduce((sum, a) => sum + (a.costPrice * a.quantity), 0);

  // Marcar como conferido
  const handleToggleCheck = async (batch: ExpiryAlertItem) => {
    try {
      await markBatchChecked(batch.id, !batch.isChecked, token);
      setAlerts(prev => prev.map(item => 
        item.id === batch.id ? { ...item, isChecked: !batch.isChecked } : item
      ));
      showFeedback(batch.isChecked ? 'Lote desmarcado.' : `Lote ${batch.batchNumber} conferido com sucesso!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao marcar lote');
    }
  };

  // Salvar configurações de dias
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Faça login como administrador para alterar configurações.');
      return;
    }

    if (yellowDaysInput <= orangeDaysInput) {
      alert('O período de alerta amarelo deve ser maior que o período laranja.');
      return;
    }

    setActionLoading(true);
    try {
      const updated = await updateAlertSettings(yellowDaysInput, orangeDaysInput, token);
      setSettings(updated);
      setIsSettingsModalOpen(false);
      showFeedback('Regras de dias para alerta atualizadas com sucesso!');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar regras');
    } finally {
      setActionLoading(false);
    }
  };

  // Abrir modal de baixa por perda
  const handleOpenLossModal = (batch: ExpiryAlertItem) => {
    setSelectedBatchForLoss(batch);
    setLossQuantity(String(batch.quantity));
    setLossReason(batch.alertLevel === 'EXPIRED' ? 'VENCIDO' : 'AVARIA');
    setLossNotes(`Baixa de mercadoria realizada na aba Alerta de Validade.`);
    setIsLossModalOpen(true);
  };

  // Confirmar baixa
  const handleConfirmLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForLoss) return;

    const qty = Number(lossQuantity);
    if (!qty || qty <= 0 || qty > selectedBatchForLoss.quantity) {
      alert(`Quantidade inválida. Deve estar entre 0.001 e ${selectedBatchForLoss.quantity}.`);
      return;
    }

    setActionLoading(true);
    try {
      await registerBatchLoss(
        selectedBatchForLoss.id,
        {
          quantity: qty,
          reason: lossReason,
          notes: lossNotes,
        },
        token
      );

      setIsLossModalOpen(false);
      setSelectedBatchForLoss(null);
      showFeedback(`Baixa de ${qty} ${selectedBatchForLoss.unit} registrada com sucesso no estoque!`);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao registrar baixa');
    } finally {
      setActionLoading(false);
    }
  };

  // Cadastrar novo lote
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchProductId || !newBatchNumber || !newBatchExpiration) {
      alert('Preencha o produto, número do lote e data de validade.');
      return;
    }

    const qty = Number(newBatchQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Quantidade do lote inválida.');
      return;
    }

    setActionLoading(true);
    try {
      await createProductBatch(
        {
          productId: newBatchProductId,
          batchNumber: newBatchNumber,
          expirationDate: newBatchExpiration,
          quantity: qty,
          supplierName: newBatchSupplier || undefined,
          notes: newBatchNotes || undefined,
          addToStock: newBatchAddToStock,
        },
        token
      );

      setIsNewBatchModalOpen(false);
      setNewBatchNumber('');
      setNewBatchExpiration('');
      setNewBatchQuantity('10');
      setNewBatchSupplier('');
      setNewBatchNotes('');
      showFeedback('Novo lote com validade cadastrado com sucesso!');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cadastrar lote');
    } finally {
      setActionLoading(false);
    }
  };

  // Gerar dados de teste caso não tenha nenhum lote
  const handleSeedDemo = async () => {
    setActionLoading(true);
    try {
      const msg = await seedDemoBatches(token);
      showFeedback(msg);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar dados de teste');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Feedback Toast */}
      {successMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Cabeçalho Principal da Aba Exclusiva */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-2xl p-6 shadow-lg border border-amber-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                <CalendarAlertIcon className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Alerta de Validade
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Aba Exclusiva
                  </span>
                </h1>
                <p className="text-slate-300 text-sm mt-0.5">
                  Monitoramento contínuo de lotes por data de validade real, baixas de vencidos e auditoria de perdas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
              title="Configurar períodos de alerta em dias"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              Configurar Regras
            </button>

            <button
              onClick={() => setIsNewBatchModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium shadow-md shadow-amber-900/30 transition"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Lote com Validade
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Cards de Métricas de Alerta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/60">
          <div 
            onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
            className={`cursor-pointer p-4 rounded-xl transition border ${
              statusFilter === 'EXPIRED'
                ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/30'
                : 'bg-slate-800/60 border-rose-500/30 hover:bg-rose-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Produtos Vencidos</span>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-400">{expiredCount}</span>
              <span className="text-xs text-rose-300">lotes críticos</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Exigem baixa imediata do estoque</p>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'WARNING_7' ? 'ALL' : 'WARNING_7')}
            className={`cursor-pointer p-4 rounded-xl transition border ${
              statusFilter === 'WARNING_7'
                ? 'bg-orange-950/60 border-orange-500 ring-2 ring-orange-500/30'
                : 'bg-slate-800/60 border-orange-500/30 hover:bg-orange-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">Vencendo em até {settings.orangeDaysThreshold} dias</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-orange-400">{warning7Count}</span>
              <span className="text-xs text-orange-300">lotes em risco</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Colocar em promoção no balcão</p>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'WARNING_30' ? 'ALL' : 'WARNING_30')}
            className={`cursor-pointer p-4 rounded-xl transition border ${
              statusFilter === 'WARNING_30'
                ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-slate-800/60 border-amber-500/30 hover:bg-amber-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Vencendo em até {settings.yellowDaysThreshold} dias</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-400">{warning30Count}</span>
              <span className="text-xs text-amber-300">lotes em atenção</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Priorizar saída (regra PEPS)</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Capital em Risco</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {totalValueAtRisk.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{notCheckedCount} lotes não conferidos</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por produto, código de barras ou nº do lote..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Filtros Rápidos por Situação */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter('EXPIRED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              statusFilter === 'EXPIRED'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Vencidos ({expiredCount})
          </button>
          <button
            onClick={() => setStatusFilter('WARNING_7')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              statusFilter === 'WARNING_7'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Até {settings.orangeDaysThreshold} dias ({warning7Count})
          </button>
          <button
            onClick={() => setStatusFilter('WARNING_30')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              statusFilter === 'WARNING_30'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Até {settings.yellowDaysThreshold} dias ({warning30Count})
          </button>
          <button
            onClick={() => setStatusFilter('NOT_CHECKED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === 'NOT_CHECKED'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            Não Conferidos ({notCheckedCount})
          </button>
        </div>
      </div>

      {/* Tabela de Lotes com Alertas de Validade */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm font-medium">Verificando lotes e datas de validade reais...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarAlertIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Nenhum lote com alerta encontrado</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Todos os lotes cadastrados estão com validade segura ou nenhum lote corresponde aos filtros selecionados.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsNewBatchModalOpen(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium transition"
              >
                Cadastrar Lote
              </button>
              <button
                onClick={handleSeedDemo}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                Gerar Lotes de Demonstração
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Status / Alerta</th>
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Lote</th>
                  <th className="py-3.5 px-4">Data de Validade</th>
                  <th className="py-3.5 px-4">Prazo Restante</th>
                  <th className="py-3.5 px-4">Qtd Disponível</th>
                  <th className="py-3.5 px-4">Valor em Risco</th>
                  <th className="py-3.5 px-4 text-center">Conferido?</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map((batch) => {
                  const isExpired = batch.alertLevel === 'EXPIRED';
                  const isWarning7 = batch.alertLevel === 'WARNING_7';
                  const isWarning30 = batch.alertLevel === 'WARNING_30';

                  let rowBg = 'hover:bg-slate-50/80';
                  if (isExpired) rowBg = 'bg-rose-50/40 hover:bg-rose-50/80';
                  else if (isWarning7) rowBg = 'bg-orange-50/40 hover:bg-orange-50/80';
                  else if (isWarning30) rowBg = 'bg-amber-50/30 hover:bg-amber-50/70';

                  return (
                    <tr key={batch.id} className={`transition ${rowBg}`}>
                      {/* Badge do Nível de Alerta */}
                      <td className="py-3.5 px-4">
                        {isExpired && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                            VENCIDO
                          </span>
                        )}
                        {isWarning7 && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                            <span className="w-2 h-2 rounded-full bg-orange-600" />
                            CRÍTICO (≤ 7d)
                          </span>
                        )}
                        {isWarning30 && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-2 h-2 rounded-full bg-amber-600" />
                            ATENÇÃO (≤ 30d)
                          </span>
                        )}
                        {batch.alertLevel === 'SAFE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            SEGURO
                          </span>
                        )}
                      </td>

                      {/* Nome do Produto */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-semibold text-slate-800">{batch.productName}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            {batch.barcode && <span>Cód: {batch.barcode}</span>}
                            {batch.categoryName && (
                              <span 
                                className="px-1.5 py-0.2 rounded text-[10px] font-medium text-white"
                                style={{ backgroundColor: batch.categoryColor || '#2563eb' }}
                              >
                                {batch.categoryName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Lote */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {batch.batchNumber}
                        {batch.supplierName && (
                          <div className="text-[11px] text-slate-400 font-sans truncate max-w-[120px]">
                            {batch.supplierName}
                          </div>
                        )}
                      </td>

                      {/* Data de Validade */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {formatDateBR(batch.expirationDate)}
                      </td>

                      {/* Dias Restantes */}
                      <td className="py-3.5 px-4">
                        {isExpired ? (
                          <span className="text-rose-600 font-bold">
                            Venceu há {Math.abs(batch.daysRemaining)} {Math.abs(batch.daysRemaining) === 1 ? 'dia' : 'dias'}
                          </span>
                        ) : batch.daysRemaining === 0 ? (
                          <span className="text-rose-600 font-extrabold animate-pulse">
                            VENCE HOJE!
                          </span>
                        ) : (
                          <span className={`font-semibold ${isWarning7 ? 'text-orange-600' : isWarning30 ? 'text-amber-700' : 'text-slate-600'}`}>
                            Faltam {batch.daysRemaining} {batch.daysRemaining === 1 ? 'dia' : 'dias'}
                          </span>
                        )}
                      </td>

                      {/* Qtd Disponível */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {batch.quantity} {batch.unit}
                      </td>

                      {/* Valor em Risco */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {(batch.costPrice * batch.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      {/* Marcar como Conferido */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleCheck(batch)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                            batch.isChecked
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-300'
                          }`}
                          title={batch.isChecked ? 'Lote já inspecionado. Clique para desmarcar.' : 'Clique para marcar como conferido'}
                        >
                          {batch.isChecked ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Conferido
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Pendente
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenLossModal(batch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
                          title="Dar baixa / registrar perda deste lote vencido ou avariado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Dar Baixa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Configurações dos Períodos de Alerta */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">Configurar Prazos de Alerta</h3>
              </div>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Alerta Amarelo (Atenção Inicial em dias)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="8"
                    max="180"
                    value={yellowDaysInput}
                    onChange={(e) => setYellowDaysInput(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                  <span className="text-sm text-slate-500 font-medium">dias antes de vencer</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Padrão: 30 dias (sinaliza itens para rotatividade rápida).</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Alerta Laranja (Vencimento Crítico em dias)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={orangeDaysInput}
                    onChange={(e) => setOrangeDaysInput(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                  <span className="text-sm text-slate-500 font-medium">dias antes de vencer</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Padrão: 7 dias (destaque para ações promocionais de balcão).</p>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                <strong>Alerta Vermelho:</strong> Sempre será ativado automaticamente quando o produto atingir a data de vencimento (0 dias restantes ou negativo).
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold shadow-md transition"
                >
                  {actionLoading ? 'Salvando...' : 'Salvar Regras'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cadastro de Novo Lote com Validade */}
      {isNewBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">Novo Lote com Validade</h3>
              </div>
              <button 
                onClick={() => setIsNewBatchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Selecione o Produto *
                </label>
                <select
                  value={newBatchProductId}
                  onChange={(e) => setNewBatchProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                >
                  <option value="">Escolha um produto cadastrado...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.barcode ? `(${p.barcode})` : ''} - Estoque: {p.stockQuantity} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Número do Lote *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: LOT-2026-A"
                    value={newBatchNumber}
                    onChange={(e) => setNewBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Data de Validade *
                  </label>
                  <input
                    type="date"
                    value={newBatchExpiration}
                    onChange={(e) => setNewBatchExpiration(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Quantidade do Lote *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={newBatchQuantity}
                    onChange={(e) => setNewBatchQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Fornecedor (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ambev, Nestlé..."
                    value={newBatchSupplier}
                    onChange={(e) => setNewBatchSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observações / Localização no Mercado
                </label>
                <input
                  type="text"
                  placeholder="Ex: Gôndola B, Prateleira 3 ou Depósito"
                  value={newBatchNotes}
                  onChange={(e) => setNewBatchNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="addToStock"
                  checked={newBatchAddToStock}
                  onChange={(e) => setNewBatchAddToStock(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="addToStock" className="text-xs text-slate-700 cursor-pointer">
                  <strong>Somar ao estoque geral:</strong> adicionar automaticamente esta quantidade ao estoque atual do produto.
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewBatchModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold shadow-md transition"
                >
                  {actionLoading ? 'Cadastrando...' : 'Cadastrar Lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Perda / Baixa de Produto Vencido */}
      {isLossModalOpen && selectedBatchForLoss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-900">Registrar Baixa de Lote</h3>
              </div>
              <button 
                onClick={() => setIsLossModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
              <p><strong>Produto:</strong> {selectedBatchForLoss.productName}</p>
              <p><strong>Lote:</strong> {selectedBatchForLoss.batchNumber} | <strong>Validade:</strong> {formatDateBR(selectedBatchForLoss.expirationDate)}</p>
              <p><strong>Disponível no lote:</strong> {selectedBatchForLoss.quantity} {selectedBatchForLoss.unit}</p>
            </div>

            <form onSubmit={handleConfirmLoss} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Quantidade a Descartar / Dar Baixa *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max={selectedBatchForLoss.quantity}
                  value={lossQuantity}
                  onChange={(e) => setLossQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-rose-600 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motivo da Baixa *
                </label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  required
                >
                  <option value="VENCIDO">Produto Vencido</option>
                  <option value="AVARIA">Avaria / Embalagem Rompida</option>
                  <option value="PERDA">Perda no Estoque</option>
                  <option value="OUTRO">Outro Motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Prejuízo Financeiro Estimado:
                </label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800">
                  {((Number(lossQuantity) || 0) * selectedBatchForLoss.costPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-xs font-normal text-slate-500 ml-2">
                    ({Number(lossQuantity) || 0} un × {selectedBatchForLoss.costPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} custo)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observações do Descarte
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mercadoria descartada no lixo orgânico/reciclável"
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLossModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold shadow-md transition"
                >
                  {actionLoading ? 'Registrando...' : 'Confirmar Baixa Definitiva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function CalendarAlertIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <line x1="12" x2="12" y1="14" y2="17" />
      <line x1="12" x2="12.01" y1="19" y2="19" />
    </svg>
  );
}
