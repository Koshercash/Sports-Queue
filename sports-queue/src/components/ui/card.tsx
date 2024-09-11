'use client';

import React from 'react';

export const Card = ({ children }: { children: React.ReactNode }) => <div className="border rounded p-4">{children}</div>;
export const CardHeader = ({ children }: { children: React.ReactNode }) => <div className="mb-4">{children}</div>;
export const CardTitle = ({ children }: { children: React.ReactNode }) => <h3 className="text-xl font-bold">{children}</h3>;
export const CardDescription = ({ children }: { children: React.ReactNode }) => <p className="text-gray-500">{children}</p>;
export const CardContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;