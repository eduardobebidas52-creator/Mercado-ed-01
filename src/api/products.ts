/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient } from './client';

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  profitMarginPercent: number;
  stockQuantity: number;
  minStockAlert: number;
  isLowStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMetrics {
  totalProducts: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalSellingValue: number;
  lowStockCount: number;
}

export async function fetchProducts(options?: {
  search?: string;
  categoryId?: string;
  onlyLowStock?: boolean;
}): Promise<Product[]> {
  const params = new URLSearchParams();
  if (options?.search) params.append('search', options.search);
  if (options?.categoryId) params.append('categoryId', options.categoryId);
  if (options?.onlyLowStock) params.append('onlyLowStock', 'true');

  const url = `/api/products${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await apiClient<{ success: boolean; data: Product[] }>(url);
  return res.data || [];
}

export async function fetchProductMetrics(): Promise<ProductMetrics> {
  const res = await apiClient<{ success: boolean; data: ProductMetrics }>('/api/products/metrics');
  return res.data;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await apiClient<{ success: boolean; data: Category[] }>('/api/products/categories');
  return res.data || [];
}

export async function createCategory(name: string, color?: string, token?: string | null): Promise<Category> {
  const res = await apiClient<{ success: boolean; data: Category }>('/api/products/categories', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ name, color }),
  });
  return res.data;
}

export async function createProduct(
  productData: {
    barcode?: string;
    name: string;
    description?: string;
    categoryId?: string;
    unit?: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity?: number;
    minStockAlert?: number;
  },
  token?: string | null
): Promise<Product> {
  const res = await apiClient<{ success: boolean; data: Product }>('/api/products', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(productData),
  });
  return res.data;
}

export async function updateProduct(
  id: string,
  productData: Partial<{
    barcode?: string | null;
    name?: string;
    description?: string | null;
    categoryId?: string | null;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    minStockAlert?: number;
    isActive?: boolean;
  }>,
  token?: string | null
): Promise<Product> {
  const res = await apiClient<{ success: boolean; data: Product }>(`/api/products/${id}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(productData),
  });
  return res.data;
}

export async function adjustStock(
  productId: string,
  movementData: {
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
    quantity: number;
    reason: string;
  },
  token?: string | null
): Promise<Product> {
  const res = await apiClient<{ success: boolean; data: Product }>(
    `/api/products/${productId}/adjust-stock`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(movementData),
    }
  );
  return res.data;
}

export async function deleteProduct(productId: string, token?: string | null): Promise<void> {
  await apiClient(`/api/products/${productId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
