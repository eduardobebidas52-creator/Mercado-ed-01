/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  FileText,
  DollarSign,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  MessageCircle,
  ShoppingBag,
  History,
  Lock,
  Unlock,
  Printer,
} from 'lucide-react';
import { Customer } from '../types/index.js';
import {
  fetchCustomers,
  fetchCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  CustomerSummary,
} from '../api/customers.js';
import { receivePayment } from '../api/credit.js';

interface CustomersPageProps {
  token: string | null;
  onNavigateToCreditAlerts?: () => void;
  onNavigateToReceivables?: () => void;
}

export function CustomersPage({
  token,
  onNavigateToCreditAlerts,
  onNavigateToReceivables,
}: CustomersPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<CustomerSummary>({
    totalCustomers: 0,
    activeCustomers: 0,
    blockedCustomers: 0,
    customersWithDebt: 0,
    totalDebt: 0,
    totalCreditLimit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'WITH_DEBT' | 'OVERDUE'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cpf: '',
    address: '',
    creditLimit: '500,00',
    status: 'ACTIVE' as 'ACTIVE' | 'BLOCKED',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal de Ficha Detalhada
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<{
    customer: Customer;
    debts: any[];
    payments: any[];
    recentSales: any[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'info' | 'debts' | 'payments' | 'sales'>('debts');

  // Modal de Pagamento Rápido
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO'>('DINHEIRO');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCustomers(
        {
          search: searchTerm,
          status: statusFilter === 'ACTIVE' || statusFilter === 'BLOCKED' ? statusFilter : undefined,
          hasDebtOnly: statusFilter === 'WITH_DEBT',
          overdueOnly: statusFilter === 'OVERDUE',
        },
        token
      );
      setCustomers(res.customers);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Carrega ficha do cliente selecionado
  const handleOpenDetails = async (id: string) => {
    try {
      setSelectedCustomerId(id);
      setLoadingDetails(true);
      const data = await fetchCustomerById(id, token);
      setCustomerDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      cpf: '',
      address: '',
      creditLimit: '500,00',
      status: 'ACTIVE',
      notes: '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone,
      cpf: c.cpf || '',
      address: c.address || '',
      creditLimit: c.creditLimit.toFixed(2).replace('.', ','),
      status: c.status,
      notes: c.notes || '',
    });
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      setError('Nome e telefone são obrigatórios.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const limitVal = parseFloat(formData.creditLimit.replace(/\./g, '').replace(',', '.')) || 0;

      if (editingCustomer) {
        await updateCustomer(
          editingCustomer.id,
          {
            name: formData.name,
            phone: formData.phone,
            cpf: formData.cpf || null,
            address: formData.address || null,
            creditLimit: limitVal,
            status: formData.status,
            notes: formData.notes || null,
          },
          token
        );
        setSuccessMessage('Cliente atualizado com sucesso!');
      } else {
        await createCustomer(
          {
            name: formData.name,
            phone: formData.phone,
            cpf: formData.cpf || undefined,
            address: formData.address || undefined,
            creditLimit: limitVal,
            status: formData.status,
            notes: formData.notes || undefined,
          },
          token
        );
        setSuccessMessage('Cliente cadastrado com sucesso!');
      }

      setIsFormModalOpen(false);
      await loadData();
      if (selectedCustomerId) {
        handleOpenDetails(selectedCustomerId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (c.currentDebt > 0) {
      setError(`O cliente ${c.name} possui saldo devedor de R$ ${c.currentDebt.toFixed(2)}. Quite a dívida antes de excluir.`);
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o cadastro de "${c.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteCustomer(c.id, token);
      setSuccessMessage('Cliente removido com sucesso!');
      if (selectedCustomerId === c.id) {
        setSelectedCustomerId(null);
        setCustomerDetails(null);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (c: Customer) => {
    try {
      const newStatus = c.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      await updateCustomer(c.id, { status: newStatus }, token);
      setSuccessMessage(
        newStatus === 'BLOCKED'
          ? `Cliente ${c.name} foi BLOQUEADO para novas compras no fiado.`
          : `Cliente ${c.name} foi DESBLOQUEADO.`
      );
      await loadData();
      if (selectedCustomerId === c.id) {
        handleOpenDetails(c.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar status.');
    }
  };

  const handleOpenPayment = (c: Customer) => {
    setPaymentCustomer(c);
    setPaymentAmount(c.currentDebt.toFixed(2).replace('.', ','));
    setPaymentMethod('DINHEIRO');
    setPaymentNotes('');
    setPaymentReceipt(null);
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;

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
          customerId: paymentCustomer.id,
          amount: val,
          paymentMethod,
          notes: paymentNotes || 'Recebimento avulso via Gestão de Clientes',
        },
        token
      );

      setPaymentReceipt(receipt);
      setSuccessMessage(`Pagamento de R$ ${val.toFixed(2)} recebido com sucesso! Recibo #${receipt.receiptNumber}`);
      await loadData();
      if (selectedCustomerId === paymentCustomer.id) {
        handleOpenDetails(paymentCustomer.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar pagamento.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Aba de Clientes</h1>
              <p className="text-sm text-slate-500">
                Cadastro centralizado, limites de crédito, histórico e ficha individual de fiado
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToCreditAlerts && (
            <button
              onClick={onNavigateToCreditAlerts}
              className="px-3.5 py-2.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Ver Alerta de Fiado</span>
            </button>
          )}
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Alertas e Mensagens */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center justify-between">
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cards de Indicadores (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Total Clientes
          </span>
          <div className="text-2xl font-black text-slate-800">{summary.totalCustomers}</div>
          <span className="text-xs text-slate-400">Cadastrados no sistema</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Com Fiado Aberto
          </span>
          <div className="text-2xl font-black text-amber-600">{summary.customersWithDebt}</div>
          <span className="text-xs text-amber-600/80 font-medium">Possuem débito pendente</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Total a Receber
          </span>
          <div className="text-2xl font-black text-rose-600">{formatCurrency(summary.totalDebt)}</div>
          <span className="text-xs text-rose-500/80 font-medium">Saldo devedor total</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Limite Concedido
          </span>
          <div className="text-2xl font-black text-blue-600">{formatCurrency(summary.totalCreditLimit)}</div>
          <span className="text-xs text-blue-500/80">Soma de todos os limites</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Clientes Ativos
          </span>
          <div className="text-2xl font-black text-emerald-600">{summary.activeCustomers}</div>
          <span className="text-xs text-emerald-600 font-medium">Autorizados p/ fiado</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Bloqueados
          </span>
          <div className="text-2xl font-black text-slate-500">{summary.blockedCustomers}</div>
          <span className="text-xs text-slate-400">Suspensos p/ compras</span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou CPF..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({summary.totalCustomers})
          </button>
          <button
            onClick={() => setStatusFilter('WITH_DEBT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'WITH_DEBT'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Com Fiado ({summary.customersWithDebt})
          </button>
          <button
            onClick={() => setStatusFilter('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Vencidos
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Ativos ({summary.activeCustomers})
          </button>
          <button
            onClick={() => setStatusFilter('BLOCKED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'BLOCKED'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Bloqueados ({summary.blockedCustomers})
          </button>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">Carregando carteira de clientes...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-bold text-slate-700 mb-1">Nenhum cliente encontrado</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
              {searchTerm
                ? 'Nenhum resultado corresponde à sua pesquisa.'
                : 'Cadastre seu primeiro cliente para iniciar o controle de fiado e compras.'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Cadastrar Cliente Agora
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Contato & CPF</th>
                  <th className="py-3.5 px-4 text-center">Situação</th>
                  <th className="py-3.5 px-4 text-right">Limite de Crédito</th>
                  <th className="py-3.5 px-4 text-right">Saldo Devedor</th>
                  <th className="py-3.5 px-4 text-right">Disponível</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(c => {
                  const isBlocked = c.status === 'BLOCKED';
                  const hasDebt = c.currentDebt > 0;
                  const isExceeded = c.currentDebt > c.creditLimit;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => handleOpenDetails(c.id)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm uppercase ${
                              isBlocked
                                ? 'bg-slate-200 text-slate-700'
                                : hasDebt
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {isExceeded && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700">
                                  Limite Estourado
                                </span>
                              )}
                            </div>
                            {c.address && (
                              <span className="text-xs text-slate-400 truncate block max-w-xs">
                                {c.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <a
                            href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs font-semibold text-slate-700 hover:text-emerald-600 flex items-center gap-1"
                            title="Conversar no WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{c.phone}</span>
                          </a>
                          {c.cpf && <span className="text-[11px] text-slate-400">CPF: {c.cpf}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span>Bloqueado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            <span>Ativo</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(c.creditLimit)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {hasDebt ? (
                          <span className="font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                            {formatCurrency(c.currentDebt)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg">
                            Em Dia (R$ 0,00)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-slate-600">
                        {formatCurrency(c.availableCredit)}
                      </td>

                      <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {hasDebt && (
                            <button
                              onClick={() => handleOpenPayment(c)}
                              title="Receber / Quitar Fiado"
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Receber</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            title="Editar Dados"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleBlock(c)}
                            title={isBlocked ? 'Desbloquear Fiado' : 'Bloquear Fiado'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isBlocked
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {isBlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            title="Excluir Cliente"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Modal: Cadastro / Edição de Cliente */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingCustomer ? 'Editar Cadastro de Cliente' : 'Novo Cliente'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria de Fátima Oliveira"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="(11) 98765-4321"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    CPF (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Endereço Residencial (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, complemento"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Limite de Crédito (R$)
                  </label>
                  <input
                    type="text"
                    placeholder="500,00"
                    value={formData.creditLimit}
                    onChange={e => setFormData({ ...formData, creditLimit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-400">Teto máximo para vendas no fiado</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Situação
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Ativo (Permitir fiado)</option>
                    <option value="BLOCKED">Bloqueado (Suspender fiado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observações Internas
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Paga sempre no quinto dia útil; mora no bairro há 10 anos..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : editingCustomer ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ficha Detalhada do Cliente (Extrato, Histórico, Compras) */}
      {selectedCustomerId && customerDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho do Cliente */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl uppercase ${
                    customerDetails.customer.status === 'BLOCKED'
                      ? 'bg-slate-200 text-slate-700'
                      : customerDetails.customer.currentDebt > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {customerDetails.customer.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-800">
                      {customerDetails.customer.name}
                    </h2>
                    {customerDetails.customer.status === 'BLOCKED' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        Ativo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                    <a
                      href={`https://wa.me/55${customerDetails.customer.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{customerDetails.customer.phone}</span>
                    </a>
                    {customerDetails.customer.cpf && <span>CPF: {customerDetails.customer.cpf}</span>}
                    {customerDetails.customer.address && <span>• {customerDetails.customer.address}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {customerDetails.customer.currentDebt > 0 && (
                  <button
                    onClick={() => handleOpenPayment(customerDetails.customer)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Receber Pagamento</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Resumo Financeiro do Cliente */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-100/60 border-b border-slate-200/80">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Saldo Devedor Atual
                </span>
                <span className="text-xl font-black text-rose-600">
                  {formatCurrency(customerDetails.customer.currentDebt)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Limite Autorizado
                </span>
                <span className="text-xl font-black text-blue-600">
                  {formatCurrency(customerDetails.customer.creditLimit)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Limite Disponível
                </span>
                <span className="text-xl font-black text-emerald-600">
                  {formatCurrency(customerDetails.customer.availableCredit)}
                </span>
              </div>
            </div>

            {/* Abas Internas da Ficha */}
            <div className="flex items-center gap-4 px-6 border-b border-slate-200 bg-white">
              <button
                onClick={() => setActiveDetailsTab('debts')}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDetailsTab === 'debts'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Contas Fiadas ({customerDetails.debts.length})</span>
              </button>

              <button
                onClick={() => setActiveDetailsTab('payments')}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDetailsTab === 'payments'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Recibos de Quitação ({customerDetails.payments.length})</span>
              </button>

              <button
                onClick={() => setActiveDetailsTab('sales')}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeDetailsTab === 'sales'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Histórico de Vendas ({customerDetails.recentSales.length})</span>
              </button>
            </div>

            {/* Conteúdo da Aba Interna */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {activeDetailsTab === 'debts' && (
                <div className="space-y-3">
                  {customerDetails.debts.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Nenhuma conta de fiado registrada para este cliente.
                    </div>
                  ) : (
                    customerDetails.debts.map(d => {
                      const isOverdue = d.status === 'OVERDUE';
                      const isPaid = d.status === 'PAID';

                      return (
                        <div
                          key={d.id}
                          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                            isPaid
                              ? 'bg-slate-50 border-slate-200 opacity-60'
                              : isOverdue
                              ? 'bg-rose-50/60 border-rose-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-800 text-sm">{d.description}</span>
                              {isPaid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                                  PAGO
                                </span>
                              ) : isOverdue ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-200 text-rose-800">
                                  ATRASADO ({d.daysOverdue} dias)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800">
                                  PENDENTE
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-3">
                              <span>Vencimento: {new Date(d.dueDate).toLocaleDateString('pt-BR')}</span>
                              <span>•</span>
                              <span>Lançado em: {new Date(d.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-slate-400 block">
                              Original: {formatCurrency(d.originalAmount)}
                            </span>
                            <span
                              className={`text-base font-black ${
                                isPaid ? 'text-slate-400' : 'text-rose-600'
                              }`}
                            >
                              Restante: {formatCurrency(d.remainingAmount)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeDetailsTab === 'payments' && (
                <div className="space-y-3">
                  {customerDetails.payments.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Nenhum pagamento registrado ainda.
                    </div>
                  ) : (
                    customerDetails.payments.map(p => (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-slate-800 text-sm">
                              Recibo #{p.receiptNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {p.paymentMethod}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 block">
                            Recebido por: {p.operatorName} em{' '}
                            {new Date(p.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-emerald-600 block">
                            + {formatCurrency(p.amount)}
                          </span>
                          <span className="text-xs text-slate-400">
                            Saldo Restante: {formatCurrency(p.remainingDebt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeDetailsTab === 'sales' && (
                <div className="space-y-3">
                  {customerDetails.recentSales.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Nenhuma venda vinculada a este cliente.
                    </div>
                  ) : (
                    customerDetails.recentSales.map(s => (
                      <div
                        key={s.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800 text-sm">
                              Venda #{s.saleNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              {s.paymentMethod}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(s.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-slate-800">
                            {formatCurrency(s.total)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Rodapé da Ficha */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-2xl">
              <div className="text-xs text-slate-500">
                Cliente desde: {new Date(customerDetails.customer.createdAt).toLocaleDateString('pt-BR')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(customerDetails.customer)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Editar Cadastro
                </button>
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recebimento / Quitação de Fiado com Recibo */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {paymentReceipt ? (
              /* Comprovante de Pagamento Emitido */
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Pagamento Confirmado!</h3>
                  <p className="text-xs text-slate-500">
                    Recibo Oficial de Pagamento #{paymentReceipt.receiptNumber}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-bold text-slate-800">{paymentReceipt.customerName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Valor Pago:</span>
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
                    <span>Imprimir Recibo</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentCustomer(null);
                      setPaymentReceipt(null);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              /* Formulário de Pagamento */
              <form onSubmit={handleExecutePayment} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">Receber Pagamento de Fiado</h3>
                      <p className="text-xs text-slate-500">{paymentCustomer.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentCustomer(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs flex justify-between items-center">
                  <span className="text-amber-800 font-medium">Saldo Devedor Atual:</span>
                  <span className="font-black text-rose-600 text-sm">
                    {formatCurrency(paymentCustomer.currentDebt)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor a Receber (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(paymentCustomer.currentDebt.toFixed(2).replace('.', ','))}
                      className="text-[11px] font-bold text-emerald-600 hover:underline"
                    >
                      Quitar Total ({formatCurrency(paymentCustomer.currentDebt)})
                    </button>
                    {paymentCustomer.currentDebt > 50 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentAmount((paymentCustomer.currentDebt / 2).toFixed(2).replace('.', ','))
                        }
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        Metade (50%)
                      </button>
                    )}
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
                    <option value="DINHEIRO">Dinheiro (Entrada no Caixa)</option>
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
                    placeholder="Ex: Quitação parcial da compra do rancho"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPaymentCustomer(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {submittingPayment ? 'Processando...' : 'Confirmar e Emitir Recibo'}
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
