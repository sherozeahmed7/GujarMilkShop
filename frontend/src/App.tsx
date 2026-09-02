import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { apiClient } from './services/apiClient';
import { SessionExpiredModal } from './components/SessionExpiredModal';

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

  // Poll for backend health on mount or refresh
  useEffect(() => {
    if (backendReady) return;

    let isMounted = true;
    let timeoutId: any;

    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/health', { cache: 'no-store' });
        if (res.ok && isMounted) {
          setBackendReady(true);
          setBackendError(null);
          return;
        }
      } catch (e) {
        // Backend not ready yet
      }

      if (isMounted) {
        timeoutId = setTimeout(checkHealth, 300);
      }
    };

    checkHealth();

    // Fallback timeout warning after 45 seconds if backend still hasn't answered
    const warningTimeout = setTimeout(() => {
      if (isMounted && !backendReady) {
        setBackendError("POS backend is taking longer than usual to respond. Please ensure port 5000 is open.");
      }
    }, 45000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      clearTimeout(warningTimeout);
    };
  }, [backendReady]);

  // Test connection to backend if token exists
  const token = localStorage.getItem('token');
  const { data } = useQuery({
    queryKey: ['connectionTest'],
    queryFn: () => apiClient.get('/connection-test'),
    enabled: !!token && backendReady, // Only fetch connection test if user is logged in AND backend is ready
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

  if (!backendReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <h2>Starting Services...</h2>
        <p>Please wait while the POS backend starts.</p>
      </div>
    );
  }

  return (
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
  );
}

export default App;
