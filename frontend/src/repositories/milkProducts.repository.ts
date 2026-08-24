import { MilkProductsDailyStock, MilkProductTransaction, ButterGheeConversion } from '../types/milkProducts.types';

export interface IMilkProductsRepository {
  getDailyStock(date: string): Promise<MilkProductsDailyStock>;
  getTransactions(date: string): Promise<MilkProductTransaction[]>;
  getConversions(date: string): Promise<ButterGheeConversion[]>;
  
  updateDailyStock(date: string, data: Partial<MilkProductsDailyStock>): Promise<MilkProductsDailyStock>;
  addTransaction(transaction: Omit<MilkProductTransaction, 'id' | 'createdAt'>): Promise<MilkProductTransaction>;
  addConversion(conversion: Omit<ButterGheeConversion, 'id' | 'createdAt'>): Promise<ButterGheeConversion>;
}
