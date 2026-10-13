/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Barcode, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Edit2, 
  Trash2, 
  ArrowUpDown, 
  Layers, 
  Check, 
  X,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Boxes
} from 'lucide-react';
import { 
  Product, 
  Category, 
  ProductMetrics, 
  fetchProducts, 
  fetchProductMetrics, 
  fetchCategories, 
  createProduct, 
  updateProduct, 
  adjustStock, 
  deleteProduct,
  createCategory
} from '../api/products';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';

export const ProductsPage: React.FC = () => {
  const { token, isAuthenticated } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [metrics, setMetrics] = useState<ProductMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  // Formulário de Produto
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formUnit, setFormUnit] = useState('UN');
  const [formCostPrice, setFormCostPrice] = useState('0,00');
  const [formSellingPrice, setFormSellingPrice] = useState('0,00');
  const [formStock, setFormStock] = useState('0');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Nova Categoria inline
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Formulário de Movimentação de Estoque
  const [stockMovementType, setStockMovementType] = useState<'ENTRADA' | 'SAIDA' | 'AJUSTE'>('ENTRADA');
  const [stockMovementQty, setStockMovementQty] = useState('1');
  const [stockMovementReason, setStockMovementReason] = useState('Compra de mercadorias');
  const [stockError, setStockError] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodsData, metricsData, catsData] = await Promise.all([
        fetchProducts({
          search: search.trim() || undefined,
          categoryId: selectedCategory || undefined,
          onlyLowStock,
        }),
        fetchProductMetrics(),
        fetchCategories(),
      ]);

      setProducts(prodsData);
      setMetrics(metricsData);
      setCategories(catsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar catálogo de produtos.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, onlyLowStock]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Abertura do Modal de Cadastro / Edição
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormBarcode('');
    setFormName('');
    setFormDescription('');
    setFormCategoryId(categories[0]?.id || '');
    setFormUnit('UN');
    setFormCostPrice('0.00');
    setFormSellingPrice('0.00');
    setFormStock('0');
    setFormMinStock('5');
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormBarcode(p.barcode || '');
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormCategoryId(p.categoryId || '');
    setFormUnit(p.unit || 'UN');
    setFormCostPrice(p.costPrice.toFixed(2));
    setFormSellingPrice(p.sellingPrice.toFixed(2));
    setFormStock(String(p.stockQuantity));
    setFormMinStock(String(p.minStockAlert));
    setFormError(null);
    setIsProductModalOpen(true);
  };

  // Cálculo da Margem em Tempo Real no formulário
  const currentCost = parseFloat(formCostPrice.replace(',', '.')) || 0;
  const currentSelling = parseFloat(formSellingPrice.replace(',', '.')) || 0;
  const calculatedMargin = currentCost > 0 
    ? Number((((currentSelling - currentCost) / currentCost) * 100).toFixed(1))
    : 0;

  // Gerador de Código Interno (para itens sem código de barras)
  const handleGenerateInternalBarcode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormBarcode(`INT-${timestamp}${random}`);
  };

  // Salvar Produto
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const cost = parseFloat(formCostPrice.replace(',', '.'));
      const selling = parseFloat(formSellingPrice.replace(',', '.'));
      const stock = parseFloat(formStock.replace(',', '.'));
      const minStock = parseFloat(formMinStock.replace(',', '.'));

      if (!formName.trim()) throw new Error('O nome do produto é obrigatório.');
      if (isNaN(cost) || cost < 0) throw new Error('Preço de custo inválido.');
      if (isNaN(selling) || selling < 0) throw new Error('Preço de venda inválido.');

      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          {
            barcode: formBarcode.trim() || null,
            name: formName.trim(),
            description: formDescription.trim() || null,
            categoryId: formCategoryId || null,
            unit: formUnit,
            costPrice: cost,
            sellingPrice: selling,
            minStockAlert: minStock,
          },
          token
        );
      } else {
        await createProduct(
          {
            barcode: formBarcode.trim() || undefined,
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            categoryId: formCategoryId || undefined,
            unit: formUnit,
            costPrice: cost,
            sellingPrice: selling,
            stockQuantity: stock,
            minStockAlert: minStock,
          },
          token
        );
      }

      setIsProductModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar produto.');
    } finally {
      setSubmitting(false);
    }
  };

  // Criar Nova Categoria
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const created = await createCategory(newCategoryName.trim(), '#2563eb', token);
      setCategories(prev => [...prev, created]);
      setFormCategoryId(created.id);
      setNewCategoryName('');
      setIsNewCategoryOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao criar categoria.');
    }
  };

  // Abrir Modal de Estoque
  const handleOpenStockModal = (p: Product) => {
    setStockProduct(p);
    setStockMovementType('ENTRADA');
    setStockMovementQty('1');
    setStockMovementReason('Compra / Reposição de mercadoria');
    setStockError(null);
    setIsStockModalOpen(true);
  };

  // Salvar Movimentação de Estoque
  const handleSaveStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;
    setStockError(null);
    setSubmitting(true);

    try {
      const qty = parseFloat(stockMovementQty.replace(',', '.'));
      if (isNaN(qty) || qty <= 0) throw new Error('Quantidade inválida.');

      await adjustStock(
        stockProduct.id,
        {
          type: stockMovementType,
          quantity: qty,
          reason: stockMovementReason.trim() || 'Ajuste manual',
        },
        token
      );

      setIsStockModalOpen(false);
      await loadData();
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'Falha ao movimentar estoque.');
    } finally {
      setSubmitting(false);
    }
  };

  // Excluir Produto
  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Tem certeza que deseja desativar o produto "${p.name}"?`)) {
      return;
    }
    try {
      await deleteProduct(p.id, token);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao remover produto.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Indicadores de Estoque e Valorização (Valores Reais Zerados se vazio) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total de Produtos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Produtos Cadastrados</span>
            <Package size={16} className="text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {metrics?.totalProducts || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Itens ativos no catálogo
          </div>
        </div>

        {/* Quantidade Total de Itens */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Estoque Físico Total</span>
            <Boxes size={16} className="text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {metrics ? Number(metrics.totalStockUnits).toFixed(metrics.totalStockUnits % 1 === 0 ? 0 : 2) : 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Unidades / KG em loja
          </div>
        </div>

        {/* Valor em Estoque a Custo */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Estoque a Custo</span>
            <DollarSign size={16} className="text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {formatCurrency(metrics?.totalCostValue || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Capital investido em mercadorias
          </div>
        </div>

        {/* Projeção de Faturamento a Venda */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Estoque a Venda</span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 text-emerald-700">
            {formatCurrency(metrics?.totalSellingValue || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Potencial total de receita
          </div>
        </div>

        {/* Alerta de Estoque Baixo */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Reposição Urgente</span>
            <AlertTriangle size={16} className={(metrics?.lowStockCount || 0) > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <div className={`text-xl font-bold ${(metrics?.lowStockCount || 0) > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {metrics?.lowStockCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {(metrics?.lowStockCount || 0) > 0 ? 'Itens abaixo do estoque mínimo' : 'Estoque regular'}
          </div>
        </div>
      </div>

      {/* 2. Barra de Ferramentas, Busca e Ações */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Campo de Busca Rápida (com suporte a leitor de código de barras) */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou bipar código de barras..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-900 bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtro de Categoria */}
        <div className="w-full md:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-800 bg-white"
          >
            <option value="">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Estoque Baixo */}
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none px-2 py-1">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
          <span className="whitespace-nowrap">Apenas Estoque Baixo</span>
        </label>

        {/* Botão de Cadastro */}
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
        >
          <Plus size={15} />
          <span>Novo Produto</span>
        </button>
      </div>

      {/* 3. Tabela de Produtos ou Estado Vazio */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw size={20} className="animate-spin text-blue-600" />
            <span>Consultando catálogo no PostgreSQL...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Package}
              title={search || selectedCategory || onlyLowStock ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
              description={
                search || selectedCategory || onlyLowStock
                  ? 'Nenhum item corresponde aos filtros selecionados. Tente limpar os termos de busca.'
                  : 'O banco de dados está pronto para o seu catálogo. Clique no botão "+ Novo Produto" acima para cadastrar a primeira mercadoria real do seu mercado.'
              }
              actionLabel={!search && !selectedCategory && !onlyLowStock ? 'Cadastrar Primeiro Produto' : undefined}
              onAction={!search && !selectedCategory && !onlyLowStock ? handleOpenCreateModal : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Produto & Categoria</th>
                  <th className="py-3 px-4 text-right">Preço Custo</th>
                  <th className="py-3 px-4 text-right">Preço Venda</th>
                  <th className="py-3 px-4 text-right">Margem</th>
                  <th className="py-3 px-4 text-center">Estoque Atual</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Código de Barras */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {p.barcode ? (
                        <div className="flex items-center gap-1.5">
                          <Barcode size={13} className="text-slate-400" />
                          <span>{p.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sem código</span>
                      )}
                    </td>

                    {/* Nome e Categoria */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span 
                          className="inline-block w-2 h-2 rounded-full" 
                          style={{ backgroundColor: p.categoryColor || '#2563eb' }}
                        />
                        <span className="text-[11px] text-slate-500">{p.categoryName}</span>
                      </div>
                    </td>

                    {/* Preço de Custo */}
                    <td className="py-3 px-4 text-right font-medium text-slate-600">
                      {formatCurrency(p.costPrice)}
                    </td>

                    {/* Preço de Venda */}
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(p.sellingPrice)}
                    </td>

                    {/* Margem de Lucro */}
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                        p.profitMarginPercent >= 30
                          ? 'bg-emerald-50 text-emerald-700'
                          : p.profitMarginPercent > 0
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        +{p.profitMarginPercent}%
                      </span>
                    </td>

                    {/* Estoque Atual */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className={`font-bold ${p.isLowStock ? 'text-amber-700' : 'text-slate-900'}`}>
                          {p.stockQuantity} {p.unit}
                        </span>
                        {p.isLowStock && (
                          <span 
                            title={`Abaixo do mínimo de ${p.minStockAlert} ${p.unit}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold"
                          >
                            Baixo
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenStockModal(p)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Entrada / Saída de Estoque"
                        >
                          <ArrowUpDown size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar Produto"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir Produto"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Modal: Novo / Editar Produto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {editingProduct ? <Edit2 size={14} /> : <Plus size={14} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Preencha as informações cadastrais e de precificação
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Código de Barras com Gerador Interno */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Código de Barras (EAN / GTIN)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateInternalBarcode}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    <span>Gerar Código Interno</span>
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Barcode size={15} />
                  </div>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="Ex: 7891234567890 ou deixe em branco para gerar"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Nome do Produto */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Arroz Tipo 1 Camil 5kg"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900"
                />
              </div>

              {/* Categoria e Unidade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Categoria
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsNewCategoryOpen(!isNewCategoryOpen)}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      {isNewCategoryOpen ? 'Fechar' : '+ Nova'}
                    </button>
                  </div>

                  {isNewCategoryOpen ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nome da categoria"
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 bg-white"
                    >
                      <option value="">Selecione...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Unidade de Medida
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 bg-white"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="KG">KG (Quilograma)</option>
                    <option value="L">L (Litro)</option>
                    <option value="PCT">PCT (Pacote)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="G">G (Grama)</option>
                  </select>
                </div>
              </div>

              {/* Preços e Margem Automática */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Preço Custo (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Preço Venda (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Margem Lucro
                  </label>
                  <div className={`py-1.5 px-2 rounded-lg text-xs font-bold text-center border ${
                    calculatedMargin >= 30
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : calculatedMargin > 0
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    +{calculatedMargin}%
                  </div>
                </div>
              </div>

              {/* Estoque Inicial e Mínimo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {editingProduct ? 'Estoque Cadastrado' : 'Estoque Inicial'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    disabled={Boolean(editingProduct)}
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900 disabled:bg-slate-100"
                  />
                  {editingProduct && (
                    <span className="text-[10px] text-slate-400">Use a ação "Movimentar" para alterar estoque</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Estoque Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : editingProduct ? 'Atualizar Produto' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Movimentação de Estoque */}
      {isStockModalOpen && stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  <ArrowUpDown size={14} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Movimentar Estoque
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-[260px]">
                    {stockProduct.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStockMovement} className="p-6 space-y-4">
              {stockError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{stockError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-600">Estoque Atual:</span>
                <span className="font-bold text-slate-900">
                  {stockProduct.stockQuantity} {stockProduct.unit}
                </span>
              </div>

              {/* Tipo de Operação */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de Movimentação
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStockMovementType('ENTRADA')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      stockMovementType === 'ENTRADA'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    + Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockMovementType('SAIDA')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      stockMovementType === 'SAIDA'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    - Saída
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockMovementType('AJUSTE')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      stockMovementType === 'AJUSTE'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    = Balanço
                  </button>
                </div>
              </div>

              {/* Quantidade */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Quantidade ({stockProduct.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={stockMovementQty}
                  onChange={(e) => setStockMovementQty(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900 font-bold"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Motivo da Movimentação
                </label>
                <input
                  type="text"
                  required
                  value={stockMovementReason}
                  onChange={(e) => setStockMovementReason(e.target.value)}
                  placeholder="Ex: Nota Fiscal 1234, perda por avaria, etc."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Gravando...' : 'Confirmar Movimentação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
