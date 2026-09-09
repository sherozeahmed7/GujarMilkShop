/**
 * apiMilkProductsRepository
 * Implements IMilkProductsRepository by calling the real /api/milk-products routes.
 * Uses the shared apiClient which automatically attaches the JWT Bearer token.
 */

import { IMilkProductsRepository } from './milkProducts.repository';
import {
  MilkProductsDailyStock,
  MilkProductTransaction,
  ButterGheeConversion,
} from '../types/milkProducts.types';
import { apiClient } from '../services/apiClient';

class ApiMilkProductsRepository implements IMilkProductsRepository {
  async getDailyStock(date: string): Promise<MilkProductsDailyStock> {
    const res = await apiClient.get('/milk-products/stock', { date });
    const data = res.data;
    if (!data) {
      return {
        date,
        milkTotal: 0,
        milkRatePerKg: 0,
        milkCostPerKg: 0,
        lassiRatePerKg: 0,
        butterRatePerKg: 0,
        milkAddedCost: 0,
        lassiBreakEvenKg: 0,
        butterBreakEvenKg: 0,
        butterBreakEvenCost: 0,
        butterInventoryValue: 0,
        butterTotalValue: 0,
        butterRecoveryResult: 0,
        butterMilkCostShortfall: 0,
        milkRemainingKg: 0,
        milkRecoveredFromLassi: 0,
        milkRecoveredFromButter: 0,
        milkRecoveryKgFromButter: 0,
        milkLossCost: 0,
        lassiProduced: 0,
        lassiSold: 0,
        lassiRemaining: 0,
        butterOpening: 0,
        butterProduced: 0,
        butterSold: 0,
        butterConverted: 0,
        butterClosing: 0,
        gheeOpening: 0,
        gheeProduced: 0,
        gheeSold: 0,
        gheeClosing: 0,
      };
    }
    return data as MilkProductsDailyStock;
  }

  async getTransactions(date: string): Promise<MilkProductTransaction[]> {
    const res = await apiClient.get('/milk-products/transactions', { date });
    return (res.data ?? []) as MilkProductTransaction[];
  }

  async getConversions(date: string): Promise<ButterGheeConversion[]> {
    const res = await apiClient.get('/milk-products/conversions', { date });
    return (res.data ?? []) as ButterGheeConversion[];
  }

  /**
   * updateDailyStock is called by the service layer with a quantity delta.
   * We inspect which field is set and call the matching backend endpoint.
   *
   * Field → endpoint mapping:
   *   milkTotal     → POST /stock/milk
   *   lassiProduced → POST /stock/lassi-production
   *   lassiSold     → POST /stock/day-end-lassi  (absolute value)
   *   butterProduced→ POST /stock/butter-production
   *   gheeProduced  → POST /stock/ghee-production
   *   butterConverted/gheeProduced together → handled by addConversion
   */
  async updateDailyStock(
    date: string,
    data: Partial<MilkProductsDailyStock>
  ): Promise<MilkProductsDailyStock> {
    const keys = Object.keys(data) as (keyof MilkProductsDailyStock)[];

    // milk added — value is the delta quantity to add
    if (keys.length === 1 && keys.includes('milkTotal')) {
      const res = await apiClient.post('/milk-products/stock/milk', { date, quantity: data.milkTotal });
      return res.data as MilkProductsDailyStock;
    }

    // lassi production — value is the delta quantity
    if (keys.length === 1 && keys.includes('lassiProduced')) {
      const res = await apiClient.post('/milk-products/stock/lassi-production', { date, quantity: data.lassiProduced });
      return res.data as MilkProductsDailyStock;
    }

    // day-end lassi — value is absolute sold quantity
    if (keys.length === 1 && keys.includes('lassiSold')) {
      const res = await apiClient.post('/milk-products/stock/day-end-lassi', { date, quantity: data.lassiSold });
      return res.data as MilkProductsDailyStock;
    }

    // butter production — value is the delta quantity
    if (keys.length === 1 && keys.includes('butterProduced')) {
      const res = await apiClient.post('/milk-products/stock/butter-production', { date, quantity: data.butterProduced });
      return res.data as MilkProductsDailyStock;
    }

    // ghee production — value is the delta quantity
    if (keys.length === 1 && keys.includes('gheeProduced')) {
      const res = await apiClient.post('/milk-products/stock/ghee-production', { date, quantity: data.gheeProduced });
      return res.data as MilkProductsDailyStock;
    }

    // Fallback — re-fetch current stock
    return this.getDailyStock(date);
  }

  async addTransaction(
    transaction: Omit<MilkProductTransaction, 'id' | 'createdAt'>
  ): Promise<MilkProductTransaction> {
    const res = await apiClient.post('/milk-products/transactions', transaction);
    return res.data as MilkProductTransaction;
  }

  async addConversion(
    conversion: Omit<ButterGheeConversion, 'id' | 'createdAt'>
  ): Promise<ButterGheeConversion> {
    // Backend returns updated stock; we just need the conversion record.
    await apiClient.post('/milk-products/stock/conversion', {
      date:     conversion.date,
      butterKg: conversion.butterUsed,
      gheeKg:   conversion.gheeProduced,
      notes:    conversion.notes,
    });
    // Backend returns updated stock, not a ButterGheeConversion row.
    // Fetch the conversion record separately.
    const convRes = await apiClient.get('/milk-products/conversions', { date: conversion.date });
    const convs = (convRes.data ?? []) as ButterGheeConversion[];
    return convs[convs.length - 1] ?? { ...conversion, id: '', createdAt: new Date().toISOString() };
  }
}

export const apiMilkProductsRepository = new ApiMilkProductsRepository();
