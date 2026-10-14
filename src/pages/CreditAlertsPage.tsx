/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Phone,
  MessageCircle,
  Search,
  Printer,
  FileSpreadsheet,
  CheckCircle,
  Users,
  Calendar,
  X,
  CreditCard,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { CreditAlertItem, CreditSummary } from '../types/index.js';
import { fetchCreditAlerts, receivePayment } from '../api/credit.js';

interface CreditAlertsPageProps {
  token: string | null;
  onNavigateToCustomers?: () => void;
  onNavigateToReceivables?: () => void;
}

export function CreditAlertsPage({
  token,
  onNavigateToCustomers,
  onNavigateToReceivables,
}: CreditAlertsPageProps) {
  const [alerts, setAlerts] = useState<CreditAlertItem[]>([]);
  const [summary, setSummary] = useState<CreditSummary>({
    totalDebtsCount: 0,
    totalOpenDebt: 0,
    totalOverdueAmount: 0,
    overdueCount: 0,
    expiring7DaysCount: 0,
    expiring30DaysCount: 0,
    exceededLimitCount: 0,
    delinquentCustomersCount: 0,
    delinquencyRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | '7_DAYS' | 'LIMIT_EXCEEDED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal de Baixa de Pagamento
  const [selectedAlert, setSelectedAlert] = useState<CreditAlertItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO'>('DINHEIRO');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<any | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCreditAlerts(
        {
          status: statusFilter,
          search: searchTerm,
        },
        token
      );
      setAlerts(res.alerts);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao buscar alertas de fiado.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAlerts();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadAlerts]);

  const handleOpenPayment = (item: CreditAlertItem) => {
    setSelectedAlert(item);
    setPaymentAmount(item.remainingAmount.toFixed(2).replace('.', ','));
    setPaymentMethod('DINHEIRO');
    setPaymentNotes('');
    setPaymentReceipt(null);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;

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
          customerId: selectedAlert.customerId,
          debtId: selectedAlert.debtId,
          amount: val,
          paymentMethod,
          notes: paymentNotes || `Baixa de fiado - Alerta: ${selectedAlert.description}`,
        },
        token
      );

      setPaymentReceipt(receipt);
      setSuccessMessage(`Pagamento de R$ ${val.toFixed(2)} registrado com sucesso! Recibo #${receipt.receiptNumber}`);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar pagamento.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Gerador de mensagem profissional para WhatsApp
  const generateWhatsAppUrl = (item: CreditAlertItem) => {
    const phoneClean = item.customerPhone.replace(/\D/g, '');
    const isOverdue = item.urgency === 'OVERDUE';
    const dueDateFormatted = new Date(item.dueDate).toLocaleDateString('pt-BR');

    let text = '';
    if (isOverdue) {
      const days = Math.abs(item.daysRemainingOrOverdue);
      text = `Olá, ${item.customerName}! Tudo bem? Passando para lembrar com carinho que consta no sistema do Mercado uma conta de ${formatCurrency(item.remainingAmount)} que venceu em ${dueDateFormatted} (há ${days} dias). Quando puder, dá uma passadinha aqui no mercado ou se preferir podemos enviar nossa chave Pix. Agradecemos muito pela preferência!`;
    } else {
      text = `Olá, ${item.customerName}! Tudo bem? Passando apenas para avisar que sua conta no valor de ${formatCurrency(item.remainingAmount)} no Mercado tem vencimento programado para ${dueDateFormatted}. Qualquer dúvida estamos à total disposição. Abraços!`;
    }

    return `https://wa.me/55${phoneClean}?text=${encodeURIComponent(text)}`;
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-md shadow-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Alerta de Fiado</h1>
              <p className="text-sm text-slate-500">
                Aba exclusiva para monitorar inadimplência, contas vencidas, prazos de 7 dias e limites de crédito
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAlerts}
            className="p-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Atualizar Alertas"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Relatório</span>
          </button>

          {onNavigateToReceivables && (
            <button
              onClick={onNavigateToReceivables}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>Fiado e Recebimentos</span>
            </button>
          )}
        </div>
      </div>

      {/* Título Visível na Impressão */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-black text-slate-900">MERCADO - RELATÓRIO OFICIAL DE ALERTA DE FIADO</h1>
        <p className="text-sm text-slate-600">
          Emitido em: {new Date().toLocaleString('pt-BR')} | Total a receber: {formatCurrency(summary.totalOpenDebt)} | Total Vencido: {formatCurrency(summary.totalOverdueAmount)}
        </p>
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

      {/* Cards de Métricas e Inadimplência (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              🔴 Inadimplência Vencida
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
              {summary.overdueCount} títulos
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {formatCurrency(summary.totalOverdueAmount)}
          </div>
          <span className="text-xs text-rose-500 font-medium">
            {summary.delinquentCustomersCount} clientes em atraso
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              🟠 Vence em até 7 Dias
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800">
              Atenção
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600">{summary.expiring7DaysCount}</div>
          <span className="text-xs text-amber-600/80 font-medium">Contas próximas do prazo</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm bg-gradient-to-br from-white to-purple-50/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              🟡 Limite Ultrapassado
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">
              Risco
            </span>
          </div>
          <div className="text-2xl font-black text-purple-700">{summary.exceededLimitCount}</div>
          <span className="text-xs text-purple-600 font-medium">Clientes acima do limite</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              💰 Saldo Total de Fiado
            </span>
            <span className="text-xs font-bold text-slate-400">
              Taxa Inadimplência: {summary.delinquencyRate}%
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {formatCurrency(summary.totalOpenDebt)}
          </div>
          <span className="text-xs text-slate-400">
            {summary.totalDebtsCount} títulos abertos no total
          </span>
        </div>
      </div>

      {/* Barra de Filtros Rápidos */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between print:hidden">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, telefone, CPF ou descrição da compra..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({summary.totalDebtsCount})
          </button>

          <button
            onClick={() => setStatusFilter('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Vencidos ({summary.overdueCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('7_DAYS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === '7_DAYS'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Próximos 7 Dias ({summary.expiring7DaysCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('LIMIT_EXCEEDED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'LIMIT_EXCEEDED'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Limite Estourado ({summary.exceededLimitCount})</span>
          </button>
        </div>
      </div>

      {/* Tabela de Alertas de Fiado */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">Carregando alertas de fiado...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
            <h3 className="text-base font-bold text-slate-800 mb-1">Nenhum alerta pendente</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Nenhuma conta se enquadra nos filtros selecionados. O fiado do seu mercado está sob controle!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Situação / Prazo</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Descrição da Compra</th>
                  <th className="py-3.5 px-4 text-center">Vencimento</th>
                  <th className="py-3.5 px-4 text-right">Saldo em Aberto</th>
                  <th className="py-3.5 px-4 text-right">Limite de Crédito</th>
                  <th className="py-3.5 px-4 text-center print:hidden">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map(item => {
                  const isOverdue = item.urgency === 'OVERDUE';
                  const isCritical7 = item.urgency === 'CRITICAL_7_DAYS';
                  const days = Math.abs(item.daysRemainingOrOverdue);

                  return (
                    <tr
                      key={item.debtId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOverdue ? 'bg-rose-50/30' : isCritical7 ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Situação / Urgência */}
                      <td className="py-3.5 px-4">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                            <span>VENCIDO ({days}d)</span>
                          </span>
                        ) : isCritical7 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Vence em {days}d</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            <span>Em Aberto ({days}d)</span>
                          </span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{item.customerName}</span>
                            {item.isLimitExceeded && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-700">
                                Limite Ultrapassado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <a
                              href={`https://wa.me/55${item.customerPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-emerald-500" />
                              <span>{item.customerPhone}</span>
                            </a>
                            {item.customerCpf && <span>• CPF: {item.customerCpf}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Descrição */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-700 block text-xs">
                          {item.description}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Lançada em: {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </td>

                      {/* Vencimento */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-bold text-xs ${
                            isOverdue ? 'text-rose-600' : isCritical7 ? 'text-amber-600' : 'text-slate-700'
                          }`}
                        >
                          {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                        {isOverdue && (
                          <span className="block text-[10px] text-rose-500 font-semibold">
                            Atrasado há {days} dias
                          </span>
                        )}
                      </td>

                      {/* Saldo Devedor */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-black text-rose-600 block">
                          {formatCurrency(item.remainingAmount)}
                        </span>
                        {item.paidAmount > 0 && (
                          <span className="text-[11px] text-slate-400">
                            Já pago: {formatCurrency(item.paidAmount)}
                          </span>
                        )}
                      </td>

                      {/* Limite de Crédito */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-xs text-slate-600 font-medium block">
                          Limite: {formatCurrency(item.creditLimit)}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            item.availableCredit < 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {item.availableCredit < 0
                            ? `Excedido em ${formatCurrency(Math.abs(item.availableCredit))}`
                            : `Disponível: ${formatCurrency(item.availableCredit)}`}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botão de Cobrança WhatsApp */}
                          <a
                            href={generateWhatsAppUrl(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Cobrar via WhatsApp com mensagem pronta"
                            className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-1 font-bold text-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden lg:inline">Cobrar</span>
                          </a>

                          {/* Botão de Receber Pagamento */}
                          <button
                            onClick={() => handleOpenPayment(item)}
                            title="Receber Pagamento / Quitar Título"
                            className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-all flex items-center gap-1 font-bold text-xs"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                            <span className="hidden lg:inline">Receber</span>
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

      {/* Modal: Recebimento de Pagamento com Emissão de Recibo */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {paymentReceipt ? (
              /* Comprovante de Pagamento */
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Pagamento Recebido!</h3>
                  <p className="text-xs text-slate-500">Recibo Oficial #{paymentReceipt.receiptNumber}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-bold text-slate-800">{paymentReceipt.customerName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Valor Baixado:</span>
                    <span className="font-black text-emerald-600 text-sm">
                      {formatCurrency(paymentReceipt.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Forma de Pagamento:</span>
                    <span className="font-bold text-slate-800">{paymentReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Saldo Anterior:</span>
                    <span className="font-medium text-slate-700">{formatCurrency(paymentReceipt.previousDebt)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Novo Saldo Devedor:</span>
                    <span className="font-black text-rose-600 text-sm">
                      {formatCurrency(paymentReceipt.remainingDebt)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Operador:</span>
                    <span className="text-slate-700">{paymentReceipt.operatorName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAlert(null);
                      setPaymentReceipt(null);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              /* Formulário de Quitação / Baixa */
              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">Baixar Título de Fiado</h3>
                      <p className="text-xs text-slate-500">{selectedAlert.customerName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAlert(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs flex justify-between items-center">
                  <div>
                    <span className="text-rose-900 font-bold block">{selectedAlert.description}</span>
                    <span className="text-rose-700">
                      Vencido em: {new Date(selectedAlert.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <span className="font-black text-rose-600 text-base">
                    {formatCurrency(selectedAlert.remainingAmount)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor Pago (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-lg font-black focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(selectedAlert.remainingAmount.toFixed(2).replace('.', ','))
                      }
                      className="text-[11px] font-bold text-emerald-600 hover:underline"
                    >
                      Quitar Total ({formatCurrency(selectedAlert.remainingAmount)})
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                    placeholder="Ex: Pagamento parcial do rancho de bebidas"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAlert(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50"
                  >
                    {submittingPayment ? 'Gravando...' : 'Receber e Baixar Débito'}
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
