import { ReactNode } from 'react';

interface ScrollAreaProps {
  className?: string;
  children: ReactNode;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ className = '', children }) => {
  return (
    <div className={`overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 ${className}`}>
      {children}
    </div>
  );
};