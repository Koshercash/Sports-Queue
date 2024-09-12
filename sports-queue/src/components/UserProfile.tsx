import React, { useState } from 'react';
import { InteractableProfilePicture } from './InteractableProfilePicture';
import { Button } from './ui/button';

interface UserProfileProps {
  id: string;
  name: string;
  sex: string;
  position: string;
  dateOfBirth: string;
  profilePicture: string | null;
  isCurrentUser: boolean;
  mmr5v5: number;
  mmr11v11: number;
  bio: string;
  onProfilePictureChange?: (file: File) => void;
  onBioChange?: (bio: string) => void;
  onAddFriend?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  id,
  name,
  sex,
  position,
  dateOfBirth,
  profilePicture,
  isCurrentUser,
  mmr5v5,
  mmr11v11,
  bio,
  onProfilePictureChange,
  onBioChange,
  onAddFriend
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState(bio);

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedBio(e.target.value);
  };

  const handleSaveBio = () => {
    if (onBioChange) {
      onBioChange(editedBio);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 relative">
      <div className="flex items-center space-x-4 mb-4">
        <InteractableProfilePicture
          currentImage={profilePicture}
          onImageChange={isCurrentUser ? onProfilePictureChange : undefined}
        />
        <div>
          <h2 className="text-2xl font-bold">{name}</h2>
          <p>{position}</p>
        </div>
      </div>
      <div className="space-y-2">
        <p><strong>Sex:</strong> {sex}</p>
        <p><strong>Date of Birth:</strong> {new Date(dateOfBirth).toLocaleDateString()}</p>
        <p><strong>5v5 MMR:</strong> {mmr5v5}</p>
        <p><strong>11v11 MMR:</strong> {mmr11v11}</p>
      </div>
      <div className="mt-4">
        <h3 className="font-bold mb-2">Bio</h3>
        {isEditing ? (
          <>
            <textarea
              value={editedBio}
              onChange={handleBioChange}
              className="w-full mb-2 p-2 border rounded"
              rows={4}
            />
            <Button onClick={handleSaveBio}>Save Bio</Button>
          </>
        ) : (
          <>
            <p>{editedBio}</p>
            {isCurrentUser && (
              <Button onClick={() => setIsEditing(true)} className="mt-2">
                Edit Bio
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};