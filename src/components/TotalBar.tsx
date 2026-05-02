import React from 'react';
import { formatCurrency } from '../utils';

interface TotalBarProps {
  totalCents: number;
}

export const TotalBar: React.FC<TotalBarProps> = ({ totalCents }) => {
  return (
    <div className="total-bar-main-wrap">
      <div className="total-bar total-bar--panel">
        <span className="total-bar__label">Gasto total</span>
        <span className="total-bar__value">{formatCurrency(totalCents)}</span>
      </div>
    </div>
  );
};
