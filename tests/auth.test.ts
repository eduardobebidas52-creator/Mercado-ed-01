/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { generateAuthToken, verifyAuthToken, AuthUser } from '../server/services/auth.service.js';

describe('Segurança de Autenticação e Criptografia', () => {
  const mockUser: AuthUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Eduardo',
    email: 'eduardobebidas52@gmail.com',
    role: 'admin',
  };

  it('deve gerar e verificar tokens JWT assinados corretamente', () => {
    const token = generateAuthToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // Header.Payload.Signature

    const decoded = verifyAuthToken(token);
    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.name).toBe('Eduardo');
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.role).toBe('admin');
  });

  it('deve rejeitar tokens adulterados', () => {
    const validToken = generateAuthToken(mockUser);
    const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

    expect(() => verifyAuthToken(tamperedToken)).toThrow();
  });

  it('deve criptografar senhas com salt bcrypt e validar comparação', async () => {
    const plainPassword = 'MinhaSenhaForte@2026';
    const hash = await bcrypt.hash(plainPassword, 10);

    expect(hash).not.toBe(plainPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const matches = await bcrypt.compare(plainPassword, hash);
    expect(matches).toBe(true);

    const wrongMatches = await bcrypt.compare('SenhaIncorreta123', hash);
    expect(wrongMatches).toBe(false);
  });
});
