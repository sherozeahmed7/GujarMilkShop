import React from 'react';
import { CalculatedStatement, MonthlyStatement } from '../../types/customerMilkReport';
import { History, Milk, Calculator, Banknote, AlertCircle } from 'lucide-react';

interface StatementSummaryCardsProps {
  stmt: MonthlyStatement;
  calc: CalculatedStatement;
}

const fmtRs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

interface CardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  valueColor?: string;
  bgColor?: string;
  iconColor?: string;
}

const Card: React.FC<CardProps> = ({
  title, value, icon: Icon, valueColor = 'text-slate-800 dark:text-[#e2f5e8]',
  bgColor = 'bg-blue-50 dark:bg-blue-900/30', iconColor = 'text-blue-600 dark:text-blue-400',
}) => (
  <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm p-4 flex items-center gap-4 min-w-0">
    <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500 dark:text-[#8ba895] truncate">{title}</div>
      <div className={`text-sm font-bold ${valueColor} truncate`}>{value}</div>
    </div>
  </div>
);

export const StatementSummaryCards: React.FC<StatementSummaryCardsProps> = ({ stmt, calc }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
    <Card
      title="Previous Month"
      value={fmtRs(stmt.previousBalance)}
      icon={History}
      bgColor="bg-amber-50 dark:bg-amber-900/30"
      iconColor="text-amber-600 dark:text-amber-400"
      valueColor={stmt.previousBalance > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-[#8ba895]'}
    />
    <Card
      title="This Month Milk"
      value={`${calc.totalMilkKg} kg / ${fmtRs(calc.totalMilkAmount)}`}
      icon={Milk}
      bgColor="bg-blue-50 dark:bg-blue-900/30"
      iconColor="text-blue-600 dark:text-blue-400"
      valueColor="text-blue-700 dark:text-blue-400"
    />
    <Card
      title="Total Payable"
      value={fmtRs(calc.totalPayable)}
      icon={Calculator}
      bgColor="bg-purple-50 dark:bg-purple-900/30"
      iconColor="text-purple-600 dark:text-purple-400"
      valueColor="text-purple-700 dark:text-purple-400"
    />
    <Card
      title="Received"
      value={fmtRs(calc.totalReceived)}
      icon={Banknote}
      bgColor="bg-emerald-50 dark:bg-emerald-900/30"
      iconColor="text-emerald-600 dark:text-emerald-400"
      valueColor="text-emerald-700 dark:text-emerald-400"
    />
    <Card
      title="Remaining"
      value={fmtRs(calc.remaining)}
      icon={AlertCircle}
      bgColor={calc.remaining > 0 ? 'bg-rose-50 dark:bg-rose-900/30' : 'bg-slate-50 dark:bg-[#142119]'}
      iconColor={calc.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-[#64916e]'}
      valueColor={calc.remaining > 0 ? 'text-rose-700 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-[#8ba895]'}
    />
  </div>
);
