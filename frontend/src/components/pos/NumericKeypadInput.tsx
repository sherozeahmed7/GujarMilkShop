import React from 'react';

type Accent = 'emerald' | 'blue' | 'cyan' | 'amber' | 'orange' | 'slate';

const ACCENT_RING: Record<Accent, string> = {
  emerald: 'focus:ring-emerald-500',
  blue: 'focus:ring-blue-500',
  cyan: 'focus:ring-cyan-500',
  amber: 'focus:ring-amber-500',
  orange: 'focus:ring-orange-500',
  slate: 'focus:ring-slate-500',
};

export interface NumericKeypadInputProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm?: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  accent?: Accent;
  confirmLabel?: string;
  allowDecimal?: boolean;
  title?: string;
}

export const NumericKeypadInput: React.FC<NumericKeypadInputProps> = ({
  value,
  onChange,
  onConfirm,
  placeholder = 'Amount',
  className = '',
  triggerClassName = '',
  accent = 'slate',
  allowDecimal = true,
}) => {
  const ring = ACCENT_RING[accent];

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '') {
            onChange('');
            return;
          }
          const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
          if (pattern.test(next)) onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm?.(value);
          }
        }}
        className={`w-full text-left px-3 py-1.5 text-base bg-slate-50 rounded border border-transparent focus:outline-none focus:ring-2 ${ring} ${triggerClassName}`}
      />
    </div>
  );
};
