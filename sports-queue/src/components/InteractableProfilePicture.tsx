import React, { useRef } from 'react';
import Image from 'next/image';

interface InteractableProfilePictureProps {
  currentImage: string | null;
  onImageChange?: (file: File) => void;
  onClick?: () => void;
  priority?: boolean; // Add this line
}
export function InteractableProfilePicture({
  currentImage,
  onImageChange,
  onClick,
  priority = false
}: InteractableProfilePictureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onImageChange) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageChange) {
      onImageChange(file);
    }
  };

  return (
    <div onClick={handleClick} className={`cursor-pointer ${onImageChange || onClick ? '' : 'pointer-events-none'}`}>
      {currentImage ? (
        <div className="relative w-24 h-24">
          <Image
            src={currentImage}
            alt="Profile Picture"
            layout="fill"
            objectFit="cover"
            className="rounded-full"
            priority={priority} // Add this line
          />
        </div>
      ) : (
        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-gray-500">Add Photo</span>
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