/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Database, 
  Server, 
  Monitor, 
  Cloud, 
  CheckCircle2
} from 'lucide-react';

export const ArchitecturePage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho da Seção */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Arquitetura e Fluxo de Comunicação do Mercado
        </h2>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
          Definição detalhada de responsabilidades entre as camadas de interface, servidor HTTP e banco de dados relacional PostgreSQL.
        </p>
      </div>

      {/* Diagrama Visual das Camadas */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">
          Fluxo de Execução e Fronteiras de Segurança
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Camada 1: Frontend */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/60 relative">
            <div className="flex items-center gap-2.5 text-blue-700 font-semibold text-sm mb-3">
              <Monitor size={18} />
              <span>1. Frontend (Interface)</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              React 19 + TypeScript + Tailwind CSS. Responsável apenas por visualização, captura de dados do operador e apresentação.
            </p>
            <div className="space-y-1.5 text-[11px] text-slate-500 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Zero regras de precificação</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Zero acesso direto ao banco</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Requisições HTTP REST com JSON</span>
              </div>
            </div>
          </div>

          {/* Seta 1 */}
          <div className="hidden md:flex absolute top-1/2 left-[32%] -translate-y-1/2 -translate-x-1/2 z-10 p-1.5 bg-white border border-slate-200 rounded-full text-slate-400 shadow-xs">
            <ArrowRight size={14} />
          </div>

          {/* Camada 2: Backend */}
          <div className="border-2 border-blue-500/80 rounded-xl p-5 bg-blue-50/20 relative">
            <div className="flex items-center gap-2.5 text-blue-800 font-semibold text-sm mb-3">
              <Server size={18} />
              <span>2. Backend (API HTTP)</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Node.js + Express + TypeScript. Onde todas as regras de negócio, validações, cálculos de totais, estoque e autorização residem.
            </p>
            <div className="space-y-1.5 text-[11px] text-slate-500 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Validação estrita de entradas</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Autenticação Bearer JWT & RBAC</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Sanitização total de erros</span>
              </div>
            </div>
          </div>

          {/* Seta 2 */}
          <div className="hidden md:flex absolute top-1/2 left-[65.5%] -translate-y-1/2 -translate-x-1/2 z-10 p-1.5 bg-white border border-slate-200 rounded-full text-slate-400 shadow-xs">
            <ArrowRight size={14} />
          </div>

          {/* Camada 3: Banco de Dados */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/60 relative">
            <div className="flex items-center gap-2.5 text-blue-700 font-semibold text-sm mb-3">
              <Database size={18} />
              <span>3. Banco PostgreSQL</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Instância relacional no Render. Persistência permanente com integridade referencial, transações ACID e migrações versionadas.
            </p>
            <div className="space-y-1.5 text-[11px] text-slate-500 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Conexão via Pool (pg) com SSL</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Tabela _migrations versionada</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Sem comandos destrutivos DROP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regras Críticas de Negócio e Segurança */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-sm mb-3">
            <ShieldCheck size={18} className="text-blue-600" />
            <span>Regras Inegociáveis do Backend</span>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-400">·</span>
              <span><strong>Preços e Totais:</strong> O frontend apenas envia os itens e quantidades. O backend busca os preços oficiais no banco, calcula subtotais, descontos permitidos e o total final.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-400">·</span>
              <span><strong>Estoque e Vendas:</strong> Toda baixa de estoque e registro de venda é executada em transação atômica (<code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">BEGIN ... COMMIT</code>), impedindo estoque negativo ou venda fantasma.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-400">·</span>
              <span><strong>Saldos de Fiado:</strong> Nenhum débito ou crédito é alterado sem lançamento contábil auditado atrelado ao operador autenticado.</span>
            </li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-sm mb-3">
            <Lock size={18} className="text-blue-600" />
            <span>Segurança e Acesso do Administrador (Eduardo)</span>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-400">·</span>
              <span><strong>Sem senhas previsíveis:</strong> Não existe senha padrão no código fonte (proibido "admin", "123456", "mercado").</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-400">·</span>
              <span><strong>Criptografia Forte:</strong> Senhas são salvas exclusivamente como hash criptográfico irreversível.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-400">·</span>
              <span><strong>Controle de Cargos (RBAC):</strong> Perfis <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">admin</code>, <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">gerente</code> e <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">operador</code> delimitam o acesso a funções financeiras.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Publicação no Render */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-sm mb-3">
          <Cloud size={18} className="text-blue-600" />
          <span>Estratégia de Publicação no Render</span>
        </div>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          O repositório inclui o arquivo de blueprint <strong className="text-slate-800 font-mono">render.yaml</strong>. Ao conectar o GitHub no Render, o Blueprint provisiona automaticamente:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="font-semibold text-slate-800 mb-1">Web Service (Aplicação Node.js)</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Executa o build com <code className="text-slate-700 bg-slate-200/60 px-1 py-0.5 rounded font-mono">npm install && npm run build</code> e inicia com <code className="text-slate-700 bg-slate-200/60 px-1 py-0.5 rounded font-mono">npm run start</code>. Rota de verificação em <code className="text-slate-700 bg-slate-200/60 px-1 py-0.5 rounded font-mono">/api/health</code>.
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="font-semibold text-slate-800 mb-1">Banco de Dados PostgreSQL Gerenciado</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              O Render vincula a variável de ambiente <code className="text-slate-700 bg-slate-200/60 px-1 py-0.5 rounded font-mono">DATABASE_URL</code> interna diretamente ao Web Service, com conexões criptografadas por SSL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
