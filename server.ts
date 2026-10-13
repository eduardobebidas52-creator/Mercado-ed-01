/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes/index.js';
import { errorHandler } from './server/middleware/errorHandler.js';
import { env } from './server/config/env.js';
import { closeDbPool } from './server/db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Middlewares essenciais de parsing de requisição
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rotas da API Backend HTTP
  app.use('/api', apiRouter);

  // Integração com Frontend (Vite em dev / Arquivos estáticos em prod)
  if (env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const fs = await import('fs');
    const distPath = fs.existsSync(path.resolve(__dirname, 'index.html'))
      ? __dirname
      : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Middleware centralizado de tratamento de erros
  app.use(errorHandler);

  // Inicialização do servidor na porta definida
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[Mercado Backend] Servidor ativo em http://0.0.0.0:${env.PORT}`);
    console.log(`[Mercado Backend] Ambiente: ${env.NODE_ENV}`);
    console.log(`[Mercado Backend] Rota de integridade: http://localhost:${env.PORT}/api/health`);

    if (env.DATABASE_URL) {
      import('./server/db/migrations/runner.js')
        .then(m => m.runMigrations())
        .then(r => console.log('[Mercado Backend] Migrações automáticas:', r.executed))
        .catch(err => console.warn('[Mercado Backend] Auto-migração:', err));
    }
  });

  // Encerramento seguro (Graceful Shutdown)
  const shutdown = async (signal: string) => {
    console.log(`[Mercado Backend] Recebido sinal ${signal}. Encerrando conexões...`);
    server.close(async () => {
      await closeDbPool();
      console.log('[Mercado Backend] Servidor finalizado com sucesso.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return { app, server };
}

// Inicia o servidor
startServer().catch((err) => {
  console.error('[Mercado Backend] Falha fatal ao iniciar o servidor:', err);
  process.exit(1);
});
