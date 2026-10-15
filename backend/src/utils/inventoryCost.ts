/** Same average unit cost displayed in Inventory's Cost column. */
export function averageInventoryCost(movements: { unitCost: number | null }[]): number {
  const costs = movements.filter(movement => movement.unitCost !== null && movement.unitCost > 0);
  return costs.length
    ? Math.round(costs.reduce((sum, movement) => sum + movement.unitCost!, 0) / costs.length * 100) / 100
    : 0;
}
