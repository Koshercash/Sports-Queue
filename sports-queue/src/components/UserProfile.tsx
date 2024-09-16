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
  isEditable?: boolean;
}

export function UserProfile({ 
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
  isEditable = true
}: UserProfileProps) {
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
    <div className="flex items-start space-x-6">
      <div className="flex-shrink-0">
        <InteractableProfilePicture
          currentImage={profilePicture}
          onImageChange={isCurrentUser ? onProfilePictureChange : undefined}
        />
      </div>
      <div className="flex-grow">
        <h2 className="text-2xl font-bold">{name}</h2>
        <p><strong>Position:</strong> {position}</p>
        <p><strong>Sex:</strong> {sex}</p>
        <p><strong>Date of Birth:</strong> {new Date(dateOfBirth).toLocaleDateString()}</p>
        <p><strong>5v5 MMR:</strong> {mmr5v5}</p>
        <p><strong>11v11 MMR:</strong> {mmr11v11}</p>
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Bio</h3>
          {isEditing ? (
            <>
              <textarea
                value={editedBio}
                onChange={handleBioChange}
                className="w-full p-2 border rounded"
              />
              <Button onClick={handleSaveBio}>Save Bio</Button>
            </>
          ) : (
            <>
              <p>{bio}</p>
              {isCurrentUser && isEditable && (
                <Button onClick={() => setIsEditing(true)}>Edit Bio</Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}