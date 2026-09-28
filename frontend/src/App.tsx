import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { apiClient } from './services/apiClient';
import { SessionExpiredModal } from './components/SessionExpiredModal';
import { ThemeProvider } from './context/ThemeContext';

// Page Imports
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { DailyRates } from './pages/settings/DailyRates';
import { ShopInfo } from './pages/settings/ShopInfo';
import { POSConfig } from './pages/settings/POSConfig';
import { UsersRoles } from './pages/settings/UsersRoles';
import { CloudSync } from './pages/settings/CloudSync';
import { LocalBackup } from './pages/settings/LocalBackup';
import { Suppliers } from './pages/Suppliers';
import { Customers } from './pages/Customers';
import { KhataLedger } from './pages/KhataLedger';
import { CustomerMonthlyMilkLedger } from './pages/khata/CustomerMonthlyMilkLedger';
import { SupplierMonthlyPurchaseLedger } from './pages/khata/SupplierMonthlyPurchaseLedger';
import { Returns } from './pages/Returns';
import { ReceiptAudit } from './pages/ReceiptAudit';
import { Shifts } from './pages/Shifts';
import { CashRegister } from './pages/CashRegister';
import { ZReport } from './pages/ZReport';
import { Expenses } from './pages/Expenses';
import { Cashbook } from './pages/cashbook/Cashbook';
import { CashPersonLedger } from './pages/cashbook/CashPersonLedger';

// Reports Imports
import { SalesReport } from './pages/reports/SalesReport';
import { ProfitLossReport } from './pages/reports/ProfitLossReport';
import { SupplierReport } from './pages/reports/SupplierReport';
import { CustomerReport } from './pages/reports/CustomerReport';
import { InventoryReport } from './pages/reports/InventoryReport';
import { ReturnsReport } from './pages/reports/ReturnsReport';
import { CashRegisterReport } from './pages/reports/CashRegisterReport';
import { ShiftsReport } from './pages/reports/ShiftsReport';
import { ExpensesReport } from './pages/reports/ExpensesReport';
import { BackupReport } from './pages/reports/BackupReport';
import { ActivityLogs } from './pages/reports/ActivityLogs';
import { F2SalesReport } from './pages/reports/F2SalesReport';

/**
 * ProtectedRoute Component:
 * Restricts access to app routes if user is not authenticated (token missing from localStorage).
 */
const ProtectedRoute = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

/**
 * PublicOnlyRoute Component:
 * Prevents logged-in users from viewing public pages like /login (redirects them to home /).
 */
const PublicOnlyRoute = () => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Helper to update the HTML splash screen text + progress bar
  const setSplashStatus = (text: string, pct: number) => {
    const splashEl = document.getElementById('splash-screen');
    if (!splashEl) return;
    const fillEl = splashEl.querySelector('.progress-fill') as HTMLElement | null;
    const textEl = splashEl.querySelector('.progress-text') as HTMLElement | null;
    if (fillEl) {
      fillEl.style.animation = 'none';
      fillEl.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      fillEl.style.width = `${pct}%`;
    }
    if (textEl) textEl.textContent = text;
  };

  // Dismiss splash with a smooth fade-out
  const dismissSplash = () => {
    const splashEl = document.getElementById('splash-screen');
    if (!splashEl) return;
    setSplashStatus('Ready!', 100);
    setTimeout(() => {
      splashEl.style.transition = 'opacity 0.3s ease-out';
      splashEl.style.opacity = '0';
      splashEl.style.pointerEvents = 'none';
      setTimeout(() => splashEl.remove(), 320);
    }, 350);
  };

  // Poll backend health and drive loading screen progress
  useEffect(() => {
    if (backendReady) return;

    let isMounted = true;
    let attempt = 0;
    let timeoutId: any;

    // Status messages shown progressively while waiting for the backend
    const statusStages = [
      { after: 0,    text: 'Starting backend server…',   pct: 10 },
      { after: 2000, text: 'Connecting to database…',    pct: 35 },
      { after: 5000, text: 'Loading system data…',       pct: 55 },
      { after: 9000, text: 'Almost ready…',              pct: 75 },
      { after: 15000, text: 'Finalising startup…',       pct: 85 },
    ];

    const startTime = Date.now();

    // Advance splash text based on elapsed time (independent of health polls)
    const advanceSplash = () => {
      const elapsed = Date.now() - startTime;
      const stage = [...statusStages].reverse().find(s => elapsed >= s.after);
      if (stage) setSplashStatus(stage.text, stage.pct);
    };

    // Initial splash state
    setSplashStatus('Starting backend server…', 10);

    const splashInterval = setInterval(() => {
      if (isMounted) advanceSplash();
    }, 500);

    const checkHealth = async () => {
      attempt++;
      try {
        const res = await fetch('http://localhost:5000/api/health', { cache: 'no-store' });
        if (res.ok && isMounted) {
          clearInterval(splashInterval);
          setSplashStatus('Backend ready!', 95);
          // Brief pause so user sees "Backend ready!" before the login page appears
          setTimeout(() => {
            if (isMounted) {
              setBackendReady(true);
              setBackendError(null);
              dismissSplash();
            }
          }, 400);
          return;
        }
      } catch (_) {
        // Backend not up yet — keep polling silently
      }

      if (isMounted) {
        timeoutId = setTimeout(checkHealth, 300);
      }
    };

    checkHealth();

    // Timeout after 60 seconds
    const warningTimeout = setTimeout(() => {
      if (isMounted && !backendReady) {
        clearInterval(splashInterval);
        setBackendError('POS backend did not start within 60 seconds. Please restart the application.');
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(splashInterval);
      clearTimeout(timeoutId);
      clearTimeout(warningTimeout);
    };
  }, [backendReady]);

  // Test connection to backend if token exists
  const token = localStorage.getItem('token');
  const { data } = useQuery({
    queryKey: ['connectionTest'],
    queryFn: () => apiClient.get('/connection-test'),
    enabled: !!token && backendReady,
  });

  const handleRetry = () => {
    setBackendError(null);
    setBackendReady(false);
  };

  if (backendError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', color: 'red', textAlign: 'center', padding: '20px' }}>
        <h2>Error Starting POS</h2>
        <pre style={{ background: '#ffeeee', padding: '10px', borderRadius: '4px', maxWidth: '80%', whiteSpace: 'pre-wrap', color: '#333' }}>
          {backendError}
        </pre>
        <button
          onClick={handleRetry}
          style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Don't mount any routes until the backend is confirmed alive.
  // The HTML splash screen covers the viewport while we wait.
  if (!backendReady) {
    return null;
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        {/* Global session-expired modal — shown whenever apiClient receives a 401 */}
        <SessionExpiredModal />
        <Routes>
          {/* Public Routes (Accessible only when NOT logged in) */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Protected Routes (Requires valid token in localStorage) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<POS />} />
              <Route path="products" element={<Products />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="customers" element={<Customers />} />
              <Route path="ledger">
                <Route index element={<KhataLedger />} />
                <Route path="customers/:customerId" element={<CustomerMonthlyMilkLedger />} />
                <Route path="suppliers/:supplierId" element={<SupplierMonthlyPurchaseLedger />} />
              </Route>
              <Route path="returns" element={<Returns />} />
              <Route path="audit" element={<ReceiptAudit />} />
              <Route path="shifts" element={<Shifts />} />
              <Route path="register">
                <Route index element={<CashRegister />} />
                <Route path="cashbook" element={<Cashbook />} />
                <Route path="cashbook/ledger/:personId" element={<CashPersonLedger />} />
              </Route>
              <Route path="zreport" element={<ZReport />} />
              <Route path="sales" element={<Sales />} />

              {/* Settings Routes */}
              <Route path="settings">
                <Route index element={<Navigate to="daily-rates" replace />} />
                <Route path="daily-rates" element={<DailyRates />} />
                <Route path="shop-info" element={<ShopInfo />} />
                <Route path="pos-config" element={<POSConfig />} />
                <Route path="users-roles" element={<UsersRoles />} />
                <Route path="cloud-sync" element={<CloudSync />} />
                <Route path="local-backup" element={<LocalBackup />} />
              </Route>

              <Route path="expenses" element={<Expenses />} />

              {/* Reports Routes */}
              <Route path="reports">
                <Route path="sales" element={<SalesReport />} />
                <Route path="profit-loss" element={<ProfitLossReport />} />
                <Route path="suppliers" element={<SupplierReport />} />
                <Route path="customers" element={<CustomerReport />} />
                <Route path="inventory" element={<InventoryReport />} />
                <Route path="returns" element={<ReturnsReport />} />
                <Route path="cash-register" element={<CashRegisterReport />} />
                <Route path="shifts" element={<ShiftsReport />} />
                <Route path="expenses" element={<ExpensesReport />} />
                <Route path="backups" element={<BackupReport />} />
                <Route path="logs" element={<ActivityLogs />} />
                <Route path="f2-sales" element={<F2SalesReport />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
