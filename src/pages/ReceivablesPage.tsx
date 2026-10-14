/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Receipt,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Printer,
  Calendar,
  CreditCard,
  User,
  Phone,
  FileText,
  X,
  History,
  Filter,
  ArrowDownCircle,
  Copy,
} from 'lucide-react';
import { CustomerDebt, DebtPayment } from '../types/index.js';
import { fetchDebts, receivePayment, fetchPaymentReceipts } from '../api/credit.js';

interface ReceivablesPageProps {
  token: string | null;
  onNavigateToCustomers?: () => void;
  onNavigateToCreditAlerts?: () => void;
}

export function ReceivablesPage({
  token,
  onNavigateToCustomers,
  onNavigateToCreditAlerts,
}: ReceivablesPageProps) {
  const [activeTab, setActiveTab] = useState<'open_debts' | 'receipts_history'>('open_debts');
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [totalDebts, setTotalDebts] = useState(0);
  const [receipts, setReceipts] = useState<DebtPayment[]>([]);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal de Baixa de Pagamento
  const [selectedDebt, setSelectedDebt] = useState<CustomerDebt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO'>('DINHEIRO');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [newReceipt, setNewReceipt] = useState<DebtPayment | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const loadDebts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDebts(
        {
          search: searchTerm,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        },
        token
      );
      setDebts(res.debts);
      setTotalDebts(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar contas de fiado.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, token]);

  const loadReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPaymentReceipts({ search: searchTerm }, token);
      setReceipts(res.receipts);
      setTotalReceipts(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar recibos emitidos.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'open_debts') {
        loadDebts();
      } else {
        loadReceipts();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, loadDebts, loadReceipts]);

  const handleOpenPaymentModal = (debt: CustomerDebt) => {
    setSelectedDebt(debt);
    setPaymentAmount(debt.remainingAmount.toFixed(2).replace('.', ','));
    setPaymentMethod('DINHEIRO');
    setPaymentNotes('');
    setNewReceipt(null);
    setCopiedReceipt(false);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    const val = parseFloat(paymentAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setError('Informe um valor de pagamento válido.');
      return;
    }

    try {
      setSubmittingPayment(true);
      setError(null);
      const receipt = await receivePayment(
        {
          customerId: selectedDebt.customerId,
          debtId: selectedDebt.id,
          amount: val,
          paymentMethod,
          notes: paymentNotes || `Recebimento de fiado - ${selectedDebt.description}`,
        },
        token
      );

      setNewReceipt(receipt);
      setSuccessMessage(`Pagamento de R$ ${val.toFixed(2)} registrado com sucesso! Recibo #${receipt.receiptNumber}`);
      await loadDebts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar pagamento.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleCopyReceiptText = (receipt: DebtPayment) => {
    const text = `
MERCADO - COMPROVANTE DE PAGAMENTO DE FIADO
==========================================
Recibo Nº: #${receipt.receiptNumber}
Data/Hora: ${new Date(receipt.createdAt).toLocaleString('pt-BR')}
Cliente: ${receipt.customerName}
Operador: ${receipt.operatorName}
------------------------------------------
Valor Recebido: ${formatCurrency(receipt.amount)}
Forma de Pagamento: ${receipt.paymentMethod}
Saldo Anterior: ${formatCurrency(receipt.previousDebt)}
Novo Saldo Devedor: ${formatCurrency(receipt.remainingDebt)}
------------------------------------------
Obrigado pela preferência e confiança!
==========================================
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Fiado e Recebimentos</h1>
              <p className="text-sm text-slate-500">
                Baixa de contas, quitação parcial ou total, histórico e emissão de recibos profissionais
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToCustomers && (
            <button
              onClick={onNavigateToCustomers}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <User className="w-4 h-4 text-slate-500" />
              <span>Ver Clientes</span>
            </button>
          )}

          {onNavigateToCreditAlerts && (
            <button
              onClick={onNavigateToCreditAlerts}
              className="px-3.5 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Alerta de Inadimplência</span>
            </button>
          )}
        </div>
      </div>

      {/* Alertas e Mensagens */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navegação entre Abas Principais */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveTab('open_debts')}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'open_debts'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Contas a Receber (Em Aberto / Vencidas)</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts_history')}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'receipts_history'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Histórico de Recibos Emitidos</span>
        </button>
      </div>

      {/* Conteúdo: Contas a Receber */}
      {activeTab === 'open_debts' && (
        <div className="space-y-4">
          {/* Barra de Busca e Filtros */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, telefone ou descrição da compra..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-800"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Em Aberto
              </button>

              <button
                onClick={() => setStatusFilter('OVERDUE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'OVERDUE'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Vencidas
              </button>

              <button
                onClick={() => setStatusFilter('PAID')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'PAID'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Pagas / Quitadas
              </button>

              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Tabela de Contas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">Carregando contas a receber...</p>
              </div>
            ) : debts.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h3 className="text-base font-bold text-slate-700 mb-1">Nenhuma conta encontrada</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Não foram encontradas contas de fiado com os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4">Descrição da Compra</th>
                      <th className="py-3.5 px-4 text-center">Vencimento</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Valor Original</th>
                      <th className="py-3.5 px-4 text-right">Saldo em Aberto</th>
                      <th className="py-3.5 px-4 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {debts.map(debt => {
                      const isOverdue = debt.status === 'OVERDUE';
                      const isPaid = debt.status === 'PAID';

                      return (
                        <tr
                          key={debt.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isPaid ? 'opacity-60 bg-slate-50/40' : isOverdue ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{debt.customerName}</div>
                            {debt.customerPhone && (
                              <span className="text-xs text-slate-400">{debt.customerPhone}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-700 block text-xs">
                              {debt.description}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Lançado em: {new Date(debt.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`text-xs font-bold ${
                                isOverdue ? 'text-rose-600' : 'text-slate-700'
                              }`}
                            >
                              {new Date(debt.dueDate).toLocaleDateString('pt-BR')}
                            </span>
                            {isOverdue && (
                              <span className="block text-[10px] text-rose-500 font-bold">
                                Vencida ({debt.daysOverdue}d)
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isPaid ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                PAGO
                              </span>
                            ) : isOverdue ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                                VENCIDO
                              </span>
                            ) : debt.paidAmount > 0 ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                PARCIAL
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                PENDENTE
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right text-slate-600 font-medium">
                            {formatCurrency(debt.originalAmount)}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`font-black text-sm ${
                                isPaid ? 'text-slate-400' : 'text-rose-600'
                              }`}
                            >
                              {formatCurrency(debt.remainingAmount)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {!isPaid && (
                              <button
                                onClick={() => handleOpenPaymentModal(debt)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1 mx-auto"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Receber</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo: Histórico de Recibos Emitidos */}
      {activeTab === 'receipts_history' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente ou operador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-800"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">
              Total de Comprovantes: {totalReceipts}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">Carregando histórico de recibos...</p>
              </div>
            ) : receipts.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h3 className="text-base font-bold text-slate-700 mb-1">Nenhum recibo emitido</h3>
                <p className="text-sm text-slate-400">
                  Os recibos emitidos em baixas de fiado ficarão salvos aqui com comprovação.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <th className="py-3.5 px-4">Recibo Nº</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4">Forma de Pagamento</th>
                      <th className="py-3.5 px-4 text-center">Data / Hora</th>
                      <th className="py-3.5 px-4">Operador</th>
                      <th className="py-3.5 px-4 text-right">Valor Pago</th>
                      <th className="py-3.5 px-4 text-right">Saldo Restante</th>
                      <th className="py-3.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-800">
                          #{r.receiptNumber}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {r.customerName}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800">
                            {r.paymentMethod}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center text-xs text-slate-500">
                          {new Date(r.createdAt).toLocaleString('pt-BR')}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {r.operatorName}
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-emerald-600 text-sm">
                          + {formatCurrency(r.amount)}
                        </td>

                        <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                          {formatCurrency(r.remainingDebt)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleCopyReceiptText(r)}
                            title="Copiar texto do comprovante"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Recebimento de Pagamento com Recibo */}
      {selectedDebt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {newReceipt ? (
              /* Recibo Gerado com Opção de Impressão e Cópia */
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Pagamento Baixado com Sucesso!</h3>
                  <p className="text-xs text-slate-500">Recibo Oficial #{newReceipt.receiptNumber}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-bold text-slate-800">{newReceipt.customerName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Valor Pago:</span>
                    <span className="font-black text-emerald-600 text-sm">
                      {formatCurrency(newReceipt.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Forma:</span>
                    <span className="font-bold text-slate-800">{newReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Saldo Anterior:</span>
                    <span className="text-slate-700">{formatCurrency(newReceipt.previousDebt)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Saldo Restante:</span>
                    <span className="font-black text-rose-600 text-sm">
                      {formatCurrency(newReceipt.remainingDebt)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Operador:</span>
                    <span className="text-slate-700">{newReceipt.operatorName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleCopyReceiptText(newReceipt)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedReceipt ? 'Copiado!' : 'Copiar Texto'}</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedDebt(null);
                      setNewReceipt(null);
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              /* Formulário de Pagamento */
              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">Baixa de Conta Fiada</h3>
                      <p className="text-xs text-slate-500">{selectedDebt.customerName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDebt(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                  <div>
                    <span className="text-slate-800 font-bold block">{selectedDebt.description}</span>
                    <span className="text-slate-500">
                      Vencimento: {new Date(selectedDebt.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <span className="font-black text-rose-600 text-base">
                    {formatCurrency(selectedDebt.remainingAmount)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor a Pagar (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(selectedDebt.remainingAmount.toFixed(2).replace('.', ','))
                      }
                      className="text-[11px] font-bold text-emerald-600 hover:underline"
                    >
                      Quitar Total ({formatCurrency(selectedDebt.remainingAmount)})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Forma de Pagamento *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="DINHEIRO">Dinheiro (Entrada automática no Caixa)</option>
                    <option value="PIX">Pix (Transferência / QR Code)</option>
                    <option value="DEBITO">Cartão de Débito</option>
                    <option value="CREDITO">Cartão de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Observações do Recibo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Quitação parcial da compra"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedDebt(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {submittingPayment ? 'Gravando...' : 'Receber e Emitir Recibo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
