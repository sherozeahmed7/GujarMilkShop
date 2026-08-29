import { prisma } from '../config/database';

type RatePayload = {
  milkRate: number;
  yogurtRate: number;
  lassiRate?: number;
  butterRate?: number;
  gheeRate?: number;
  updatedByRole: string;
  date: string;
};

export class RateService {
  /**
   * Adds a new daily rate row (milk, yogurt, and optional F2 products).
   */
  static async addRate(payload: RatePayload) {
    const { milkRate, yogurtRate, updatedByRole, date } = payload;

    const latest = await prisma.dailyRate.findFirst({ orderBy: { id: 'desc' } });
    const lassiRate =
      payload.lassiRate !== undefined ? payload.lassiRate : latest?.lassiRate ?? 0;
    const butterRate =
      payload.butterRate !== undefined ? payload.butterRate : latest?.butterRate ?? 0;
    const gheeRate =
      payload.gheeRate !== undefined ? payload.gheeRate : latest?.gheeRate ?? 0;

    const newRate = await prisma.dailyRate.create({
      data: {
        milkRate,
        yogurtRate,
        lassiRate,
        butterRate,
        gheeRate,
        updatedByRole,
        date: new Date(date),
      },
    });

    return {
      success: true,
      statusCode: 201,
      message: 'Rate updated successfully.',
      data: newRate,
    };
  }

  /**
   * Retrieves all historical rates ordered by id descending
   * and extracts the current rates from the latest entry.
   */
  static async getRates() {
    const rates = await prisma.dailyRate.findMany({
      orderBy: {
        id: 'desc',
      },
    });

    let currentMilkRate = 0;
    let currentYogurtRate = 0;
    let currentLassiRate = 0;
    let currentButterRate = 0;
    let currentGheeRate = 0;
    let lastUpdated = null;

    if (rates.length > 0) {
      currentMilkRate = rates[0].milkRate;
      currentYogurtRate = rates[0].yogurtRate;
      currentLassiRate = rates[0].lassiRate ?? 0;
      currentButterRate = rates[0].butterRate ?? 0;
      currentGheeRate = rates[0].gheeRate ?? 0;
      lastUpdated = rates[0].date;
    }

    return {
      success: true,
      statusCode: 200,
      data: {
        history: rates,
        currentMilkRate,
        currentYogurtRate,
        currentLassiRate,
        currentButterRate,
        currentGheeRate,
        lastUpdated,
      },
    };
  }

  /**
   * Returns standard box prices for Milk and Yogurt,
   * plus F2 per-kg rates for Lassi / Butter / Ghee.
   */
  static async getStandardPrices() {
    const latestRate = await prisma.dailyRate.findFirst({
      orderBy: { id: 'desc' },
    });

    const milkRate = latestRate?.milkRate ?? 0;
    const yogurtRate = latestRate?.yogurtRate ?? 0;
    const lassiRate = latestRate?.lassiRate ?? 0;
    const butterRate = latestRate?.butterRate ?? 0;
    const gheeRate = latestRate?.gheeRate ?? 0;

    const milkWeights = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10];
    const milkBoxes = milkWeights.map((weight) => ({
      weight,
      label: `${weight} kg`,
      price: Math.round(weight * milkRate),
    }));

    const milkAmounts = [50, 100, 150, 200];
    const milkByAmount = milkAmounts.map((amount) => ({
      amount,
      label: `Rs. ${amount}`,
      weight: milkRate > 0 ? parseFloat((amount / milkRate).toFixed(2)) : 0,
    }));

    const yogurtWeights = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
    const yogurtByWeight = yogurtWeights.map((weight) => ({
      weight,
      label: `${weight.toFixed(2)} kg`,
      price: Math.round(weight * yogurtRate),
    }));

    const yogurtAmounts = [50, 100, 150, 200, 250, 300];
    const yogurtByAmount = yogurtAmounts.map((amount) => ({
      amount,
      label: `Rs. ${amount}`,
      weight: yogurtRate > 0 ? parseFloat((amount / yogurtRate).toFixed(2)) : 0,
    }));

    return {
      success: true,
      statusCode: 200,
      data: {
        milkRatePerKg: milkRate,
        yogurtRatePerKg: yogurtRate,
        lassiRatePerKg: lassiRate,
        butterRatePerKg: butterRate,
        gheeRatePerKg: gheeRate,
        lastUpdated: latestRate?.date ?? null,
        milk: milkBoxes,
        milkByAmount,
        yogurtByWeight,
        yogurtByAmount,
      },
    };
  }
}
