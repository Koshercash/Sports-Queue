'use client';
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  name?: string;
}

export function Input({ className, name, ...props }: InputProps) {
  return (
    <input
      name={name}
      className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${className}`}
      {...props}
    />
  );
}