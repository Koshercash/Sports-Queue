'use client';
import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'link';
  size?: 'default' | 'sm' | 'lg';
}

export function Button({ className, children, onClick, variant = 'default', size = 'default', ...props }: ButtonProps) {
  const baseStyles = 'font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';
  const variantStyles = {
    default: 'bg-green-500 text-white hover:bg-green-600',
    outline: 'border border-green-500 text-green-500 hover:bg-green-50',
    link: 'text-green-500 hover:underline'
  };
  const sizeStyles = {
    default: 'px-4 py-2',
    sm: 'px-2 py-1 text-sm',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}