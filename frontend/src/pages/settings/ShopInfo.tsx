import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { shopInfoService, ShopInfoData } from '../../services/shopInfo.service';

export const ShopInfo: React.FC = () => {
  const [config, setConfig] = useState<ShopInfoData>({
    businessName: '',
    tagline: '',
    ownerName: '',
    businessType: 'Retail',
    
    primaryPhone: '',
    secondaryPhone: '',
    emailAddress: '',
    website: '',
    
    addressLine1: '',
    addressLine2: '',
    city: '',
    zipCode: '',
  });

  const [savedConfig, setSavedConfig] = useState<ShopInfoData | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopInfoService.getShopInfo();
      setConfig(data);
      setSavedConfig(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Shop Info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleUpdate = async () => {
    setSuccessMsg(null);
    setError(null);

    setSaving(true);
    try {
      const updated = await shopInfoService.updateShopInfo(config);
      setConfig(updated);
      setSavedConfig(updated);
      setSuccessMsg('Shop Info updated successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update Shop Info');
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

  const handleChange = (field: keyof ShopInfoData, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
  };

  return (
    <div className="flex flex-col h-full gap-6 min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Shop Info</h1>
          <p className="text-slate-500 text-sm mt-1">Manage basic information, contact details, and shop location.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadConfig}
            disabled={loading || saving}
            className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#142119] text-slate-700 dark:text-[#e2f5e8] px-4 py-2 rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={handleReset}
            disabled={!hasChanges || loading || saving}
            className="bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#142119] text-slate-700 dark:text-[#e2f5e8] px-4 py-2 rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
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
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
        
        {loading && !savedConfig ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading Shop Info...</div>
        ) : (
          <>
            {/* Section 1 - Basic Information */}
            <div className="flex-shrink-0 bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35]">
                <h2 className="text-lg font-bold text-slate-800">Basic Information</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                    <input
                      type="text"
                      value={config.businessName}
                      onChange={(e) => handleChange('businessName', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name</label>
                    <input
                      type="text"
                      value={config.ownerName}
                      onChange={(e) => handleChange('ownerName', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tagline / Slogan</label>
                    <input
                      type="text"
                      value={config.tagline}
                      onChange={(e) => handleChange('tagline', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Type</label>
                    <select
                      value={config.businessType}
                      onChange={(e) => handleChange('businessType', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                      <option value="Both">Both</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 - Contact Details */}
            <div className="flex-shrink-0 bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35]">
                <h2 className="text-lg font-bold text-slate-800">Contact Details</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primary Phone *</label>
                    <input
                      type="text"
                      value={config.primaryPhone}
                      onChange={(e) => handleChange('primaryPhone', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Phone</label>
                    <input
                      type="text"
                      value={config.secondaryPhone}
                      onChange={(e) => handleChange('secondaryPhone', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={config.emailAddress}
                      onChange={(e) => handleChange('emailAddress', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={config.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3 - Location */}
            <div className="flex-shrink-0 bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35]">
                <h2 className="text-lg font-bold text-slate-800">Location</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={config.addressLine1}
                      onChange={(e) => handleChange('addressLine1', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={config.addressLine2}
                      onChange={(e) => handleChange('addressLine2', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={config.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ZIP / Postal Code</label>
                    <input
                      type="text"
                      value={config.zipCode}
                      onChange={(e) => handleChange('zipCode', e.target.value)}
                      className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
          </>
        )}
      </div>
    </div>
  );
};
