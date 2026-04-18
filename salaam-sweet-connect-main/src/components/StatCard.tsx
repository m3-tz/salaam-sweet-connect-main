import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | null;
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  variant = 'default',
  onClick
}: StatCardProps) {
  const variantStyles = {
    default: 'border-slate-200 dark:border-slate-800',
    primary: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20',
    success: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20',
    destructive: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20',
  };

  const iconColor = {
    default: 'text-slate-600 dark:text-slate-400',
    primary: 'text-blue-600 dark:text-blue-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    destructive: 'text-red-600 dark:text-red-400',
  };

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg transition-all cursor-pointer ${variantStyles[variant]}`}
    >
      {/* Header with Icon */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
        </div>
        {icon && (
          <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 ${iconColor[variant]}`}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-3">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {value}
        </h3>
      </div>

      {/* Description & Trend */}
      <div className="flex items-center justify-between text-xs">
        {description && (
          <p className="text-slate-500 dark:text-slate-400">{description}</p>
        )}
        {trendValue && (
          <span className={`font-bold ${
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
            trend === 'down' ? 'text-red-600 dark:text-red-400' :
            'text-slate-500'
          }`}>
            {trend === 'up' ? '↑ ' : trend === 'down' ? '↓ ' : ''}{trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
