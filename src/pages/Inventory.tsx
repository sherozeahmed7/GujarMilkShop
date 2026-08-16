import React from 'react';

export const Inventory: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <h1 className="text-3xl font-bold mb-6">Inventory</h1>
      <div className="flex-1 bg-white rounded-lg shadow p-6 flex items-center justify-center border border-gray-200">
        <p className="text-gray-500 text-lg">This is the placeholder for the Inventory module.</p>
      </div>
    </div>
  );
};
