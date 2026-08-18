import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { apiClient } from './services/apiClient';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Settings } from './pages/Settings';
import { Suppliers } from './pages/Suppliers';
import { Customers } from './pages/Customers';
import { KhataLedger } from './pages/KhataLedger';
import { Returns } from './pages/Returns';
import { ReceiptAudit } from './pages/ReceiptAudit';
import { Shifts } from './pages/Shifts';
import { CashRegister } from './pages/CashRegister';
import { ZReport } from './pages/ZReport';
import { Backup } from './pages/Backup';
import { Expenses } from './pages/Expenses';
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

function App() {
  // Use TanStack React Query to fetch connection status
  const { data } = useQuery({
    queryKey: ['connectionTest'],
    queryFn: () => apiClient.get('/connection-test'),
  });

  useEffect(() => {
    if (data && data.status === 'success' && data.data?.message) {
      alert(data.data.message);
    }
  }, [data]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="customers" element={<Customers />} />
          <Route path="ledger" element={<KhataLedger />} />
          <Route path="returns" element={<Returns />} />
          <Route path="audit" element={<ReceiptAudit />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="register" element={<CashRegister />} />
          <Route path="zreport" element={<ZReport />} />
          <Route path="backup" element={<Backup />} />
          <Route path="sales" element={<Sales />} />
          <Route path="settings" element={<Settings />} />
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
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
