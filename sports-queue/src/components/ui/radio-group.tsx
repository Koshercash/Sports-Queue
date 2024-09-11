'use client';
import React from 'react';

interface RadioGroupProps {
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

export function RadioGroup({ onValueChange, children }: RadioGroupProps) {
  return (
    <div onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}>
      {children}
    </div>
  );
}

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  value: string;
}

export function RadioGroupItem({ className, value, ...props }: RadioGroupItemProps) {
  return (
    <input
      type="radio"
      value={value}
      className={`mr-2 focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 ${className}`}
      {...props}
    />
  );
}