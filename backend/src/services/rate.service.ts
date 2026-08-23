import { prisma } from '../config/database';

export class RateService {
  /**
   * Adds a new daily rate for milk and yogurt
   */
  static async addRate(payload: { milkRate: number; yogurtRate: number; updatedByRole: string; date: string }) {
    const { milkRate, yogurtRate, updatedByRole, date } = payload;

    const newRate = await prisma.dailyRate.create({
      data: {
        milkRate,
        yogurtRate,
        updatedByRole,
        date: new Date(date)
      }
    });

    return {
      success: true,
      statusCode: 201,
      message: 'Rate updated successfully.',
      data: newRate
    };
  }

  /**
   * Retrieves all historical rates ordered by date descending
   * and extracts the current rates from the latest entry.
   */
  static async getRates() {
    // Order by id DESC (auto-increment) to guarantee true insertion order.
    // Ordering by 'date' (user-supplied) risks race conditions if multiple
    // entries are submitted for the same effective date.
    const rates = await prisma.dailyRate.findMany({
      orderBy: {
        id: 'desc'
      }
    });

    let currentMilkRate = 0;
    let currentYogurtRate = 0;
    let lastUpdated = null;

    if (rates.length > 0) {
      currentMilkRate = rates[0].milkRate;
      currentYogurtRate = rates[0].yogurtRate;
      lastUpdated = rates[0].date;
    }

    return {
      success: true,
      statusCode: 200,
      data: {
        history: rates,
        currentMilkRate,
        currentYogurtRate,
        lastUpdated
      }
    };
  }

  /**
   * Returns standard box prices for Milk and Yogurt,
   * calculated dynamically from the latest stored rates.
   *
   * Milk: price = weight × milkRate (per kg)
   * Yogurt by weight: price = weight × yogurtRate (per kg)
   * Yogurt by amount: kg = amount / yogurtRate
   */
  static async getStandardPrices() {
    // Fetch latest rate from DB (most recent by date descending)
    // Use id DESC (auto-increment) to get the truly latest inserted record.
    // Avoids race conditions when multiple entries share the same 'date' value.
    const latestRate = await prisma.dailyRate.findFirst({
      orderBy: { id: 'desc' }
    });

    const milkRate = latestRate?.milkRate ?? 0;
    const yogurtRate = latestRate?.yogurtRate ?? 0;

    // --- Milk standard weight boxes ---
    const milkWeights = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10];
    const milkBoxes = milkWeights.map(weight => ({
      weight,
      label: `${weight} kg`,
      price: Math.round(weight * milkRate)
    }));

    // --- Yogurt standard weight boxes ---
    const yogurtWeights = [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00];
    const yogurtByWeight = yogurtWeights.map(weight => ({
      weight,
      label: `${weight.toFixed(2)} kg`,
      price: Math.round(weight * yogurtRate)
    }));

    // --- Yogurt standard amount boxes (reverse calculation: amount → kg) ---
    const yogurtAmounts = [50, 100, 150, 200, 250, 300];
    const yogurtByAmount = yogurtAmounts.map(amount => ({
      amount,
      label: `Rs. ${amount}`,
      weight: yogurtRate > 0
        ? parseFloat((amount / yogurtRate).toFixed(2))
        : 0
    }));

    return {
      success: true,
      statusCode: 200,
      data: {
        milkRatePerKg: milkRate,
        yogurtRatePerKg: yogurtRate,
        lastUpdated: latestRate?.date ?? null,
        milk: milkBoxes,
        yogurtByWeight,
        yogurtByAmount
      }
    };
  }
}
