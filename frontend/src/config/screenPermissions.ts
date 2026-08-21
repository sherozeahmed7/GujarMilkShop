export const SCREEN_PERMISSIONS = {
  MAIN_MODULES: [
    'Dashboard',
    'Point of Sale',
    'Inventory',
    'Suppliers',
    'Customers',
    'Khata / Ledger',
    'Global Cash',
    'Returns',
    'Receipt Audit',
    'Shifts',
    'Cash Register',
    'Backup',
    'Expenses',
  ],
  SETTINGS: [
    'Daily Rates',
    'Shop Info',
    'POS Config',
    'Users & Roles',
    'Audit Log',
    'Cloud & Sync',
    'Customer Display',
    'Local Backup',
  ],
  REPORTS: [
    'Sales Report',
    'Supplier Report',
    'Customer Report',
    'Return Report',
    'Cash Register Report',
    'Shifts Report',
    'Expense Report',
    'Inventory Report',
    'Backup Report',
    'Logs',
    'Profit & Loss',
  ]
};

export const ALL_SCREENS = [
  ...SCREEN_PERMISSIONS.MAIN_MODULES,
  ...SCREEN_PERMISSIONS.SETTINGS,
  ...SCREEN_PERMISSIONS.REPORTS,
];
