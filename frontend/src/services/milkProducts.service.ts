import { IMilkProductsRepository } from '../repositories/milkProducts.repository';
import { apiMilkProductsRepository } from '../repositories/apiMilkProducts.repository';
import { MilkProductsDailyStock, MilkProductTransaction, ButterGheeConversion } from '../types/milkProducts.types';

// Using real API repository — backend handles transaction logging internally
const repository: IMilkProductsRepository = apiMilkProductsRepository;

export const milkProductsService = {
  async getDailyStock(date: string): Promise<MilkProductsDailyStock> {
    return repository.getDailyStock(date);
  },

  async getTransactions(date: string): Promise<MilkProductTransaction[]> {
    return repository.getTransactions(date);
  },

  async getConversions(date: string): Promise<ButterGheeConversion[]> {
    return repository.getConversions(date);
  },

  async addMilk(date: string, qty: number): Promise<MilkProductsDailyStock> {
    // POST /stock/milk — backend increments milkTotal and writes transaction
    return repository.updateDailyStock(date, { milkTotal: qty });
  },

  async addLassiProduction(date: string, qty: number): Promise<MilkProductsDailyStock> {
    // POST /stock/lassi-production — backend increments lassiProduced + lassiRemaining and writes transaction
    return repository.updateDailyStock(date, { lassiProduced: qty });
  },

  async addButterProduction(date: string, qty: number): Promise<MilkProductsDailyStock> {
    // POST /stock/butter-production — backend increments butterProduced + butterClosing and writes transaction
    return repository.updateDailyStock(date, { butterProduced: qty });
  },

  async addGheeProduction(date: string, qty: number): Promise<MilkProductsDailyStock> {
    // POST /stock/ghee-production — backend increments gheeProduced + gheeClosing and writes transaction
    return repository.updateDailyStock(date, { gheeProduced: qty });
  },

  async convertButterToGhee(
    date: string,
    butterUsed: number,
    gheeProduced: number,
    notes?: string
  ): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    if (stock.butterClosing < butterUsed) {
      throw new Error(
        `Not enough Butter to convert. Need ${butterUsed} kg, but only ${stock.butterClosing} kg available.`
      );
    }
    // POST /stock/conversion — backend atomically updates stock + writes conversion + writes 2 transactions
    await repository.addConversion({ date, butterUsed, gheeProduced, notes });
    return repository.getDailyStock(date);
  },
};
