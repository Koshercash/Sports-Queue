import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'link';
  size?: 'default' | 'sm' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'default', size = 'default', className, ...props }) => {
  const baseStyles = 'rounded transition-colors duration-200';
  const variantStyles = {
    default: 'bg-green-500 text-white hover:bg-green-600',
    outline: 'bg-transparent border border-green-500 text-green-500 hover:bg-green-50',
    link: 'bg-transparent text-green-500 hover:underline'
  };
  const sizeStyles = {
    default: 'px-4 py-2',
    sm: 'px-2 py-1 text-sm',
    lg: 'px-6 py-3 text-lg'
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`;

  return (
    <button {...props} className={combinedClassName}>
      {children}
    </button>
  );
};