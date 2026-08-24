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
  title, value, icon: Icon, valueColor = 'text-slate-800',
  bgColor = 'bg-blue-50', iconColor = 'text-blue-600',
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 min-w-0">
    <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500 truncate">{title}</div>
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
      bgColor="bg-amber-50"
      iconColor="text-amber-600"
      valueColor={stmt.previousBalance > 0 ? 'text-amber-700' : 'text-slate-500'}
    />
    <Card
      title="This Month Milk"
      value={`${calc.totalMilkKg} kg / ${fmtRs(calc.totalMilkAmount)}`}
      icon={Milk}
      bgColor="bg-blue-50"
      iconColor="text-blue-600"
      valueColor="text-blue-700"
    />
    <Card
      title="Total Payable"
      value={fmtRs(calc.totalPayable)}
      icon={Calculator}
      bgColor="bg-purple-50"
      iconColor="text-purple-600"
      valueColor="text-purple-700"
    />
    <Card
      title="Received"
      value={fmtRs(calc.totalReceived)}
      icon={Banknote}
      bgColor="bg-emerald-50"
      iconColor="text-emerald-600"
      valueColor="text-emerald-700"
    />
    <Card
      title="Remaining"
      value={fmtRs(calc.remaining)}
      icon={AlertCircle}
      bgColor={calc.remaining > 0 ? 'bg-rose-50' : 'bg-slate-50'}
      iconColor={calc.remaining > 0 ? 'text-rose-600' : 'text-slate-400'}
      valueColor={calc.remaining > 0 ? 'text-rose-700 font-bold' : 'text-slate-500'}
    />
  </div>
);
