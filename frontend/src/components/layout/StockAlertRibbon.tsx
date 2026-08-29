import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';

const MILK_ALERT_KG = 10;

/**
 * Top ribbon: low milk (<=10kg) or any product at/below zero.
 * Sales are never blocked — this is informational only.
 */
export const StockAlertRibbon: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const products = await inventoryService.getProducts();
        if (cancelled) return;

        const milk = products.find(
          (p) => p.code?.toUpperCase() === 'MILK' || p.name?.toLowerCase().includes('milk')
        );
        const yogurt = products.find(
          (p) => p.code?.toUpperCase() === 'YOGURT' || p.name?.toLowerCase().includes('yogurt')
        );

        const parts: string[] = [];
        if (milk && milk.stock <= MILK_ALERT_KG) {
          parts.push(
            milk.stock <= 0
              ? `Milk stock is ${milk.stock} kg (minus). Sales continue — refill soon.`
              : `Milk stock low: ${milk.stock} kg left (alert at ${MILK_ALERT_KG} kg).`
          );
        }
        if (yogurt && yogurt.stock <= 0) {
          parts.push(`Yogurt stock is ${yogurt.stock} kg. Sales continue — add stock soon.`);
        }
        const otherNegative = products.filter(
          (p) =>
            p !== milk &&
            p !== yogurt &&
            p.stock < 0
        );
        if (otherNegative.length) {
          parts.push(
            `${otherNegative.map((p) => `${p.name} (${p.stock})`).join(', ')} below zero.`
          );
        }

        setMessage(parts.length ? parts.join(' · ') : null);
      } catch {
        if (!cancelled) setMessage(null);
      }
    };

    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="w-full bg-amber-500 text-white px-4 py-2 flex items-center gap-2 text-sm font-medium shadow-sm z-20">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{message}</span>
    </div>
  );
};
