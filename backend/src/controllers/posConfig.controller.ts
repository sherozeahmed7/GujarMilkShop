import { Request, Response } from 'express';
import { prisma } from '../config/database';

const DEFAULT_CONFIG = {
  shopName: 'Gujar Milk Shop',
  taxRate: 0,
  currencySymbol: 'Rs.',
  lowStockAlertThreshold: 5,
  printReceiptAutomatically: false,
  showLogoOnReceipt: false,
  receiptFooterText: 'Thank you for your visit!',
  receiptWidth: '80mm',
  printerEnabled: true,
  printerName: 'Black Copper BC-105',
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
};

export const getPOSConfig = async (req: Request, res: Response) => {
  try {
    let config = await prisma.pOSConfig.findFirst();
    
    if (!config) {
      config = await prisma.pOSConfig.create({
        data: DEFAULT_CONFIG
      });
    }
    
    res.json(config);
  } catch (error) {
    console.error('Failed to get POS config:', error);
    res.status(500).json({ error: 'Failed to retrieve POS configuration' });
  }
};

export const updatePOSConfig = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    let config = await prisma.pOSConfig.findFirst();

    if (config) {
      config = await prisma.pOSConfig.update({
        where: { id: config.id },
        data: {
          ...data,
          id: undefined // Don't try to update the ID
        }
      });
    } else {
      config = await prisma.pOSConfig.create({
        data: {
          ...DEFAULT_CONFIG,
          ...data,
          id: undefined
        }
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Failed to update POS config:', error);
    res.status(500).json({ error: 'Failed to update POS configuration' });
  }
};
