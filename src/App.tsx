/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewPage } from './pages/OverviewPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { DatabaseStatusPage } from './pages/DatabaseStatusPage';
import { PendingModulesPage } from './pages/PendingModulesPage';
import { ProductsPage } from './pages/ProductsPage';
import { PosPage } from './pages/PosPage';
import { ExpiryAlertsPage } from './pages/ExpiryAlertsPage';
import { StockAlertsPage } from './pages/StockAlertsPage';
import { CustomersPage } from './pages/CustomersPage';
import { CreditAlertsPage } from './pages/CreditAlertsPage';
import { ReceivablesPage } from './pages/ReceivablesPage';
import { ActiveTab, SystemHealth } from './types';
import { fetchSystemHealth } from './api/health';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';

function AppContent() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSystemHealth();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col md:flex-row font-sans antialiased">
      {/* Menu Lateral Recolhível */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Barra Superior */}
        <Header
          activeTab={activeTab}
          onOpenMobile={() => setMobileOpen(true)}
          health={health}
          loading={loading}
          onRefresh={loadHealth}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />

        {/* Conteúdo da Página Selecionada */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewPage
              health={health}
              loading={loading}
              error={error}
              onRefresh={loadHealth}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'pos' && <PosPage />}

          {activeTab === 'products' && <ProductsPage />}

          {activeTab === 'expiry-alerts' && <ExpiryAlertsPage />}

          {activeTab === 'stock-alerts' && <StockAlertsPage />}

          {activeTab === 'credit-alerts' && (
            <CreditAlertsPage
              token={token}
              onNavigateToCustomers={() => setActiveTab('customers')}
              onNavigateToReceivables={() => setActiveTab('receivables')}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersPage
              token={token}
              onNavigateToCreditAlerts={() => setActiveTab('credit-alerts')}
              onNavigateToReceivables={() => setActiveTab('receivables')}
            />
          )}

          {activeTab === 'receivables' && (
            <ReceivablesPage
              token={token}
              onNavigateToCustomers={() => setActiveTab('customers')}
              onNavigateToCreditAlerts={() => setActiveTab('credit-alerts')}
            />
          )}

          {activeTab === 'architecture' && <ArchitecturePage />}

          {activeTab === 'database' && <DatabaseStatusPage health={health} />}

          {activeTab === 'roadmap' && <PendingModulesPage />}
        </main>
      </div>

      {/* Modal de Autenticação / Cadastro Inicial */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
