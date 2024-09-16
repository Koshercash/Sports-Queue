import React, { useRef } from 'react';
import Image from 'next/image';

interface InteractableProfilePictureProps {
  currentImage: string | null;
  onImageChange?: (file: File) => void;
  onClick?: () => void;
  priority?: boolean;
  isFriend?: boolean;
  onRemoveFriend?: () => void;
  size?: 'small' | 'medium' | 'large' | 'custom';
  customSize?: string;
}

export const InteractableProfilePicture: React.FC<InteractableProfilePictureProps> = ({
  currentImage,
  onImageChange,
  onClick,
  priority = false,
  size = 'medium',
  customSize,
}) => {
  console.log('InteractableProfilePicture received image:', currentImage);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onImageChange && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageChange) {
      onImageChange(file);
    }
  };

  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-16 h-16',
    large: 'w-32 h-32',
    custom: customSize || 'w-32 h-32', // Default to large if no custom size provided
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full overflow-hidden cursor-pointer relative`} 
      onClick={handleClick}
    >
      {currentImage ? (
        <Image
          src={currentImage}
          alt="Profile"
          layout="fill"
          objectFit="cover"
          priority={priority}
        />
      ) : (
        <div className="w-full h-full bg-gray-300 flex items-center justify-center">
          <span className="text-gray-500 text-sm">No Image</span>
        </div>
      )}
      {onImageChange && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      )}
    </div>
  );
};