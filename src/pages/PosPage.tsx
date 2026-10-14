/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShoppingCart, 
  Barcode, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  DollarSign, 
  CreditCard, 
  QrCode, 
  BookOpen, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Unlock, 
  ArrowDownRight, 
  ArrowUpRight, 
  RotateCcw,
  RefreshCw,
  X,
  User,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  CashRegister, 
  Sale, 
  TodaySalesMetrics, 
  fetchCurrentCashRegister, 
  openCashRegister, 
  closeCashRegister, 
  addCashTransaction, 
  createSale, 
  fetchSales, 
  cancelSale, 
  fetchTodaySalesMetrics 
} from '../api/pos';
import { Product, fetchProducts } from '../api/products';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export const PosPage: React.FC = () => {
  const { user, token, isAuthenticated } = useAuth();

  // Estado do Caixa
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [loadingRegister, setLoadingRegister] = useState(true);

  // Catálogo de Produtos para busca rápida
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Carrinho de Vendas
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<string>('0,00');
  const [paymentMethod, setPaymentMethod] = useState<'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'FIADO'>('DINHEIRO');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Venda Concluída (Comprovante)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Histórico de Vendas
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [metricsToday, setMetricsToday] = useState<TodaySalesMetrics | null>(null);

  // Modais de Caixa
  const [isOpenRegisterModalOpen, setIsOpenRegisterModalOpen] = useState(false);
  const [isCloseRegisterModalOpen, setIsCloseRegisterModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'SUPRIMENTO' | 'SANGRIA'>('SANGRIA');

  // Campos de Modais de Caixa
  const [initialBalanceInput, setInitialBalanceInput] = useState('100,00');
  const [countedBalanceInput, setCountedBalanceInput] = useState('');
  const [txAmountInput, setTxAmountInput] = useState('');
  const [txReasonInput, setTxReasonInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Cancelamento
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('Cancelamento solicitado pelo cliente');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  // Carrega status do caixa e catálogo
  const loadRegisterAndMetrics = useCallback(async () => {
    setLoadingRegister(true);
    try {
      const [currentReg, metrics, prods, sales] = await Promise.all([
        fetchCurrentCashRegister(token),
        fetchTodaySalesMetrics(token).catch(() => null),
        fetchProducts().catch(() => []),
        fetchSales({ limit: 15 }, token).catch(() => []),
      ]);

      setRegister(currentReg);
      setMetricsToday(metrics);
      setCatalog(prods);
      setRecentSales(sales);
    } catch {
      // Ignora falha inicial
    } finally {
      setLoadingRegister(false);
    }
  }, [token]);

  useEffect(() => {
    loadRegisterAndMetrics();
  }, [loadRegisterAndMetrics]);

  // Busca rápida de produtos ao digitar ou bipar código
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const term = searchTerm.trim().toLowerCase();
    const matched = catalog.filter(p => 
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      p.name.toLowerCase().includes(term)
    );
    setSearchResults(matched.slice(0, 6));
  }, [searchTerm, catalog]);

  // Cálculos do Carrinho
  const subtotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);
  const discountVal = parseFloat(discount.replace(',', '.')) || 0;
  const total = Math.max(0, subtotal - discountVal);
  const amountPaidVal = parseFloat(amountPaidInput.replace(',', '.')) || (paymentMethod === 'DINHEIRO' ? 0 : total);
  const changeVal = paymentMethod === 'DINHEIRO' ? Math.max(0, amountPaidVal - total) : 0;

  // Adicionar Produto ao Carrinho
  const handleAddToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          totalPrice: Number((newQty * updated[existingIdx].unitPrice).toFixed(2)),
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product,
            quantity,
            unitPrice: product.sellingPrice,
            totalPrice: Number((quantity * product.sellingPrice).toFixed(2)),
          },
        ];
      }
    });

    setSearchTerm('');
    setSearchResults([]);
    barcodeInputRef.current?.focus();
  };

  // Tratar bipagem direta (Enter no campo de busca)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Procura exato por código de barras
    const exactBarcode = catalog.find(p => p.barcode === searchTerm.trim());
    if (exactBarcode) {
      handleAddToCart(exactBarcode, 1);
      return;
    }

    // Se houver apenas 1 resultado na busca, adiciona direto
    if (searchResults.length === 1) {
      handleAddToCart(searchResults[0], 1);
      return;
    }
  };

  // Alterar Quantidade no Carrinho
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const newQty = Math.max(0.1, Number((item.quantity + delta).toFixed(3)));
            return {
              ...item,
              quantity: newQty,
              totalPrice: Number((newQty * item.unitPrice).toFixed(2)),
            };
          }
          return item;
        })
        .filter(item => item.quantity > 0);
    });
  };

  // Remover Item do Carrinho
  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Limpar Carrinho
  const handleClearCart = () => {
    if (cart.length > 0 && !window.confirm('Deseja cancelar os itens da venda atual?')) {
      return;
    }
    setCart([]);
    setDiscount('0,00');
    setAmountPaidInput('');
    setCustomerName('');
    setSaleError(null);
  };

  // Finalizar Venda
  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;
    setSaleError(null);
    setSubmittingSale(true);

    try {
      if (paymentMethod === 'DINHEIRO' && amountPaidVal < total) {
        throw new Error(`Valor em dinheiro insuficiente. Total: ${formatCurrency(total)}, Recebido: ${formatCurrency(amountPaidVal)}.`);
      }

      if (paymentMethod === 'FIADO' && !customerName.trim()) {
        throw new Error('Para vendas no fiado, informe o nome do cliente.');
      }

      const saleData = {
        registerId: register?.id,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        discount: discountVal,
        paymentMethod,
        amountPaid: amountPaidVal || total,
        customerName: customerName.trim() || undefined,
      };

      const result = await createSale(saleData, token);

      setCompletedSale(result);
      setCart([]);
      setDiscount('0,00');
      setAmountPaidInput('');
      setCustomerName('');
      await loadRegisterAndMetrics();
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : 'Falha ao finalizar venda.');
    } finally {
      setSubmittingSale(false);
    }
  };

  // Abrir Caixa
  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    try {
      const bal = parseFloat(initialBalanceInput.replace(',', '.'));
      if (isNaN(bal) || bal < 0) throw new Error('Valor inicial inválido.');

      const opened = await openCashRegister(bal, 'Abertura de turno normal', token);
      setRegister(opened);
      setIsOpenRegisterModalOpen(false);
      await loadRegisterAndMetrics();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Falha ao abrir caixa.');
    }
  };

  // Fechar Caixa
  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!register) return;
    setModalError(null);
    try {
      const counted = parseFloat(countedBalanceInput.replace(',', '.'));
      if (isNaN(counted) || counted < 0) throw new Error('Valor contado inválido.');

      const closed = await closeCashRegister(register.id, counted, 'Fechamento de turno', token);
      setRegister(closed);
      setIsCloseRegisterModalOpen(false);
      await loadRegisterAndMetrics();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Falha ao fechar caixa.');
    }
  };

  // Movimentação de Caixa (Sangria/Suprimento)
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!register) return;
    setModalError(null);
    try {
      const amt = parseFloat(txAmountInput.replace(',', '.'));
      if (isNaN(amt) || amt <= 0) throw new Error('Valor deve ser maior que zero.');
      if (!txReasonInput.trim()) throw new Error('Informe o motivo.');

      await addCashTransaction(register.id, transactionType, amt, txReasonInput.trim(), token);
      setIsTransactionModalOpen(false);
      setTxAmountInput('');
      setTxReasonInput('');
      await loadRegisterAndMetrics();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Falha ao registrar movimentação.');
    }
  };

  // Cancelar Venda
  const handleCancelSale = async (saleId: string) => {
    if (!cancelReasonInput.trim()) {
      alert('Informe o motivo do cancelamento.');
      return;
    }
    try {
      await cancelSale(saleId, cancelReasonInput.trim(), token);
      setCancellingSaleId(null);
      await loadRegisterAndMetrics();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao cancelar venda.');
    }
  };

  // Atalhos de teclado (F2 para finalizar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0 && register?.status === 'OPEN') {
          handleFinalizeSale();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, register, amountPaidVal, total]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Barra Superior de Status do Caixa e Operador */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Operador e Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            {user?.name.charAt(0).toUpperCase() || 'O'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">
                {user?.name || 'Operador'}
              </span>
              <StatusBadge
                status={register?.status === 'OPEN' ? 'success' : 'warning'}
                label={register?.status === 'OPEN' ? 'Caixa Aberto' : 'Caixa Fechado'}
              />
            </div>
            <div className="text-[11px] text-slate-500">
              {register?.status === 'OPEN'
                ? `Aberto às ${new Date(register.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Fundo: ${formatCurrency(register.openingBalance)}`
                : 'Abra o turno para iniciar as vendas'}
            </div>
          </div>
        </div>

        {/* Métricas do Dia */}
        <div className="hidden sm:flex items-center gap-6 text-xs text-slate-600 border-x border-slate-100 px-6">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Atendimentos Hoje</div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {metricsToday?.totalSalesCount || 0}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Faturamento Hoje</div>
            <div className="text-base font-bold text-emerald-700 font-mono">
              {formatCurrency(metricsToday?.totalRevenue || 0)}
            </div>
          </div>
        </div>

        {/* Ações de Caixa */}
        <div className="flex items-center gap-2">
          {register?.status === 'OPEN' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setTransactionType('SANGRIA');
                  setTxAmountInput('');
                  setTxReasonInput('');
                  setModalError(null);
                  setIsTransactionModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                title="Retirar ou injetar dinheiro"
              >
                <ArrowDownRight size={14} className="text-rose-600" />
                <span>Sangria / Suprimento</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCountedBalanceInput('');
                  setModalError(null);
                  setIsCloseRegisterModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Lock size={14} />
                <span>Fechar Caixa</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setInitialBalanceInput('100,00');
                setModalError(null);
                setIsOpenRegisterModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Unlock size={14} />
              <span>Abrir Turno de Caixa</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Clock size={14} />
            <span>{showHistory ? 'Voltar ao PDV' : 'Histórico'}</span>
          </button>
        </div>
      </div>

      {/* Se o Caixa estiver FECHADO */}
      {register?.status !== 'OPEN' && !showHistory && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-12">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
            <Lock size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Turno de Caixa Fechado
          </h3>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Para iniciar o atendimento aos clientes e registrar vendas com baixa no estoque, realize a abertura do caixa informando o valor inicial do fundo de troco.
          </p>
          <button
            type="button"
            onClick={() => {
              setInitialBalanceInput('100,00');
              setModalError(null);
              setIsOpenRegisterModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Unlock size={15} />
            <span>Abrir Caixa Agora</span>
          </button>
        </div>
      )}

      {/* Histórico de Vendas */}
      {showHistory && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock size={16} className="text-blue-600" />
              <span>Histórico de Vendas Recentes</span>
            </h3>
            <span className="text-xs text-slate-500">Últimas 15 operações</span>
          </div>

          {recentSales.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={ShoppingCart}
                title="Nenhuma venda registrada ainda"
                description="As vendas realizadas no balcão aparecerão neste histórico com todos os detalhes e comprovantes."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Venda #</th>
                    <th className="py-3 px-4">Horário</th>
                    <th className="py-3 px-4">Operador</th>
                    <th className="py-3 px-4">Pagamento</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{s.saleNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(s.createdAt).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {s.operatorName || 'Operador'}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(s.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge
                          status={s.status === 'COMPLETED' ? 'success' : 'error'}
                          label={s.status === 'COMPLETED' ? 'Concluída' : 'Cancelada'}
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {s.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => setCancellingSaleId(s.id)}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-medium"
                          >
                            Cancelar
                          </button>
                        )}
                        {s.status === 'CANCELLED' && s.cancellationReason && (
                          <span className="text-[10px] text-slate-400 italic">
                            {s.cancellationReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Frente de Caixa Ativa (PDV) */}
      {register?.status === 'OPEN' && !showHistory && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Coluna Esquerda: Bipagem, Busca e Carrinho (8 colunas) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Barra de Bipagem de Código de Barras / Busca */}
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Barcode size={20} className="text-blue-600" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Bipe o código de barras ou digite o nome do produto..."
                className="w-full pl-11 pr-24 py-3 text-sm bg-white border-2 border-slate-200 focus:border-blue-600 rounded-xl focus:outline-none transition-all shadow-xs text-slate-900"
              />
              <button
                type="submit"
                className="absolute inset-y-1.5 right-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>Adicionar</span>
              </button>

              {/* Dropdown de Resultados da Busca */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden divide-y divide-slate-100">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddToCart(p, 1)}
                      className="w-full p-3 text-left hover:bg-blue-50 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {p.barcode || 'Sem código'} • Estoque: {p.stockQuantity} {p.unit}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-blue-700">
                        {formatCurrency(p.sellingPrice)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Tabela do Carrinho de Compras */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden flex flex-col h-[520px]">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-2">
                  <ShoppingCart size={16} className="text-blue-600" />
                  <span>Itens no Carrinho ({cart.length})</span>
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-rose-600 hover:text-rose-800 text-[11px] font-medium"
                  >
                    Cancelar Venda
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <Barcode size={36} className="text-slate-300 mb-2 stroke-1" />
                    <p className="text-xs font-medium text-slate-600">
                      Nenhum item adicionado à venda
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Bipe o leitor de código de barras ou use a barra de busca acima para incluir mercadorias.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {cart.map((item, idx) => (
                      <div
                        key={item.product.id}
                        className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-white flex items-center justify-between gap-3 text-xs"
                      >
                        {/* Numeração e Nome */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {item.product.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {formatCurrency(item.unitPrice)} / {item.product.unit}
                            </div>
                          </div>
                        </div>

                        {/* Controle de Quantidade */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-10 text-center font-bold text-slate-900 font-mono text-xs">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Preço Total do Item */}
                        <div className="text-right w-20 shrink-0 font-bold text-slate-900">
                          {formatCurrency(item.totalPrice)}
                        </div>

                        {/* Botão Remover */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                          title="Remover item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Resumo, Formas de Pagamento e Finalização (4 ou 5 colunas) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Resumo da Venda
              </h3>

              {saleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{saleError}</span>
                </div>
              )}

              {/* Valores */}
              <div className="space-y-2 text-xs text-slate-600 border-b border-slate-100 pb-3">
                <div className="flex justify-between">
                  <span>Subtotal ({cart.length} itens)</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Desconto (R$)</span>
                  <input
                    type="text"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-20 px-2 py-1 text-right text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-600 font-semibold text-slate-900"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Total Grande de Destaque */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                <div className="text-[11px] uppercase font-bold text-emerald-800 tracking-wider">
                  Total a Pagar
                </div>
                <div className="text-3xl font-extrabold text-emerald-700 tracking-tight font-mono mt-0.5">
                  {formatCurrency(total)}
                </div>
              </div>

              {/* Formas de Pagamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('DINHEIRO')}
                    className={`p-2.5 rounded-lg border font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      paymentMethod === 'DINHEIRO'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign size={16} />
                    <span className="text-[11px]">Dinheiro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PIX')}
                    className={`p-2.5 rounded-lg border font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      paymentMethod === 'PIX'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode size={16} />
                    <span className="text-[11px]">PIX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('DEBITO')}
                    className={`p-2.5 rounded-lg border font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      paymentMethod === 'DEBITO'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard size={16} />
                    <span className="text-[11px]">Débito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDITO')}
                    className={`p-2.5 rounded-lg border font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      paymentMethod === 'CREDITO'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard size={16} />
                    <span className="text-[11px]">Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('FIADO')}
                    className={`p-2.5 rounded-lg border font-semibold flex flex-col items-center justify-center gap-1 transition-all col-span-2 ${
                      paymentMethod === 'FIADO'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <BookOpen size={16} />
                    <span className="text-[11px]">Fiado (Caderneta)</span>
                  </button>
                </div>
              </div>

              {/* Se for Dinheiro: Valor Recebido e Troco */}
              {paymentMethod === 'DINHEIRO' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">Valor Recebido:</label>
                    <input
                      type="text"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      placeholder={total.toFixed(2)}
                      className="w-24 px-2 py-1 text-right text-xs border border-slate-300 rounded font-bold text-slate-900 bg-white"
                    />
                  </div>

                  {/* Botões de sugestão rápida */}
                  <div className="flex gap-1 justify-end text-[10px]">
                    <button
                      type="button"
                      onClick={() => setAmountPaidInput(total.toFixed(2))}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                    >
                      Exato
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountPaidInput(String(Math.ceil(total / 10) * 10))}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                    >
                      R$ {Math.ceil(total / 10) * 10}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountPaidInput(String(Math.ceil(total / 50) * 50 || 50))}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                    >
                      R$ {Math.ceil(total / 50) * 50 || 50}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs font-bold">
                    <span className="text-slate-600">Troco:</span>
                    <span className={`font-mono text-sm ${changeVal > 0 ? 'text-blue-700' : 'text-slate-900'}`}>
                      {formatCurrency(changeVal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Se for Fiado: Nome do Cliente */}
              {paymentMethod === 'FIADO' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do Cliente na Caderneta *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Seu João (Rua 4)"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              )}

              {/* Botão Finalizar Venda */}
              <button
                type="button"
                disabled={cart.length === 0 || submittingSale}
                onClick={handleFinalizeSale}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                <span>{submittingSale ? 'Processando Venda...' : 'FINALIZAR VENDA (F2)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal de Abertura de Caixa */}
      {isOpenRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Unlock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Abertura de Turno de Caixa</h3>
                  <p className="text-[11px] text-slate-500">Operador: {user?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenRegisterModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOpenRegister} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Fundo de Troco Inicial (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={initialBalanceInput}
                  onChange={(e) => setInitialBalanceInput(e.target.value)}
                  placeholder="100,00"
                  className="w-full px-3 py-2 text-sm font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Valor em cédulas e moedas disponível na gaveta para troco.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpenRegisterModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Confirmar Abertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal de Fechamento de Caixa */}
      {isCloseRegisterModalOpen && register && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                  <Lock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Fechamento de Caixa</h3>
                  <p className="text-[11px] text-slate-500">Conferência final do turno</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseRegisterModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCloseRegister} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor em Dinheiro Contado na Gaveta (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={countedBalanceInput}
                  onChange={(e) => setCountedBalanceInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Conte o dinheiro físico em gaveta. O sistema calculará a diferença automaticamente.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCloseRegisterModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Encerrar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal de Sangria e Suprimento */}
      {isTransactionModalOpen && register && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">
                Movimentação Avulsa de Caixa
              </h3>
              <button
                type="button"
                onClick={() => setIsTransactionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de Operação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransactionType('SANGRIA')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      transactionType === 'SANGRIA'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Sangria (Retirada)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType('SUPRIMENTO')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      transactionType === 'SUPRIMENTO'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Suprimento (Entrada)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={txAmountInput}
                  onChange={(e) => setTxAmountInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Motivo / Justificativa *
                </label>
                <input
                  type="text"
                  required
                  value={txReasonInput}
                  onChange={(e) => setTxReasonInput(e.target.value)}
                  placeholder="Ex: Envio para cofre, reforço de moedas, etc."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Comprovante de Venda (Impressão Cupom Não Fiscal) */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cupom Estilo Térmico */}
            <div className="p-6 font-mono text-xs text-slate-800 space-y-3 print:p-0">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="font-bold text-base tracking-tight font-sans text-slate-900">
                  MERCADO
                </div>
                <div className="text-[11px] text-slate-500">Comprovante de Venda</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {new Date(completedSale.createdAt).toLocaleString('pt-BR')}
                </div>
                <div className="text-[10px] text-slate-500">
                  Venda #{completedSale.saleNumber} • Operador: {user?.name}
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 max-h-48 overflow-y-auto">
                {completedSale.items?.map((it, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <div className="truncate pr-2">
                      {it.quantity} {it.unit} x {it.productName}
                    </div>
                    <div className="shrink-0 font-bold">{formatCurrency(it.totalPrice)}</div>
                  </div>
                ))}
              </div>

              {/* Totais */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(completedSale.subtotal)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Desconto:</span>
                    <span>-{formatCurrency(completedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(completedSale.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>Pagamento:</span>
                  <span className="font-bold">{completedSale.paymentMethod}</span>
                </div>
                {completedSale.paymentMethod === 'DINHEIRO' && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Valor Recebido:</span>
                      <span>{formatCurrency(completedSale.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-blue-700">
                      <span>Troco:</span>
                      <span>{formatCurrency(completedSale.changeAmount)}</span>
                    </div>
                  </>
                )}
                {completedSale.customerName && (
                  <div className="flex justify-between text-slate-600">
                    <span>Cliente:</span>
                    <span className="font-bold">{completedSale.customerName}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-400">
                Obrigado pela preferência! Volte sempre.
              </div>
            </div>

            {/* Ações do Comprovante */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 border border-slate-300 text-slate-700 hover:bg-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer size={14} />
                <span>Imprimir</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus size={14} />
                <span>Nova Venda</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento de Venda */}
      {cancellingSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Confirmar Cancelamento da Venda
            </h3>
            <p className="text-xs text-slate-600">
              Os produtos vendidos serão estornados automaticamente de volta para a quantidade de estoque.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Motivo do Cancelamento *
              </label>
              <input
                type="text"
                required
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancellingSaleId(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleCancelSale(cancellingSaleId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Confirmar Cancelamento e Estorno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
