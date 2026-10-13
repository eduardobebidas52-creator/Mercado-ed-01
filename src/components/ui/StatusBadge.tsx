/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'neutral';
  label: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  // Cores sem pills chamativos, usando texto e borda sutil com alto contraste
  const colorStyles = {
    success: 'text-emerald-700 bg-emerald-50 border border-emerald-200/80',
    warning: 'text-amber-800 bg-amber-50 border border-amber-200/80',
    error: 'text-rose-700 bg-rose-50 border border-rose-200/80',
    neutral: 'text-slate-700 bg-slate-50 border border-slate-200/80',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium tracking-tight ${colorStyles[status]}`}>
      {label}
    </span>
  );
};
