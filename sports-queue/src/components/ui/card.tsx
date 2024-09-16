'use client';

import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={`bg-white shadow-md rounded-lg ${props.className || ''}`}>{children}</div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={`px-4 py-5 border-b border-gray-200 ${props.className || ''}`}>{children}</div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, ...props }) => (
  <h3 {...props} className={`text-lg leading-6 font-medium text-gray-900 ${props.className || ''}`}>{children}</h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, ...props }) => (
  <p {...props} className={`mt-1 text-sm text-gray-600 ${props.className || ''}`}>{children}</p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props} className={`px-4 py-5 ${props.className || ''}`}>{children}</div>
);