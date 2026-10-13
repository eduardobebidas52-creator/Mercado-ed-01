/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  User, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setupStatus, login, setupAdmin } = useAuth();

  const isFirstSetup = !setupStatus?.isInitialized;

  const [name, setName] = useState('Eduardo');
  const [email, setEmail] = useState('eduardobebidas52@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isFirstSetup) {
        if (password.length < 8) {
          throw new Error('A senha deve conter no mínimo 8 caracteres.');
        }
        if (password !== confirmPassword) {
          throw new Error('As senhas digitadas não coincidem.');
        }

        await setupAdmin({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        });

        setSuccessMessage('Administrador Eduardo configurado com sucesso!');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        await login(email.trim(), password);
        setSuccessMessage('Login efetuado com sucesso!');
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho do Modal */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              M
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isFirstSetup ? 'Configuração Inicial do Administrador' : 'Acessar Sistema Mercado'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isFirstSetup ? 'Primeiro acesso de Eduardo (Admin)' : 'Identifique-se para gerenciar o mercado'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Mensagens de Sucesso e Erro */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {isFirstSetup && (
            <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-lg text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                Esta será a conta mestra com acesso irrestrito para gerenciar o Mercado, cadastrar funcionários e fechar caixas.
              </span>
            </div>
          )}

          {/* Campo Nome (Apenas no primeiro cadastro) */}
          {isFirstSetup && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome do Administrador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-900 bg-white"
                  placeholder="Eduardo"
                />
              </div>
            </div>
          )}

          {/* Campo E-mail */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              E-mail de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail size={15} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-900 bg-white"
                placeholder="seuemail@exemplo.com"
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {isFirstSetup ? 'Criar Senha Forte (mínimo 8 dígitos)' : 'Senha de Acesso'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={15} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-900 bg-white"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirmar Senha (Apenas no primeiro cadastro) */}
          {isFirstSetup && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-900 bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {/* Botão de Envio */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Processando...' : isFirstSetup ? 'Criar Conta do Administrador' : 'Entrar no Sistema'}</span>
              {!loading && <ArrowRight size={14} />}
            </button>
          </div>
        </form>

        {/* Rodapé com Política de Segurança */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
          Criptografia bcrypt e assinatura com tokens JWT
        </div>
      </div>
    </div>
  );
};
