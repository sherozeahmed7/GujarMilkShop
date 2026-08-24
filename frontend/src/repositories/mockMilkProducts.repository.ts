import { IMilkProductsRepository } from './milkProducts.repository';
import { MilkProductsDailyStock, MilkProductTransaction, ButterGheeConversion } from '../types/milkProducts.types';

class MockMilkProductsRepository implements IMilkProductsRepository {
  private stockStore: Map<string, MilkProductsDailyStock> = new Map();
  private transactionStore: Map<string, MilkProductTransaction[]> = new Map();
  private conversionStore: Map<string, ButterGheeConversion[]> = new Map();


  async getDailyStock(date: string): Promise<MilkProductsDailyStock> {
    if (this.stockStore.has(date)) {
      return this.stockStore.get(date)!;
    }

    // Determine opening stock from previous day
    let butterOpening = 0;
    let gheeOpening = 0;
    
    // Sort dates to find the most recent previous record
    const allDates = Array.from(this.stockStore.keys()).sort();
    const pastDates = allDates.filter(d => d < date);
    
    if (pastDates.length > 0) {
      const lastDate = pastDates[pastDates.length - 1];
      const lastStock = this.stockStore.get(lastDate)!;
      butterOpening = lastStock.butterClosing;
      gheeOpening = lastStock.gheeClosing;
    }

    const initialStock: MilkProductsDailyStock = {
      date,
      milkTotal: 0,
      lassiProduced: 0,
      lassiSold: 0,
      lassiRemaining: 0,
      butterOpening,
      butterProduced: 0,
      butterSold: 0,
      butterConverted: 0,
      butterClosing: butterOpening,
      gheeOpening,
      gheeProduced: 0,
      gheeSold: 0,
      gheeClosing: gheeOpening,
    };

    this.stockStore.set(date, initialStock);
    return initialStock;
  }

  async getTransactions(date: string): Promise<MilkProductTransaction[]> {
    return this.transactionStore.get(date) || [];
  }

  async getConversions(date: string): Promise<ButterGheeConversion[]> {
    return this.conversionStore.get(date) || [];
  }

  async updateDailyStock(date: string, data: Partial<MilkProductsDailyStock>): Promise<MilkProductsDailyStock> {
    const current = await this.getDailyStock(date);
    const updated = { ...current, ...data };
    
    // Calculate closings
    updated.lassiRemaining = updated.lassiProduced - updated.lassiSold;
    updated.butterClosing = updated.butterOpening + updated.butterProduced - updated.butterSold - updated.butterConverted;
    updated.gheeClosing = updated.gheeOpening + updated.gheeProduced - updated.gheeSold;

    this.stockStore.set(date, updated);
    
    // Cascade update to future dates
    const allDates = Array.from(this.stockStore.keys()).sort();
    const futureDates = allDates.filter(d => d > date);
    
    let currentButterClosing = updated.butterClosing;
    let currentGheeClosing = updated.gheeClosing;

    for (const fDate of futureDates) {
      const fStock = this.stockStore.get(fDate)!;
      fStock.butterOpening = currentButterClosing;
      fStock.gheeOpening = currentGheeClosing;
      
      fStock.butterClosing = fStock.butterOpening + fStock.butterProduced - fStock.butterSold - fStock.butterConverted;
      fStock.gheeClosing = fStock.gheeOpening + fStock.gheeProduced - fStock.gheeSold;
      
      this.stockStore.set(fDate, fStock);
      currentButterClosing = fStock.butterClosing;
      currentGheeClosing = fStock.gheeClosing;
    }

    return updated;
  }

  async addTransaction(transaction: Omit<MilkProductTransaction, 'id' | 'createdAt'>): Promise<MilkProductTransaction> {
    const newTx: MilkProductTransaction = {
      ...transaction,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    const date = transaction.date;
    const txs = this.transactionStore.get(date) || [];
    txs.push(newTx);
    this.transactionStore.set(date, txs);
    return newTx;
  }

  async addConversion(conversion: Omit<ButterGheeConversion, 'id' | 'createdAt'>): Promise<ButterGheeConversion> {
    const newConv: ButterGheeConversion = {
      ...conversion,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    const date = conversion.date;
    const convs = this.conversionStore.get(date) || [];
    convs.push(newConv);
    this.conversionStore.set(date, convs);
    return newConv;
  }
}

export const mockMilkProductsRepository = new MockMilkProductsRepository();
