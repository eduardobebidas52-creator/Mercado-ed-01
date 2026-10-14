/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  Boxes, 
  ShoppingCart, 
  Search, 
  Filter, 
  RefreshCw, 
  ArrowUpRight, 
  Plus, 
  FileText, 
  Copy, 
  Printer, 
  CheckCircle2, 
  AlertOctagon, 
  Package, 
  PackageCheck,
  DollarSign, 
  Edit3, 
  X, 
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  StockAlertItem, 
  ShoppingListResponse, 
  fetchStockAlerts, 
  fetchShoppingList 
} from '../api/alerts';
import { fetchCategories, Category, adjustStock, updateProduct } from '../api/products';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/EmptyState';

export const StockAlertsPage: React.FC = () => {
  const { token, isAuthenticated } = useAuth();

  const [alerts, setAlerts] = useState<StockAlertItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ZERO' | 'LOW'>('ALL');

  // Modais
  const [isShoppingListModalOpen, setIsShoppingListModalOpen] = useState(false);
  const [isQuickStockModalOpen, setIsQuickStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<StockAlertItem | null>(null);
  const [quickStockQuantity, setQuickStockQuantity] = useState('10');
  const [quickStockReason, setQuickStockReason] = useState('Reposição emergencial');

  // Modal para ajustar estoque mínimo e ideal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedProductForSettings, setSelectedProductForSettings] = useState<StockAlertItem | null>(null);
  const [inputMinStock, setInputMinStock] = useState('5');
  const [inputIdealStock, setInputIdealStock] = useState('20');

  const showFeedback = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsData, catsData] = await Promise.all([
        fetchStockAlerts({
          status: statusFilter,
          categoryId: selectedCategory || undefined,
          search: search.trim() || undefined,
        }),
        fetchCategories().catch(() => []),
      ]);

      setAlerts(alertsData);
      setCategories(catsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar alertas de estoque.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedCategory, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Contadores analíticos
  const zeroStockCount = alerts.filter(a => a.status === 'ZERO').length;
  const lowStockCount = alerts.filter(a => a.status === 'LOW').length;
  const totalSuggestedUnits = alerts.reduce((sum, a) => sum + a.suggestedReplenishment, 0);
  const totalEstimatedCost = alerts.reduce((sum, a) => sum + a.estimatedCost, 0);

  // Abrir Lista de Compras
  const handleOpenShoppingList = async () => {
    setActionLoading(true);
    try {
      const list = await fetchShoppingList();
      setShoppingList(list);
      setIsShoppingListModalOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar lista de compras');
    } finally {
      setActionLoading(false);
    }
  };

  // Copiar Lista de Compras para Área de Transferência (WhatsApp ou bloco de notas)
  const handleCopyShoppingList = () => {
    if (!shoppingList || shoppingList.items.length === 0) return;

    let text = `📋 *LISTA DE COMPRAS E REPOSIÇÃO - MERCADO*\n`;
    text += `Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `Total de Itens: ${shoppingList.totalItems} | Unidades: ${shoppingList.totalSuggestedUnits}\n`;
    text += `Orçamento Estimado: ${shoppingList.totalEstimatedBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    text += `-------------------------------------------\n\n`;

    shoppingList.items.forEach((item, idx) => {
      const tag = item.urgency === 'CRITICAL' ? '🔴 ZERADO' : '🟠 BAIXO';
      text += `${idx + 1}. [${tag}] *${item.productName}*\n`;
      text += `   - Comprar: *${item.suggestedQuantity} ${item.unit}*\n`;
      text += `   - Estoque atual: ${item.currentStock} | Mínimo: ${item.minStock}\n`;
      if (item.supplierName) text += `   - Fornecedor: ${item.supplierName}\n`;
      text += `   - Custo estimado: ${item.totalEstimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n`;
    });

    navigator.clipboard.writeText(text);
    showFeedback('Lista copiada para a área de transferência! Pronta para colar no WhatsApp.');
  };

  // Imprimir lista de compras
  const handlePrintShoppingList = () => {
    window.print();
  };

  // Entrada rápida de estoque
  const handleOpenQuickStock = (product: StockAlertItem) => {
    setSelectedProductForStock(product);
    setQuickStockQuantity(String(product.suggestedReplenishment || 10));
    setQuickStockReason('Reposição baseada no alerta de estoque');
    setIsQuickStockModalOpen(true);
  };

  const handleConfirmQuickStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForStock) return;

    const qty = Number(quickStockQuantity);
    if (!qty || qty <= 0) {
      alert('Informe uma quantidade válida para entrada.');
      return;
    }

    setActionLoading(true);
    try {
      await adjustStock(
        selectedProductForStock.id,
        {
          type: 'ENTRADA',
          quantity: qty,
          reason: quickStockReason,
        },
        token
      );

      setIsQuickStockModalOpen(false);
      setSelectedProductForStock(null);
      showFeedback(`Entrada de ${qty} ${selectedProductForStock.unit} registrada com sucesso!`);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao dar entrada no estoque');
    } finally {
      setActionLoading(false);
    }
  };

  // Ajustar Mínimo e Ideal
  const handleOpenSettings = (product: StockAlertItem) => {
    setSelectedProductForSettings(product);
    setInputMinStock(String(product.minStockAlert));
    setInputIdealStock(String(product.idealStock));
    setIsSettingsModalOpen(true);
  };

  const handleSaveProductSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForSettings) return;

    setActionLoading(true);
    try {
      await updateProduct(
        selectedProductForSettings.id,
        {
          minStockAlert: Number(inputMinStock) || 0,
        },
        token
      );

      setIsSettingsModalOpen(false);
      setSelectedProductForSettings(null);
      showFeedback('Parâmetros de estoque mínimo atualizados com sucesso!');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar parâmetros');
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

      {/* Cabeçalho da Aba Exclusiva */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 text-white rounded-2xl p-6 shadow-lg border border-rose-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/20 rounded-xl text-rose-400 border border-rose-500/30">
                <PackageAlertIcon className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Alerta de Estoque
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Aba Exclusiva
                  </span>
                </h1>
                <p className="text-slate-300 text-sm mt-0.5">
                  Prevenção de ruptura de mercadorias, identificação de itens zerados e geração automatizada de lista de compras.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleOpenShoppingList}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-900/30 transition"
            >
              <ShoppingCart className="w-4 h-4" />
              Gerar Lista de Compras
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Cards de Indicadores de Ruptura */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/60">
          <div 
            onClick={() => setStatusFilter(statusFilter === 'ZERO' ? 'ALL' : 'ZERO')}
            className={`cursor-pointer p-4 rounded-xl transition border ${
              statusFilter === 'ZERO'
                ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/30'
                : 'bg-slate-800/60 border-rose-500/30 hover:bg-rose-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Produtos Zerados</span>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-400">{zeroStockCount}</span>
              <span className="text-xs text-rose-300">sem mercadoria</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Ruptura total de gôndola</p>
          </div>

          <div 
            onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')}
            className={`cursor-pointer p-4 rounded-xl transition border ${
              statusFilter === 'LOW'
                ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-slate-800/60 border-amber-500/30 hover:bg-amber-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Abaixo do Mínimo</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-400">{lowStockCount}</span>
              <span className="text-xs text-amber-300">em ponto de pedido</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Fazer pedido com urgência</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Unidades a Comprar</span>
              <Boxes className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{totalSuggestedUnits}</span>
              <span className="text-xs text-slate-400">un sugeridas</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Para atingir o estoque seguro</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Investimento Estimado</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400">
                {totalEstimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Baseado nos preços de custo</p>
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
              placeholder="Buscar por produto ou código de barras..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
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
            Todos com Alerta ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter('ZERO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              statusFilter === 'ZERO'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Apenas Zerados ({zeroStockCount})
          </button>
          <button
            onClick={() => setStatusFilter('LOW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              statusFilter === 'LOW'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Abaixo do Mínimo ({lowStockCount})
          </button>
        </div>
      </div>

      {/* Tabela de Produtos com Alerta de Estoque */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-rose-500" />
            <p className="text-sm font-medium">Analisando níveis de estoque e estoque mínimo...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center">
            <PackageCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Estoque Saudável! Nenhum produto em alerta</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Todos os produtos cadastrados estão com estoque acima do nível mínimo configurado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Gravidade</th>
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4 text-center">Estoque Atual</th>
                  <th className="py-3.5 px-4 text-center">Estoque Mínimo</th>
                  <th className="py-3.5 px-4 text-center">Estoque Ideal</th>
                  <th className="py-3.5 px-4 text-center">Sugestão de Reposição</th>
                  <th className="py-3.5 px-4">Custo Estimado</th>
                  <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map((item) => {
                  const isZero = item.status === 'ZERO';

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition ${
                        isZero 
                          ? 'bg-rose-50/50 hover:bg-rose-50/90' 
                          : 'bg-amber-50/30 hover:bg-amber-50/70'
                      }`}
                    >
                      {/* Badge Gravidade */}
                      <td className="py-3.5 px-4">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                            ZERADO (0)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-2 h-2 rounded-full bg-amber-600" />
                            ABAIXO DO MÍNIMO
                          </span>
                        )}
                      </td>

                      {/* Nome do Produto */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            {item.barcode && <span>Cód: {item.barcode}</span>}
                            {item.categoryName && (
                              <span 
                                className="px-1.5 py-0.2 rounded text-[10px] font-medium text-white"
                                style={{ backgroundColor: item.categoryColor || '#2563eb' }}
                              >
                                {item.categoryName}
                              </span>
                            )}
                            {item.supplierName && (
                              <span className="text-slate-400">Fornec: {item.supplierName}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Estoque Atual */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-black ${
                          isZero 
                            ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/30' 
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                          {item.stockQuantity} {item.unit}
                        </span>
                      </td>

                      {/* Estoque Mínimo */}
                      <td className="py-3.5 px-4 text-center font-medium text-slate-600">
                        {item.minStockAlert} {item.unit}
                      </td>

                      {/* Estoque Ideal */}
                      <td className="py-3.5 px-4 text-center font-medium text-slate-500">
                        {item.idealStock > 0 ? `${item.idealStock} ${item.unit}` : '—'}
                      </td>

                      {/* Sugestão de Reposição */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                          <Plus className="w-3.5 h-3.5" />
                          {item.suggestedReplenishment} {item.unit}
                        </span>
                      </td>

                      {/* Custo Estimado */}
                      <td className="py-3.5 px-4 text-slate-700 font-semibold">
                        {item.estimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        <div className="text-[11px] text-slate-400 font-normal">
                          {item.costPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /un
                        </div>
                      </td>

                      {/* Ações Rápidas */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenQuickStock(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
                            title="Dar entrada imediata de estoque para este produto"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Entrada
                          </button>

                          <button
                            onClick={() => handleOpenSettings(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
                            title="Ajustar estoque mínimo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Lista de Compras / Sugestão de Reposição */}
      {isShoppingListModalOpen && shoppingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Lista Sugerida de Compras</h3>
                  <p className="text-xs text-slate-500">Baseada nos produtos zerados e abaixo do mínimo</p>
                </div>
              </div>
              <button 
                onClick={() => setIsShoppingListModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo do Pedido */}
            <div className="grid grid-cols-3 gap-3 my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex-shrink-0 text-center">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total de Itens</span>
                <p className="text-lg font-bold text-slate-800">{shoppingList.totalItems}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Volume Total</span>
                <p className="text-lg font-bold text-indigo-700">{shoppingList.totalSuggestedUnits} un</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Orçamento Previsto</span>
                <p className="text-lg font-bold text-emerald-600">
                  {shoppingList.totalEstimatedBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>

            {/* Tabela da Lista com Scroll */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">Item / Situação</th>
                    <th className="py-2.5 px-3">Fornecedor</th>
                    <th className="py-2.5 px-3 text-center">Atual</th>
                    <th className="py-2.5 px-3 text-center">Comprar</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shoppingList.items.map((item, idx) => (
                    <tr key={item.productId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{idx + 1}. {item.productName}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.urgency === 'CRITICAL' ? (
                            <span className="text-rose-600 font-bold">🔴 ZERADO</span>
                          ) : (
                            <span className="text-amber-700 font-medium">🟠 MÍNIMO: {item.minStock}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {item.supplierName || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/50">
                        {item.suggestedQuantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                        {item.totalEstimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ações da Lista */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyShoppingList}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Lista (WhatsApp)
                </button>

                <button
                  type="button"
                  onClick={handlePrintShoppingList}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsShoppingListModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-medium transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Entrada Rápida de Estoque */}
      {isQuickStockModalOpen && selectedProductForStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600">
                <Plus className="w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-900">Entrada Rápida de Estoque</h3>
              </div>
              <button 
                onClick={() => setIsQuickStockModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <p><strong>Produto:</strong> {selectedProductForStock.name}</p>
              <p><strong>Estoque Atual:</strong> {selectedProductForStock.stockQuantity} {selectedProductForStock.unit}</p>
              <p><strong>Mínimo:</strong> {selectedProductForStock.minStockAlert} {selectedProductForStock.unit} | <strong>Reposição sugerida:</strong> {selectedProductForStock.suggestedReplenishment} {selectedProductForStock.unit}</p>
            </div>

            <form onSubmit={handleConfirmQuickStock} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Quantidade a Adicionar ({selectedProductForStock.unit}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={quickStockQuantity}
                  onChange={(e) => setQuickStockQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motivo / Nota de Entrada
                </label>
                <input
                  type="text"
                  value={quickStockReason}
                  onChange={(e) => setQuickStockReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                O novo estoque total será de <strong>{selectedProductForStock.stockQuantity + (Number(quickStockQuantity) || 0)} {selectedProductForStock.unit}</strong>.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsQuickStockModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-md transition"
                >
                  {actionLoading ? 'Registrando...' : 'Confirmar Entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ajustar Estoque Mínimo */}
      {isSettingsModalOpen && selectedProductForSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Parâmetros de Estoque</h3>
              </div>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <strong>Produto:</strong> {selectedProductForSettings.name} ({selectedProductForSettings.unit})
            </div>

            <form onSubmit={handleSaveProductSettings} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Estoque Mínimo para Disparar Alerta *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={inputMinStock}
                  onChange={(e) => setInputMinStock(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">O sistema alertará em laranja quando o estoque for menor ou igual a este valor.</p>
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md transition"
                >
                  {actionLoading ? 'Salvando...' : 'Salvar Parâmetros'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function PackageAlertIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      <line x1="12" x2="12" y1="7" y2="7.01" />
    </svg>
  );
}
