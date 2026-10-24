import { StandardPrices, StandardPriceBox, StandardAmountBox } from '../services/rate.service';

/** Fixed preset weights and amounts matching shop specifications */
export const MILK_WEIGHTS = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
export const MILK_AMOUNTS = [50, 100, 150, 200, 300, 400];

export const YOGURT_WEIGHTS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0];
export const YOGURT_AMOUNTS = [50, 100, 150, 200, 300, 400];

/** Default fallback rates (Milk Rs. 240, Yogurt Rs. 270) */
export const DEFAULT_RATES = {
  milkRatePerKg: 240,
  yogurtRatePerKg: 270,
  lassiRatePerKg: 120,
  butterRatePerKg: 800,
  gheeRatePerKg: 1200,
};

/**
 * 100% Client-side pure calculation of standard price boxes.
 * Zero API calls, zero database hits, instantaneous in-memory rendering.
 */
export function computeStandardPrices(
  milkRate: number,
  yogurtRate: number,
  lassiRate = 120,
  butterRate = 800,
  gheeRate = 1200,
  lastUpdated: string | null = null
): StandardPrices {
  const milkBoxes: StandardPriceBox[] = MILK_WEIGHTS.map((weight) => ({
    weight,
    label: `${weight} kg`,
    price: Math.round(weight * milkRate),
  }));

  const milkByAmount: StandardAmountBox[] = MILK_AMOUNTS.map((amount) => ({
    amount,
    label: `Rs. ${amount}`,
    weight: milkRate > 0 ? parseFloat((amount / milkRate).toFixed(2)) : 0,
  }));

  const yogurtByWeight: StandardPriceBox[] = YOGURT_WEIGHTS.map((weight) => ({
    weight,
    label: `${weight} kg`,
    price: Math.round(weight * yogurtRate),
  }));

  const yogurtByAmount: StandardAmountBox[] = YOGURT_AMOUNTS.map((amount) => ({
    amount,
    label: `Rs. ${amount}`,
    weight: yogurtRate > 0 ? parseFloat((amount / yogurtRate).toFixed(2)) : 0,
  }));

  return {
    milkRatePerKg: milkRate,
    yogurtRatePerKg: yogurtRate,
    lassiRatePerKg: lassiRate,
    butterRatePerKg: butterRate,
    gheeRatePerKg: gheeRate,
    lastUpdated,
    milk: milkBoxes,
    milkByAmount,
    yogurtByWeight,
    yogurtByAmount,
  };
}

const STORAGE_KEY = 'gujar_cached_rates';

/** Get cached or default standard prices instantly from LocalStorage */
export function getInitialStandardPrices(): StandardPrices {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return computeStandardPrices(
        parsed.milkRatePerKg ?? DEFAULT_RATES.milkRatePerKg,
        parsed.yogurtRatePerKg ?? DEFAULT_RATES.yogurtRatePerKg,
        parsed.lassiRatePerKg ?? DEFAULT_RATES.lassiRatePerKg,
        parsed.butterRatePerKg ?? DEFAULT_RATES.butterRatePerKg,
        parsed.gheeRatePerKg ?? DEFAULT_RATES.gheeRatePerKg,
        parsed.lastUpdated ?? null
      );
    }
  } catch {
    /* ignore */
  }

  return computeStandardPrices(
    DEFAULT_RATES.milkRatePerKg,
    DEFAULT_RATES.yogurtRatePerKg,
    DEFAULT_RATES.lassiRatePerKg,
    DEFAULT_RATES.butterRatePerKg,
    DEFAULT_RATES.gheeRatePerKg
  );
}

/** Cache rates to LocalStorage so next POS mount is instantaneous */
export function cacheStandardRates(rates: {
  milkRatePerKg: number;
  yogurtRatePerKg: number;
  lassiRatePerKg?: number;
  butterRatePerKg?: number;
  gheeRatePerKg?: number;
  lastUpdated?: string | null;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
  } catch {
    /* ignore */
  }
}
