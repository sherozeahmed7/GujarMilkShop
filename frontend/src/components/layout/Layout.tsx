import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ResponsiveSidebarProvider } from '../../context/ResponsiveSidebarContext';

export const Layout: React.FC = () => {
  return (
    <ResponsiveSidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#F8FAF8] dark:bg-[#0d1a10] font-sans transition-colors duration-250">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
          <Header />
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 pb-6 bg-[#F8FAF8] dark:bg-[#0d1a10] transition-colors duration-250">
            <Outlet />
          </main>
        </div>
      </div>
    </ResponsiveSidebarProvider>
  );
};
