/**
 * Canonical screen permissions — keep in sync with Sidebar nav items.
 * Used by Users & Roles permission UI and ALL_SCREENS export.
 */
export const SCREEN_PERMISSIONS = {
  MAIN_MODULES: [
    'Dashboard',
    'Point of Sale',
    'Inventory',
    'Suppliers',
    'Customers',
    'Khata / Ledger',
    'Returns',
    'Receipt Audit',
    'Shifts',
    'Cash Register',
    'Expenses',
  ],
  SETTINGS: [
    'Daily Rates',
    'Shop Info',
    'POS Config',
    'Users & Roles',
    'Cloud & Sync',
    'Local Backup',
  ],
  REPORTS: [
    'Sales Report',
    'F2 Sales Report',
    'Supplier Report',
    'Customer Report',
    'Inventory Report',
    'Returns Report',
    'Cash Register Report',
    'Shifts Report',
    'Expenses Report',
    'Backup Report',
    'Profit & Loss',
    'Activity Logs',
  ],
};

export const ALL_SCREENS = [
  ...SCREEN_PERMISSIONS.MAIN_MODULES,
  ...SCREEN_PERMISSIONS.SETTINGS,
  ...SCREEN_PERMISSIONS.REPORTS,
];
