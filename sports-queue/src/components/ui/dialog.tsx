'use client';

import React, { useState, ReactNode, createContext, useContext } from 'react';

interface DialogContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

interface DialogProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dialog = ({ children, open: controlledOpen, onOpenChange }: DialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <DialogContext.Provider value={{ isOpen, setIsOpen: setOpen }}>
      {children}
    </DialogContext.Provider>
  );
};

export const DialogTrigger = ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogTrigger must be used within a Dialog');

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...children.props,
      onClick: (e: React.MouseEvent) => {
        context.setIsOpen(true);
        if (children.props.onClick) {
          children.props.onClick(e);
        }
      }
    });
  }
  return <div onClick={() => context.setIsOpen(true)}>{children}</div>;
};

export const DialogContent = ({ children, className }: { children: ReactNode; className?: string }) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogContent must be used within a Dialog');

  if (!context.isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`relative bg-white p-6 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto text-black ${className}`}>
        <button 
          onClick={() => context.setIsOpen(false)}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 bg-white rounded-full border border-gray-300 hover:bg-gray-100"
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

export const DialogHeader = ({ children }: { children: ReactNode }) => <div className="mb-4">{children}</div>;
export const DialogTitle = ({ children }: { children: ReactNode }) => <h2 className="text-xl font-bold mb-2">{children}</h2>;
export const DialogDescription = ({ children }: { children: ReactNode }) => <div className="text-gray-700">{children}</div>;