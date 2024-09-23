import React from 'react';
import Image from 'next/image';

interface InteractableProfilePictureProps {
  currentImage: string | null;
  onImageChange?: (file: File) => void;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large' | 'custom';
  customSize?: string;
}

export function InteractableProfilePicture({
  currentImage,
  onImageChange,
  onClick,
  size = 'medium',
  customSize
}: InteractableProfilePictureProps) {
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-20 h-20',
    large: 'w-32 h-32',
    custom: customSize
  };

  const imageSize = size === 'custom' ? parseInt(customSize?.split('w-')[1] || '40', 10) : 
    size === 'small' ? 40 : size === 'medium' ? 80 : 128;

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden`}>
      <Image
        src={currentImage || '/default-avatar.jpg'}
        alt="Profile picture"
        width={imageSize}
        height={imageSize}
        className="object-cover"
        onClick={onClick}
      />
      {onImageChange && (
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onImageChange(e.target.files[0]);
            }
          }}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      )}
    </div>
  );
}