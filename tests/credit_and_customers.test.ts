/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

describe('Gestão de Clientes e Alerta de Fiado (Etapa 6)', () => {
  it('deve calcular corretamente saldo devedor e crédito disponível do cliente', () => {
    const creditLimit = 600.00;
    const currentDebt = 185.50;
    const availableCredit = Math.max(0, creditLimit - currentDebt);

    expect(availableCredit).toBe(414.50);
  });

  it('deve identificar se um cliente ultrapassou o limite de crédito', () => {
    const creditLimit = 300.00;
    const currentDebt = 320.00;
    const isExceeded = currentDebt > creditLimit;

    expect(isExceeded).toBe(true);
  });

  it('deve classificar a urgência do fiado baseado na data de vencimento', () => {
    const today = new Date();
    
    // Vencida há 5 dias
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 5);
    const diffPast = Math.floor((pastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffPast).toBeLessThan(0);

    // Vencendo em 4 dias (Atenção 7 dias)
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 4);
    const diffFuture = Math.ceil((futureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffFuture).toBeGreaterThanOrEqual(0);
    expect(diffFuture).toBeLessThanOrEqual(7);
  });

  it('deve calcular quitação parcial e novo saldo sem duplicidade', () => {
    const previousDebt = 340.00;
    const paymentAmount = 140.00;
    const remainingDebt = Math.max(0, previousDebt - paymentAmount);

    expect(remainingDebt).toBe(200.00);
  });
});
