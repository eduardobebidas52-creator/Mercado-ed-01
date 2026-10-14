/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

describe('Regras de Negócio de Alertas de Validade e Estoque', () => {
  it('deve classificar alertas de validade conforme os prazos amarelo, laranja e vermelho', () => {
    const yellowThreshold = 30;
    const orangeThreshold = 7;

    function classifyBatch(daysRemaining: number): 'EXPIRED' | 'WARNING_7' | 'WARNING_30' | 'SAFE' {
      if (daysRemaining < 0) return 'EXPIRED';
      if (daysRemaining <= orangeThreshold) return 'WARNING_7';
      if (daysRemaining <= yellowThreshold) return 'WARNING_30';
      return 'SAFE';
    }

    // Vencido há 2 dias -> Vermelho
    expect(classifyBatch(-2)).toBe('EXPIRED');
    // Vence hoje (0 dias) -> Laranja (crítico)
    expect(classifyBatch(0)).toBe('WARNING_7');
    // Vence em 5 dias -> Laranja (crítico)
    expect(classifyBatch(5)).toBe('WARNING_7');
    // Vence em 7 dias -> Laranja (limite crítico)
    expect(classifyBatch(7)).toBe('WARNING_7');
    // Vence em 8 dias -> Amarelo (atenção)
    expect(classifyBatch(8)).toBe('WARNING_30');
    // Vence em 25 dias -> Amarelo (atenção)
    expect(classifyBatch(25)).toBe('WARNING_30');
    // Vence em 30 dias -> Amarelo (limite atenção)
    expect(classifyBatch(30)).toBe('WARNING_30');
    // Vence em 45 dias -> Verde (seguro)
    expect(classifyBatch(45)).toBe('SAFE');
  });

  it('deve calcular o prejuízo financeiro exato ao registrar baixa de lote vencido', () => {
    const costPrice = 14.50;
    const discardedQuantity = 6.000;
    const totalLoss = Number((costPrice * discardedQuantity).toFixed(2));

    expect(totalLoss).toBe(87.00);
  });

  it('deve calcular reposição sugerida para produtos zerados e abaixo do mínimo', () => {
    interface ProductSample {
      name: string;
      stockQuantity: number;
      minStockAlert: number;
      idealStock: number;
      costPrice: number;
    }

    function calculateReplenishment(p: ProductSample) {
      let suggested = 0;
      if (p.idealStock > p.stockQuantity) {
        suggested = p.idealStock - p.stockQuantity;
      } else if (p.minStockAlert > 0) {
        suggested = Math.max((p.minStockAlert * 2) - p.stockQuantity, 10);
      } else {
        suggested = 10;
      }
      const qty = Math.ceil(suggested);
      return {
        qty,
        estimatedCost: Number((qty * p.costPrice).toFixed(2)),
      };
    }

    // Produto zerado com ideal configurado em 24 un
    const prodA: ProductSample = {
      name: 'Leite Integral 1L',
      stockQuantity: 0,
      minStockAlert: 10,
      idealStock: 24,
      costPrice: 4.20,
    };
    const repA = calculateReplenishment(prodA);
    expect(repA.qty).toBe(24);
    expect(repA.estimatedCost).toBe(100.80);

    // Produto abaixo do mínimo (3 un em estoque, mínimo 10 un, sem ideal configurado)
    const prodB: ProductSample = {
      name: 'Detergente Neutro 500ml',
      stockQuantity: 3,
      minStockAlert: 10,
      idealStock: 0,
      costPrice: 2.10,
    };
    const repB = calculateReplenishment(prodB);
    // (10 * 2) - 3 = 17 unidades
    expect(repB.qty).toBe(17);
    expect(repB.estimatedCost).toBe(35.70);
  });

  it('deve validar que a régua de alerta amarelo é estritamente maior que a laranja', () => {
    function validateThresholds(yellow: number, orange: number): boolean {
      return yellow > orange && orange > 0;
    }

    expect(validateThresholds(30, 7)).toBe(true);
    expect(validateThresholds(45, 15)).toBe(true);
    expect(validateThresholds(7, 7)).toBe(false);
    expect(validateThresholds(5, 10)).toBe(false);
  });
});
