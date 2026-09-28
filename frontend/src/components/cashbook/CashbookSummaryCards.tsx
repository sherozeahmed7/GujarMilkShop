import React, { useEffect, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, CircleDollarSign,
  Banknote, Users, Scale
} from 'lucide-react';
import { CashbookSummary } from '../../types/cashbook';
import { getCashbookSummary } from '../../services/cashbook.service';

interface CardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  borderColor: string;
  iconColor: string;
  valueColor: string;
}

const SummaryCard: React.FC<CardProps> = ({
  title, value, sub, icon: Icon,
  borderColor, iconColor, valueColor
}) => (
  <div className={`bg-white dark:bg-[#1a2e1f] border-2 ${borderColor} rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden`}>
    <div className={`absolute -right-4 -bottom-4 opacity-[0.06] ${iconColor}`}>
      <Icon className="w-24 h-24" />
    </div>
    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{title}</p>
    <p className={`text-2xl font-bold ${valueColor} leading-tight`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
  </div>
);

interface Props {
  /** Pass a refresh trigger (incrementing number) to force re-fetch */
  refreshKey?: number;
}

export const CashbookSummaryCards: React.FC<Props> = ({ refreshKey = 0 }) => {
  const [summary, setSummary] = useState<CashbookSummary | null>(null);

  useEffect(() => {
    getCashbookSummary().then(setSummary);
  }, [refreshKey]);

  const fmt = (n: number) =>
    `Rs. ${(isNaN(n) || !isFinite(n) ? 0 : Math.round(n)).toLocaleString()}`;

  if (!summary) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1a2e1f] border-2 border-slate-100 dark:border-[#2d4a35] rounded-2xl p-5 h-[106px] animate-pulse" />
        ))}
      </div>
    );
  }

  const isPositive = summary.netBalance >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      <SummaryCard
        title="To Receive"
        value={fmt(summary.totalToReceive)}
        sub="Outstanding from others"
        icon={ArrowDownToLine}
        borderColor="border-blue-100"
        iconColor="text-blue-500"
        valueColor="text-blue-600"
      />
      <SummaryCard
        title="To Pay"
        value={fmt(summary.totalToPay)}
        sub="Outstanding to others"
        icon={ArrowUpFromLine}
        borderColor="border-rose-100"
        iconColor="text-rose-500"
        valueColor="text-rose-600"
      />
      <SummaryCard
        title="Total Received"
        value={fmt(summary.totalReceived)}
        sub="Collected so far"
        icon={CircleDollarSign}
        borderColor="border-emerald-100"
        iconColor="text-emerald-500"
        valueColor="text-emerald-600"
      />
      <SummaryCard
        title="Total Paid"
        value={fmt(summary.totalPaid)}
        sub="Disbursed so far"
        icon={Banknote}
        borderColor="border-amber-100"
        iconColor="text-amber-500"
        valueColor="text-amber-600"
      />
      <SummaryCard
        title="Active Persons"
        value={String(summary.activeCashPersons)}
        sub="Active cash persons"
        icon={Users}
        borderColor="border-violet-100"
        iconColor="text-violet-500"
        valueColor="text-violet-600"
      />
      <SummaryCard
        title="Net Balance"
        value={fmt(Math.abs(summary.netBalance))}
        sub={isPositive ? 'In our favour' : 'We owe more'}
        icon={Scale}
        borderColor={isPositive ? 'border-emerald-100' : 'border-rose-100'}
        iconColor={isPositive ? 'text-emerald-500' : 'text-rose-500'}
        valueColor={isPositive ? 'text-emerald-600' : 'text-rose-600'}
      />
    </div>
  );
};
