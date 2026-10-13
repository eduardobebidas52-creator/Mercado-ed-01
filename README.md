# Mercado — Sistema de Gestão para Mini Mercado

> **Etapa 1: Arquitetura, Conexão e Estrutura Inicial**  
> Desenvolvido com React, Node.js (TypeScript), Express, PostgreSQL e preparado para deploy no Render.

---

## 1. Visão Geral da Arquitetura

O sistema **Mercado** foi planejado desde o primeiro dia para operar em ambiente de produção com robustez, segurança e persistência confiável.

```
┌─────────────────────────────────┐
│     Frontend (React 19 + TS)    │  Interface visual, responsiva, recolhível
└────────────────┬────────────────┘  Moeda R$, sem cálculos comerciais locais
                 │ HTTP REST (JSON)
                 ▼
┌─────────────────────────────────┐
│    Backend (Node.js + Express)  │  Regras de negócio centralizadas
│    Rotas /api, Validações,      │  Cálculo de totais, autorização RBAC
│    Middlewares e Erros Seguros  │  Sanitização total de respostas
└────────────────┬────────────────┘
                 │ Pool pg com SSL
                 ▼
┌─────────────────────────────────┐
│       PostgreSQL (Render)       │  Persistência com transações ACID
│     Tabela _migrations          │  Sem comandos destrutivos (DROP)
│     Esquemas e Auditoria        │  Backups e recuperação planejados
└─────────────────────────────────┘
```

### Princípios Inegociáveis
1. **Regras no Servidor**: O frontend nunca acessa diretamente o banco de dados nem calcula sozinho totais de vendas, preços, saldos devedores ou baixas de estoque.
2. **Segurança de Acesso**: Nenhuma senha em texto puro, credencial no código ou conta padrão com senha previsível ("admin", "123456"). O administrador inicial (**Eduardo**) terá suas credenciais configuradas de forma segura.
3. **Persistência Confiável**: Nenhum dado crítico em localStorage ou memória temporária. Uso de PostgreSQL com pool de conexões gerenciado.
4. **Zero Simulação Artificial**: Na Etapa 1, nenhum botão ou módulo fictício é apresentado como concluído. Onde não há dados, o sistema apresenta valores reais zerados (`R$ 0,00`) e estados vazios informativos.

---

## 2. Estrutura do Projeto

```
.
├── .env.example              # Modelo seguro de variáveis de ambiente sem segredos
├── render.yaml               # Blueprint do Render para Web Service e PostgreSQL
├── package.json              # Dependências e scripts de execução
├── server.ts                 # Ponto de entrada Full-Stack (Express + Vite em dev)
├── tsconfig.json             # Configuração TypeScript
├── vite.config.ts            # Configuração Vite e Tailwind v4
│
├── server/                   # Backend (Node.js + Express)
│   ├── config/
│   │   └── env.ts            # Validador de variáveis de ambiente e sanitizador
│   ├── db/
│   │   ├── connection.ts     # Gerenciador de pool do PostgreSQL (pg) com SSL
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql  # Tabela _migrations, users (RBAC) e auditoria
│   │       └── runner.ts     # Executor versionado de migrações em transação
│   ├── middleware/
│   │   ├── auth.ts           # Estrutura de autenticação Bearer JWT e RBAC
│   │   ├── errorHandler.ts   # Tratador global de erros (sem vazamento de senhas)
│   │   └── validate.ts       # Validador central de payloads HTTP
│   ├── routes/
│   │   ├── health.routes.ts  # Endpoints de diagnóstico seguro (/api/health)
│   │   └── index.ts          # Roteador mestre da API
│   └── services/
│       └── health.service.ts # Lógica de coleta de métricas e ping no banco
│
├── src/                      # Frontend (React 19 + TypeScript)
│   ├── api/
│   │   ├── client.ts         # Cliente HTTP tipado com tratamento de erros
│   │   └── health.ts         # Serviços de consumo do diagnóstico de saúde
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx    # Barra superior com 3 zonas e status em tempo real
│   │   │   └── Sidebar.tsx   # Menu lateral recolhível e gaveta mobile
│   │   └── ui/
│   │       ├── EmptyState.tsx   # Componente de estado vazio informativo
│   │       └── StatusBadge.tsx  # Indicador visual discreto e acessível
│   ├── pages/
│   │   ├── OverviewPage.tsx      # Visão geral, diagnósticos e valores reais zerados
│   │   ├── ArchitecturePage.tsx  # Diagrama de comunicação e fronteiras de segurança
│   │   ├── DatabaseStatusPage.tsx# Status do PostgreSQL, migrações e rotina de backup
│   │   └── PendingModulesPage.tsx# Módulos planejados para etapas futuras
│   ├── types/
│   │   └── index.ts          # Interfaces TypeScript do frontend
│   ├── App.tsx               # Componente raiz com navegação e estado
│   ├── index.css             # Estilos globais Tailwind CSS v4
│   └── main.tsx              # Ponto de montagem React DOM
│
└── tests/                    # Testes Automatizados (Vitest)
    ├── env.test.ts           # Teste de não-vazamento de credenciais
    ├── health.test.ts        # Teste de estrutura e métricas do health check
    └── migrations.test.ts    # Teste de integridade e proibição de comandos destrutivos
```

---

## 3. Comandos de Instalação e Execução

### Instalação das dependências
```bash
npm install
```

### Executar em Modo Desenvolvimento (Local / AI Studio)
Inicia o servidor Express full-stack na porta 3000 com middleware do Vite integrado:
```bash
npm run dev
```
Acesse no navegador: `http://localhost:3000`

### Executar os Testes Automatizados
Executa a suíte de testes com Vitest:
```bash
npm test
```

### Executar as Migrações do Banco de Dados
Aplica as migrações versionadas pendentes no PostgreSQL configurado na `DATABASE_URL`:
```bash
npm run migrate
```

### Compilar e Iniciar em Modo de Produção
```bash
npm run build
npm run start
```

---

## 4. Configuração de Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Campos configuráveis:
- `PORT`: Porta do servidor (padrão `3000`).
- `NODE_ENV`: Ambiente (`development` | `production` | `test`).
- `DATABASE_URL`: String de conexão PostgreSQL (ex: `postgresql://usuario:senha@localhost:5432/mercado_db`).
- `JWT_SECRET`: Chave secreta de pelo menos 32 caracteres para assinatura de tokens.
- `JWT_EXPIRES_IN`: Duração do token (ex: `8h`).

---

## 5. Publicação no Render

O projeto possui o arquivo `render.yaml` preparado para provisionamento em poucos cliques:

1. Suba o código no seu repositório Git/GitHub.
2. Acesse o painel do [Render](https://dashboard.render.com).
3. Selecione **Blueprints** -> **New Blueprint Instance**.
4. Conecte o repositório do **Mercado**.
5. O Render detectará automaticamente:
   - **mercado-app**: Web Service Node.js.
   - **mercado-db**: Instância PostgreSQL gerenciada.
6. A variável `DATABASE_URL` interna será vinculada automaticamente entre o banco e o web service.
7. O endpoint de verificação configurado no Render é `/api/health`.

---

## 6. Procedimentos de Backup e Recuperação

- **Backup Lógico via CLI**:
  ```bash
  pg_dump -Fc "$DATABASE_URL" > backup_mercado_$(date +%Y%m%d).dump
  ```
- **Restauração em Banco de Recuperação**:
  ```bash
  pg_restore --clean --if-exists -d "$DATABASE_URL" backup_mercado.dump
  ```
- No Render, instâncias pagas contam também com snapshots automáticos diários.
