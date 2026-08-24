import { IMilkProductsRepository } from '../repositories/milkProducts.repository';
import { mockMilkProductsRepository } from '../repositories/mockMilkProducts.repository';
import { MilkProductsDailyStock, MilkProductTransaction, ButterGheeConversion } from '../types/milkProducts.types';

// Future: switch this to apiMilkProductsRepository
const repository: IMilkProductsRepository = mockMilkProductsRepository;

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
    const stock = await repository.getDailyStock(date);
    await repository.addTransaction({
      date,
      product: 'Milk',
      type: 'milk_added',
      quantity: qty
    });
    return repository.updateDailyStock(date, { milkTotal: stock.milkTotal + qty });
  },

  async addLassiProduction(date: string, qty: number): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    await repository.addTransaction({
      date,
      product: 'Lassi',
      type: 'lassi_produced',
      quantity: qty
    });
    return repository.updateDailyStock(date, { lassiProduced: stock.lassiProduced + qty });
  },

  async addLassiSale(date: string, qty: number): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    await repository.addTransaction({
      date,
      product: 'Lassi',
      type: 'lassi_sold',
      quantity: qty
    });
    return repository.updateDailyStock(date, { lassiSold: stock.lassiSold + qty });
  },

  async addButterProduction(date: string, qty: number): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    await repository.addTransaction({
      date,
      product: 'Butter',
      type: 'butter_produced',
      quantity: qty
    });
    return repository.updateDailyStock(date, { butterProduced: stock.butterProduced + qty });
  },

  async addButterSale(date: string, qty: number): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    if (stock.butterClosing < qty) {
      throw new Error(`Cannot sell ${qty} kg of Butter. Only ${stock.butterClosing} kg available.`);
    }
    await repository.addTransaction({
      date,
      product: 'Butter',
      type: 'butter_sold',
      quantity: qty
    });
    return repository.updateDailyStock(date, { butterSold: stock.butterSold + qty });
  },

  async addGheeProduction(date: string, qty: number): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    await repository.addTransaction({
      date,
      product: 'Ghee',
      type: 'ghee_produced',
      quantity: qty
    });
    return repository.updateDailyStock(date, { gheeProduced: stock.gheeProduced + qty });
  },

  async addGheeSale(date: string, qty: number): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    if (stock.gheeClosing < qty) {
      throw new Error(`Cannot sell ${qty} kg of Ghee. Only ${stock.gheeClosing} kg available.`);
    }
    await repository.addTransaction({
      date,
      product: 'Ghee',
      type: 'ghee_sold',
      quantity: qty
    });
    return repository.updateDailyStock(date, { gheeSold: stock.gheeSold + qty });
  },

  async convertButterToGhee(date: string, butterUsed: number, gheeProduced: number, notes?: string): Promise<MilkProductsDailyStock> {
    const stock = await repository.getDailyStock(date);
    if (stock.butterClosing < butterUsed) {
      throw new Error(`Not enough Butter to convert. Need ${butterUsed} kg, but only ${stock.butterClosing} kg available.`);
    }

    await repository.addConversion({
      date,
      butterUsed,
      gheeProduced,
      notes
    });

    await repository.addTransaction({
      date,
      product: 'Butter',
      type: 'butter_converted',
      quantity: butterUsed,
      notes: `Converted to ${gheeProduced} kg Ghee`
    });

    await repository.addTransaction({
      date,
      product: 'Ghee',
      type: 'ghee_produced',
      quantity: gheeProduced,
      notes: `Produced from ${butterUsed} kg Butter`
    });

    return repository.updateDailyStock(date, {
      butterConverted: stock.butterConverted + butterUsed,
      gheeProduced: stock.gheeProduced + gheeProduced
    });
  }
};
