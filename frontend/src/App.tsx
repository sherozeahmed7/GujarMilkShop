import { useEffect } from 'react';
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
  // Test connection to backend if token exists
  const token = localStorage.getItem('token');
  const { data } = useQuery({
    queryKey: ['connectionTest'],
    queryFn: () => apiClient.get('/connection-test'),
    enabled: !!token, // Only fetch connection test if user is logged in
  });

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
            <Route path="register" element={<CashRegister />} />
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
