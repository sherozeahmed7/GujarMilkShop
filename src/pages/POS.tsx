import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'rs';
  total: number;
  pricePerKg: number;
}

export const POS: React.FC = () => {
  const [activeTab, setActiveTab] = useState('milk-yogurt');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'split' | 'khata'>('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);

  const [milkCustomAmount, setMilkCustomAmount] = useState('');
  const [yogurtCustomAmount, setYogurtCustomAmount] = useState('');

  const MILK_PRICE_PER_KG = 240;
  const YOGURT_PRICE_PER_KG = 270;

  const initialMilkPresets = [
    { label: '0.5 kg', kg: 0.5 },
    { label: '0.75 kg', kg: 0.75 },
    { label: '1 kg', kg: 1 },
    { label: '1.5 kg', kg: 1.5 },
    { label: '2 kg', kg: 2 },
    { label: '2.5 kg', kg: 2.5 },
    { label: '3 kg', kg: 3 },
    { label: '3.5 kg', kg: 3.5 },
    { label: '4 kg', kg: 4 },
    { label: '4.5 kg', kg: 4.5 },
    { label: '5 kg', kg: 5 },
    { label: '6 kg', kg: 6 },
    { label: '7 kg', kg: 7 },
    { label: '8 kg', kg: 8 },
    { label: '9 kg', kg: 9 },
    { label: '10 kg', kg: 10 },
  ];

  const yogurtKgPresets = [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00];

  const initialYogurtPresets = [
    { label: 'Rs. 50', rs: 50 },
    { label: 'Rs. 100', rs: 100 },
    { label: 'Rs. 150', rs: 150 },
    { label: 'Rs. 200', rs: 200 },
    { label: 'Rs. 250', rs: 250 },
    { label: 'Rs. 300', rs: 300 },
  ];

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(0, subtotal - (discount || 0));

  const addToCart = (name: string, quantity: number, unit: 'kg' | 'rs', total: number, pricePerKg: number) => {
    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      quantity,
      unit,
      total,
      pricePerKg
    };
    setCart([...cart, newItem]);
  };

  const handleCustomAdd = (type: 'milk' | 'yogurt') => {
    const isMilk = type === 'milk';
    const input = isMilk ? milkCustomAmount : yogurtCustomAmount;
    const pricePerKg = isMilk ? MILK_PRICE_PER_KG : YOGURT_PRICE_PER_KG;
    
    const rs = parseFloat(input);
    if (isNaN(rs) || rs <= 0) return;

    const kg = rs / pricePerKg;

    addToCart(isMilk ? 'Milk' : 'Yogurt', kg, 'kg', rs, pricePerKg);
    if (isMilk) setMilkCustomAmount('');
    else setYogurtCustomAmount('');
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateCartItemQuantity = (id: string, newQuantityStr: string) => {
    const newQuantity = parseFloat(newQuantityStr);
    setCart(cart.map(item => {
      if (item.id === id) {
        if (isNaN(newQuantity) || newQuantity < 0) {
          return { ...item, quantity: 0, total: 0 };
        }
        return {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.pricePerKg
        };
      }
      return item;
    }));
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button 
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'milk-yogurt' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
            }`}
            onClick={() => setActiveTab('milk-yogurt')}
          >
            Milk & Yogurt
          </button>
          <button 
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'items' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
            }`}
            onClick={() => setActiveTab('items')}
          >
            <Plus className="w-4 h-4" /> Items F2
          </button>
        </div>

        {/* Products Area */}
        <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Milk Section */}
            <div className="flex-1 bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-emerald-700">Milk</h2>
                
                {/* Custom Amount Form */}
                <div className="flex items-center gap-2 bg-white rounded-lg p-1.5 border border-emerald-200 shadow-sm">
                  <div className="text-xs font-semibold text-emerald-700 pl-1">Rs:</div>
                  <input
                    type="number"
                    value={milkCustomAmount}
                    onChange={(e) => setMilkCustomAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-16 px-2 py-1 text-sm border-none bg-slate-50 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd('milk')}
                  />
                  <button 
                    onClick={() => handleCustomAdd('milk')}
                    className="bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-1 rounded-md text-xs font-bold transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {initialMilkPresets.map((preset, idx) => {
                  const rs = preset.kg * MILK_PRICE_PER_KG;
                  return (
                    <button 
                      key={`im-${idx}`}
                      onClick={() => addToCart('Milk', preset.kg, 'kg', rs, MILK_PRICE_PER_KG)}
                      className="border border-white bg-white hover:border-emerald-400 hover:bg-emerald-50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors group shadow-sm"
                    >
                      <div className="font-bold text-slate-800 group-hover:text-emerald-700 text-lg">{preset.label}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">Rs. {rs.toFixed(0)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px bg-slate-100"></div>

            {/* Yogurt Section */}
            <div className="flex-1 bg-blue-50/40 border border-blue-100 rounded-xl p-4 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-blue-700">Yogurt</h2>

                {/* Custom Amount Form */}
                <div className="flex items-center gap-2 bg-white rounded-lg p-1.5 border border-blue-200 shadow-sm">
                  <div className="text-xs font-semibold text-blue-700 pl-1">Rs:</div>
                  <input
                    type="number"
                    value={yogurtCustomAmount}
                    onChange={(e) => setYogurtCustomAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-16 px-2 py-1 text-sm border-none bg-slate-50 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd('yogurt')}
                  />
                  <button 
                    onClick={() => handleCustomAdd('yogurt')}
                    className="bg-blue-500 text-white hover:bg-blue-600 px-3 py-1 rounded-md text-xs font-bold transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
              
              {/* Presets Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="col-span-full flex text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                  <div className="flex-1">By Weight (KG)</div>
                  <div className="flex-1 pl-3">By Amount (RS)</div>
                </div>
                
                {yogurtKgPresets.map((kg, idx) => {
                  const rs = kg * YOGURT_PRICE_PER_KG;
                  return (
                    <button 
                      key={`y-kg-${idx}`}
                      onClick={() => addToCart('Yogurt', kg, 'kg', rs, YOGURT_PRICE_PER_KG)}
                      className="border border-white bg-white hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 flex justify-between items-center transition-colors group shadow-sm"
                    >
                      <div className="font-bold text-slate-800 group-hover:text-blue-700">{kg.toFixed(2)} kg</div>
                      <div className="text-xs text-slate-500 font-medium">Rs. {rs.toFixed(0)}</div>
                    </button>
                  );
                })}

                {initialYogurtPresets.map((preset, idx) => {
                  const kg = preset.rs / YOGURT_PRICE_PER_KG;
                  return (
                    <button 
                      key={`y-rs-${idx}`}
                      onClick={() => addToCart('Yogurt', kg, 'kg', preset.rs, YOGURT_PRICE_PER_KG)}
                      className="border border-white bg-white hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 flex justify-between items-center transition-colors group shadow-sm"
                    >
                      <div className="font-bold text-slate-800 group-hover:text-blue-700 text-lg">{preset.label}</div>
                      <div className="text-xs text-slate-500 font-medium">{kg.toFixed(2)} kg</div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Right Panel - Current Bill */}
      <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col gap-4 min-h-0">
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
            <h2 className="font-bold text-sm tracking-wide">CURRENT BILL ({cart.length})</h2>
          </div>
          
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No items added yet
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 group shadow-sm">
                    <div className="font-bold text-slate-800 text-sm w-16">{item.name}</div>
                    
                    <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                      <input 
                        type="number" 
                        value={item.quantity === 0 ? '' : Number(item.quantity.toFixed(3))}
                        onChange={(e) => updateCartItemQuantity(item.id, e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-slate-800 focus:outline-none text-right"
                        step="0.001"
                      />
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{item.unit}</span>
                    </div>

                    <div className="font-bold text-slate-800 w-20 text-right">Rs. {item.total.toFixed(0)}</div>
                    
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="p-5 border-t border-slate-100 bg-white">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium text-slate-600">Subtotal:</div>
              <div className="text-sm font-bold text-slate-800">Rs. {subtotal.toFixed(0)}</div>
            </div>
            
            {isDiscountOpen ? (
              <div className="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <div className="text-sm font-medium text-slate-600">Discount (Rs):</div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                  <input
                    type="number"
                    value={discount === 0 ? '' : discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-16 text-sm text-right bg-transparent focus:outline-none font-bold text-slate-800"
                    placeholder="0"
                  />
                  <button onClick={() => setIsDiscountOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsDiscountOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Discount
              </button>
            )}

            <div className="flex justify-between items-end mb-6">
              <div className="text-sm font-bold text-slate-800 tracking-wider">TOTAL</div>
              <div className="text-3xl font-black text-emerald-500">Rs. {finalTotal.toFixed(0)}</div>
            </div>

            {/* Payment Methods */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              {(['cash', 'online', 'split', 'khata'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    paymentMethod === method 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Fast Actions */}
            <div className="space-y-3">
              <button className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl p-4 flex justify-between items-center transition-colors">
                <div className="text-left">
                  <div className="font-bold text-sm flex items-center gap-2">
                    FAST CASH SALE
                  </div>
                  <div className="text-[10px] text-emerald-600/80 mt-0.5">No cash entry needed. Press Enter.</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-emerald-600/80 uppercase">Bill</div>
                  <div className="font-black text-lg">Rs. {finalTotal.toFixed(0)}</div>
                </div>
              </button>
              
              <div className="flex gap-3">
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-bold tracking-wide transition-colors shadow-sm shadow-blue-600/20">
                  CASH OK
                </button>
                <button className="px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-4 font-bold tracking-wide transition-colors">
                  HOLD
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
