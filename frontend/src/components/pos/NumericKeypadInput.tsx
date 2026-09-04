import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Delete, Keyboard, X } from 'lucide-react';

type Accent = 'emerald' | 'blue' | 'cyan' | 'amber' | 'orange' | 'slate';

const ACCENT: Record<
  Accent,
  { ring: string; btn: string; confirm: string; border: string; soft: string }
> = {
  emerald: {
    ring: 'focus:ring-emerald-500',
    btn: 'active:bg-emerald-100 hover:border-emerald-400',
    confirm: 'bg-emerald-600 hover:bg-emerald-700',
    border: 'border-emerald-200',
    soft: 'bg-emerald-50',
  },
  blue: {
    ring: 'focus:ring-blue-500',
    btn: 'active:bg-blue-100 hover:border-blue-400',
    confirm: 'bg-blue-600 hover:bg-blue-700',
    border: 'border-blue-200',
    soft: 'bg-blue-50',
  },
  cyan: {
    ring: 'focus:ring-cyan-500',
    btn: 'active:bg-cyan-100 hover:border-cyan-400',
    confirm: 'bg-cyan-600 hover:bg-cyan-700',
    border: 'border-cyan-200',
    soft: 'bg-cyan-50',
  },
  amber: {
    ring: 'focus:ring-amber-500',
    btn: 'active:bg-amber-100 hover:border-amber-400',
    confirm: 'bg-amber-600 hover:bg-amber-700',
    border: 'border-amber-200',
    soft: 'bg-amber-50',
  },
  orange: {
    ring: 'focus:ring-orange-500',
    btn: 'active:bg-orange-100 hover:border-orange-400',
    confirm: 'bg-orange-600 hover:bg-orange-700',
    border: 'border-orange-200',
    soft: 'bg-orange-50',
  },
  slate: {
    ring: 'focus:ring-slate-500',
    btn: 'active:bg-slate-100 hover:border-slate-400',
    confirm: 'bg-slate-700 hover:bg-slate-800',
    border: 'border-slate-200',
    soft: 'bg-slate-50',
  },
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

function appendDigit(current: string, key: string, allowDecimal: boolean): string {
  if (key === '.') {
    if (!allowDecimal || current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  if (key === '0' && current === '0') return current;
  if (current === '0' && key !== '.') return key;
  if (current.replace('.', '').length >= 10) return current;
  return `${current}${key}`;
}

export const NumericKeypadInput: React.FC<NumericKeypadInputProps> = ({
  value,
  onChange,
  onConfirm,
  placeholder = 'Amount',
  className = '',
  triggerClassName = '',
  accent = 'slate',
  confirmLabel = 'OK',
  allowDecimal = true,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const titleId = useId();
  const colors = ACCENT[accent];

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onChange(draft);
        setOpen(false);
        onConfirm?.(draft);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setDraft((d) => d.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(e.key) || (allowDecimal && e.key === '.')) {
        e.preventDefault();
        setDraft((d) => appendDigit(d, e.key, allowDecimal));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, draft, onChange, onConfirm, allowDecimal]);

  const press = (key: string) => {
    setDraft((d) => appendDigit(d, key, allowDecimal));
  };

  const applyAndConfirm = () => {
    onChange(draft);
    setOpen(false);
    onConfirm?.(draft);
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'] as const;

  return (
    <div className={`relative flex items-center gap-1 min-w-0 ${className}`}>
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
        className={`flex-1 min-w-0 text-left px-3 py-1.5 text-base bg-slate-50 rounded border border-transparent focus:outline-none focus:ring-2 ${colors.ring} ${triggerClassName}`}
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        title="Open keypad"
        aria-label="Open on-screen keypad"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={`w-full max-w-[340px] rounded-2xl border bg-white shadow-2xl p-4 ${colors.border}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 id={titleId} className="text-sm font-bold text-slate-800">
                    {title || 'Enter value'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{placeholder}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close keypad"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={`mb-3 rounded-xl border border-slate-100 px-3 py-3 text-right ${colors.soft}`}>
                <div className="text-3xl font-bold text-slate-800 tabular-nums tracking-wide min-h-[2rem]">
                  {draft || '0'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {keys.map((key) => {
                  if (key === '.') {
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!allowDecimal}
                        onClick={() => press('.')}
                        className={`h-16 rounded-xl border border-slate-200 bg-white text-2xl font-bold text-slate-700 shadow-sm transition-colors ${colors.btn} disabled:opacity-40`}
                      >
                        .
                      </button>
                    );
                  }
                  if (key === 'back') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDraft((d) => d.slice(0, -1))}
                        className={`h-16 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm flex items-center justify-center transition-colors ${colors.btn}`}
                        aria-label="Backspace"
                      >
                        <Delete className="w-6 h-6" />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => press(key)}
                      className={`h-16 rounded-xl border border-slate-200 bg-white text-2xl font-bold text-slate-800 shadow-sm transition-colors ${colors.btn}`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                <button
                  type="button"
                  onClick={() => setDraft('')}
                  className="h-14 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyAndConfirm}
                  className={`h-14 rounded-xl text-sm font-bold text-white shadow-sm ${colors.confirm}`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
