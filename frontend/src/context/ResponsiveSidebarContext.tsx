import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface ResponsiveSidebarContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobileOpen: () => void;
}

const ResponsiveSidebarContext = createContext<ResponsiveSidebarContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobileOpen: () => {},
});

export const ResponsiveSidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Automatically close mobile sidebar when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open on small screens
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const toggleMobileOpen = () => setMobileOpen((prev) => !prev);

  return (
    <ResponsiveSidebarContext.Provider value={{ mobileOpen, setMobileOpen, toggleMobileOpen }}>
      {children}
    </ResponsiveSidebarContext.Provider>
  );
};

export const useResponsiveSidebar = () => useContext(ResponsiveSidebarContext);

