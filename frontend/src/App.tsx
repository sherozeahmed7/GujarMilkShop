
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
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

function App() {
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
