import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAF8] dark:bg-[#0d1a10] font-sans transition-colors duration-250">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 pb-6 bg-[#F8FAF8] dark:bg-[#0d1a10] transition-colors duration-250">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
