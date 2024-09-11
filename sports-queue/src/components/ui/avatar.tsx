'use client';

import React from 'react';

export const Avatar = ({ children }: { children: React.ReactNode }) => <div className="w-10 h-10 rounded-full overflow-hidden">{children}</div>;
export const AvatarImage = ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} className="w-full h-full object-cover" />;
export const AvatarFallback = ({ children }: { children: React.ReactNode }) => <div className="w-full h-full bg-gray-200 flex items-center justify-center">{children}</div>;