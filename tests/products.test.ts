/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { calculateProfitMargin } from '../server/services/products.service.js';

describe('Regras de Negócio de Produtos e Margem de Lucro', () => {
  it('deve calcular a margem de markup corretamente sobre o preço de custo', () => {
    // Custo R$ 10,00, Venda R$ 15,00 -> Lucro de R$ 5,00 (50% sobre o custo)
    const margin1 = calculateProfitMargin(10, 15);
    expect(margin1).toBe(50);

    // Custo R$ 20,00, Venda R$ 30,00 -> 50%
    const margin2 = calculateProfitMargin(20, 30);
    expect(margin2).toBe(50);

    // Custo R$ 4,00, Venda R$ 6,00 -> 50%
    const margin3 = calculateProfitMargin(4, 6);
    expect(margin3).toBe(50);

    // Custo R$ 8,00, Venda R$ 10,00 -> 25%
    const margin4 = calculateProfitMargin(8, 10);
    expect(margin4).toBe(25);
  });

  it('deve tratar custo zero sem gerar divisão por zero ou NaN', () => {
    const marginZero = calculateProfitMargin(0, 15);
    expect(marginZero).toBe(0);
  });

  it('deve calcular margens fracionárias arredondadas com 2 casas decimais', () => {
    // Custo R$ 3,00, Venda R$ 4,00 -> 33.33%
    const margin = calculateProfitMargin(3, 4);
    expect(margin).toBe(33.33);
  });
});
