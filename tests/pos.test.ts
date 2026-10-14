/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

describe('Regras Financeiras do PDV e Frente de Caixa', () => {
  it('deve calcular o troco corretamente em vendas em dinheiro', () => {
    const total = 42.80;
    const amountPaid = 50.00;
    const change = Number((amountPaid - total).toFixed(2));

    expect(change).toBe(7.20);
  });

  it('deve calcular subtotal com desconto sem permitir total negativo', () => {
    const subtotal = 100.00;
    const discount = 15.00;
    const total = Math.max(0, Number((subtotal - discount).toFixed(2)));

    expect(total).toBe(85.00);

    const excessiveDiscount = 120.00;
    const totalCapped = Math.max(0, Number((subtotal - excessiveDiscount).toFixed(2)));
    expect(totalCapped).toBe(0);
  });

  it('deve calcular o saldo esperado de gaveta no fechamento de caixa', () => {
    const openingBalance = 100.00; // Fundo de troco
    const cashSales = 350.50;      // Vendas em dinheiro
    const suprimento = 50.00;       // Reforço de troco
    const sangria = 200.00;        // Retirada para cofre

    // Saldo esperado em gaveta
    const expected = openingBalance + cashSales + suprimento - sangria;
    expect(expected).toBe(300.50);

    // Conferência cega com dinheiro contado
    const counted1 = 300.50;
    expect(counted1 - expected).toBe(0); // Caixa exato

    const counted2 = 310.00;
    expect(counted2 - expected).toBe(9.50); // Sobra de caixa

    const counted3 = 295.00;
    expect(counted3 - expected).toBe(-5.50); // Quebra / Falta de caixa
  });
});
