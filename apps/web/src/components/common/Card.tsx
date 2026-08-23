import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'solid' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'glass',
  ...props
}) => {
  const variantStyles = {
    glass: 'bg-white border border-slate-200/90 rounded-xl p-5 shadow-card',
    solid: 'bg-white border border-slate-200/90 rounded-xl p-5 shadow-card',
    interactive:
      'bg-white border border-slate-200/90 rounded-xl p-5 shadow-card hover:border-brand-400 hover:shadow-card-hover transition-all duration-200 cursor-pointer',
  };

  return (
    <div className={twMerge(clsx(variantStyles[variant], className))} {...props}>
      {children}
    </div>
  );
};
