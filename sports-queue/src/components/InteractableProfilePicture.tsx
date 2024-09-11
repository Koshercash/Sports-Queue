import React, { useRef, useState } from 'react';
import Image from 'next/image';

interface InteractableProfilePictureProps {
  currentImage: string | null;
  onImageChange?: (file: File) => void;
  onClick?: () => void;
  priority?: boolean;
  isFriend?: boolean;
  onRemoveFriend?: () => void;
}

export const InteractableProfilePicture: React.FC<InteractableProfilePictureProps> = ({
  currentImage,
  onImageChange,
  onClick,
  priority = false,
  isFriend = false,
  onRemoveFriend
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const [friend, setFriend] = useState(isFriend);

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

  const handleRemoveFriend = () => {
    if (onRemoveFriend) {
      onRemoveFriend();
      // setFriend(false);
    }
  };

  return (
    <div className="relative">
      <div onClick={handleClick} className="cursor-pointer">
        {currentImage ? (
          <div className="relative w-24 h-24">
            <Image
              src={currentImage}
              alt="Profile Picture"
              fill
              sizes="(max-width: 96px) 100vw, 96px"
              style={{ objectFit: 'cover' }}
              className="rounded-full"
              priority={priority}
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
      {isFriend && onRemoveFriend && (
        <button
          onClick={handleRemoveFriend}
          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
        >
          Remove
        </button>
      )}
    </div>
  );
};