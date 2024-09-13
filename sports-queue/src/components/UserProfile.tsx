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
  isEditable = true // Default to true for backwards compatibility
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
    <div className="space-y-4">
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
        <h3 className="font-semibold">Bio:</h3>
        {isEditable && isCurrentUser && isEditing ? (
          <>
            <textarea
              value={editedBio}
              onChange={handleBioChange}
              className="w-full p-2 border rounded"
            />
            <div className="mt-2">
              <Button onClick={handleSaveBio} className="mr-2">Save</Button>
              <Button onClick={() => setIsEditing(false)} variant="outline">Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <p>{bio}</p>
            {isEditable && isCurrentUser && (
              <Button onClick={() => setIsEditing(true)} className="mt-2">Edit Bio</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}