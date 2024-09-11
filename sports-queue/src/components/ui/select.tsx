'use client';

import React from 'react';

const SelectContext = React.createContext<{
  value: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
} | null>(null);

export function Select({ onValueChange, children }: { onValueChange: (value: string) => void; children: React.ReactNode }) {
  const [value, setValue] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onValueChange(newValue);
    setIsOpen(false);  // Close the select after choosing an option
  };

  return (
    <SelectContext.Provider value={{ value, onChange: handleChange, isOpen, setIsOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children }: { children: React.ReactNode }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within a Select');

  return (
    <div 
      className="border p-2 rounded cursor-pointer"
      onClick={() => context.setIsOpen(!context.isOpen)}
    >
      {children}
    </div>
  );
}

export function SelectValue({ placeholder }: { placeholder: string }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within a Select');

  return <span>{context.value || placeholder}</span>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectContent must be used within a Select');

  if (!context.isOpen) return null;

  return (
    <div className="absolute mt-1 w-full bg-white border rounded shadow-lg">
      {children}
    </div>
  );
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within a Select');

  return (
    <div 
      className="p-2 hover:bg-gray-100 cursor-pointer" 
      onClick={() => context.onChange(value)}
    >
      {children}
    </div>
  );
}