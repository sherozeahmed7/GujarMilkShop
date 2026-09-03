import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { posConfigService, POSConfigData } from '../../services/posConfig.service';
import { buildTestPage } from '../../utils/escposBuilder';
import { ReceiptPreview } from '../../components/pos/ReceiptPreview';

// Tauri invoke — safe lazy wrapper, avoids top-level await which breaks React module loading
async function safeInvoke<T>(cmd: string, args?: unknown): Promise<T> {
  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  if (!isTauri) {
    throw new Error('You are viewing the app in a web browser. Printer testing only works inside the Desktop App.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args as Record<string, unknown>);
}

export const POSConfig: React.FC = () => {
  const [config, setConfig] = useState<POSConfigData>({
    shopName: 'Gujar Milk Shop',
    taxRate: 0,
    currencySymbol: 'Rs.',
    lowStockAlertThreshold: 5,
    printReceiptAutomatically: false,
    showLogoOnReceipt: false,
    receiptFooterText: 'Thank you for your visit!',
    receiptWidth: '80mm',
    printerEnabled: true,
    printerName: '',
    autoCutter: true,
    cashDrawer: false,
    requireCustomerName: false,
    allowDiscount: true,
    maxDiscountPercent: 10,
    defaultPaymentMethod: 'cash',
    showDailyRateOnPOS: true,
    showCartSubtotal: true,
    confirmBeforeSale: false,
    autoClearCartAfterSale: false
  });

  const [savedConfig, setSavedConfig] = useState<POSConfigData | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await posConfigService.getPOSConfig();
      setConfig(data);
      setSavedConfig(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load POS Configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrinters = useCallback(async () => {
    try {
      const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      if (!isTauri) return;
      const printers = await safeInvoke<string[]>('list_printers');
      setAvailablePrinters(printers);
    } catch (err) {
      console.error('Failed to load printers', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadPrinters();
  }, [loadConfig, loadPrinters]);

  const handleUpdate = async () => {
    setSuccessMsg(null);
    setError(null);

    setSaving(true);
    try {
      const updated = await posConfigService.updatePOSConfig(config);
      setConfig(updated);
      setSavedConfig(updated);
      setSuccessMsg('POS Configuration updated successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update POS Configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (savedConfig) {
      setConfig(savedConfig);
      setSuccessMsg(null);
      setError(null);
    }
  };

  const handleChange = (field: keyof POSConfigData, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
  };

  return (
    <div className="flex flex-col h-full gap-6 min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">POS Configuration</h1>
          <p className="text-slate-500 text-sm mt-1">Configure general point of sale behaviour, receipts, and display settings.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadConfig}
            disabled={loading || saving}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={handleReset}
            disabled={!hasChanges || loading || saving}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            Reset
          </button>

          <button
            onClick={handleUpdate}
            disabled={!hasChanges || loading || saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex-shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-medium">
          {successMsg}
        </div>
      )}

      {/* Main Content Areas */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row gap-6">
        
        {loading && !savedConfig ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading configuration...</div>
        ) : (
          <>
            <div className="flex-1 flex flex-col gap-6">
            {/* Section 1 - General POS Settings */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">General POS Settings</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
                    <input
                      type="text"
                      value={config.shopName}
                      onChange={(e) => handleChange('shopName', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Currency Symbol</label>
                    <input
                      type="text"
                      value={config.currencySymbol}
                      onChange={(e) => handleChange('currencySymbol', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={config.taxRate}
                      onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={config.lowStockAlertThreshold}
                      onChange={(e) => handleChange('lowStockAlertThreshold', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 - Receipt Settings */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Receipt Settings</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-4 justify-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.printReceiptAutomatically}
                        onChange={(e) => handleChange('printReceiptAutomatically', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-slate-700">Print Receipt Automatically</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showLogoOnReceipt}
                        onChange={(e) => handleChange('showLogoOnReceipt', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-slate-700">Show Logo on Receipt</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Width</label>
                    <select
                      value={config.receiptWidth}
                      onChange={(e) => handleChange('receiptWidth', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="58mm">58mm</option>
                      <option value="80mm">80mm</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Footer Text</label>
                    <textarea
                      rows={3}
                      value={config.receiptFooterText}
                      onChange={(e) => handleChange('receiptFooterText', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3 - Sale Behaviour */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Sale Behaviour</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-4 justify-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.requireCustomerName}
                        onChange={(e) => handleChange('requireCustomerName', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-slate-700">Require Customer Name on Walk-in Sales</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.allowDiscount}
                        onChange={(e) => handleChange('allowDiscount', e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-slate-700">Allow Discounts</span>
                    </label>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Max Discount (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        disabled={!config.allowDiscount}
                        value={config.maxDiscountPercent}
                        onChange={(e) => handleChange('maxDiscountPercent', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Default Payment Method</label>
                      <select
                        value={config.defaultPaymentMethod}
                        onChange={(e) => handleChange('defaultPaymentMethod', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="cash">Cash</option>
                        <option value="online">Online</option>
                        <option value="split">Split</option>
                        <option value="khata">Khata</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4 - Display Preferences */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Display Preferences</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showDailyRateOnPOS}
                      onChange={(e) => handleChange('showDailyRateOnPOS', e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Show Daily Rate on POS Screen</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showCartSubtotal}
                      onChange={(e) => handleChange('showCartSubtotal', e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Show Cart Subtotal</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.confirmBeforeSale}
                      onChange={(e) => handleChange('confirmBeforeSale', e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Confirm Before Sale</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.autoClearCartAfterSale}
                      onChange={(e) => handleChange('autoClearCartAfterSale', e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Auto-Clear Cart After Sale</span>
                  </label>
                </div>
              </div>
            </div>
            {/* Section 5 - Printer Settings */}
            <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Thermal Printer Settings</h2>
                <p className="text-xs text-slate-500 mt-0.5">Configure the BC-105 (or any ESC/POS printer) for silent automatic receipt printing.</p>
              </div>
              <div className="p-6 flex flex-col gap-6">
                {/* Enable / Disable printer */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.printerEnabled}
                    onChange={(e) => handleChange('printerEnabled', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">Printer Enabled</span>
                    <p className="text-xs text-slate-400">Must be ON for automatic printing to work.</p>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Windows Printer
                  </label>
                  {availablePrinters.length > 0 ? (
                    <select
                      disabled={!config.printerEnabled}
                      value={config.printerName}
                      onChange={(e) => handleChange('printerName', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50 disabled:bg-slate-50"
                    >
                      <option value="">-- Select Printer --</option>
                      {availablePrinters.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled={!config.printerEnabled}
                      value={config.printerName}
                      onChange={(e) => handleChange('printerName', e.target.value)}
                      placeholder="e.g. BC-105"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50 disabled:bg-slate-50"
                    />
                  )}
                  <p className="text-xs text-slate-400 mt-1">Install the printer in Windows first, then it will appear here automatically.</p>
                </div>

                {/* Auto cutter */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!config.printerEnabled}
                    checked={config.autoCutter}
                    onChange={(e) => handleChange('autoCutter', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 disabled:opacity-50"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">Auto Cutter</span>
                    <p className="text-xs text-slate-400">Send ESC/POS cut command after each receipt (BC-105 supports this).</p>
                  </div>
                </label>

                {/* Cash Drawer - disabled for now */}
                <label className="flex items-center gap-3 cursor-not-allowed opacity-50">
                  <input type="checkbox" disabled checked={false} className="w-5 h-5 rounded border-slate-300 accent-emerald-600" />
                  <div>
                    <span className="text-sm font-medium text-slate-700">Cash Drawer Kick</span>
                    <p className="text-xs text-slate-400">Not implemented — requires hardware confirmation.</p>
                  </div>
                </label>
                
                {/* Test Printer Button */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    disabled={!config.printerEnabled || !config.printerName}
                    onClick={async () => {
                      try {
                        const bytes = buildTestPage(config.printerName, config.autoCutter);
                        await safeInvoke('print_raw_bytes', {
                          printerName: config.printerName,
                          data: bytes
                        });
                        toast.success('Test print sent to printer!');
                      } catch (err: any) {
                        toast.error(`Print Failed: ${err}`);
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    🖨 Test Printer Connection
                  </button>
                </div>
              </div>
            </div>

            </div>

            {/* Receipt Preview Pane */}
            <div className="w-full lg:w-96 flex-shrink-0 mb-6 lg:mb-0">
              <ReceiptPreview config={config} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
