import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';

interface InteractableProfilePictureProps {
  currentImage: string | null;
  onImageChange?: (file: File) => void;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function InteractableProfilePicture({
  currentImage,
  onImageChange,
  onClick,
  size = 'medium'
}: InteractableProfilePictureProps) {
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-16 h-16',
    large: 'w-40 h-40'
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onImageChange) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          onImageChange(file);
        }
      };
      input.click();
    }
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full overflow-hidden relative cursor-pointer transition-transform hover:scale-105`}
      onClick={handleClick}
    >
      {currentImage ? (
        <Image
          src={currentImage}
          alt="Profile"
          layout="fill"
          objectFit="cover"
          className="rounded-full"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <User className="text-gray-400" size={size === 'large' ? 64 : 32} />
        </div>
      )}
      {onImageChange && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-white text-sm">Change</span>
        </div>
      )}
    </div>
  );
}