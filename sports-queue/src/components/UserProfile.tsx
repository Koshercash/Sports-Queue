import React, { useState } from 'react';
import { InteractableProfilePicture } from './InteractableProfilePicture';
import { Button } from './ui/button';
import Image from 'next/image';
import { API_BASE_URL } from '../config/api';

interface UserProfileProps {
  id: string;
  name: string;
  sex: string;
  position: string;
  secondaryPosition: string;
  dateOfBirth: string;
  profilePicture: string | null;
  isCurrentUser: boolean;
  mmr5v5: number;
  mmr11v11: number;
  bio: string;
  cityTown: string; // Add this line
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
  secondaryPosition,
  dateOfBirth, 
  profilePicture, 
  isCurrentUser, 
  mmr5v5, 
  mmr11v11, 
  bio,
  cityTown, // Add this line
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

  const getProfilePictureUrl = (profilePicture: string | null): string => {
    if (!profilePicture) return '/default-avatar.jpg';
    if (profilePicture.startsWith('http')) return profilePicture;
    return `${API_BASE_URL}${profilePicture}`;
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
        <div className="flex-shrink-0 w-40 h-40 relative">
          {isEditable && onProfilePictureChange ? (
            <InteractableProfilePicture
              currentImage={getProfilePictureUrl(profilePicture)}
              onImageChange={onProfilePictureChange}
              size="large"
            />
          ) : (
            <Image
              src={profilePicture || '/default-avatar.jpg'}
              alt={`${name}'s profile picture`}
              width={160}
              height={160}
              className="rounded-full object-cover"
            />
          )}
        </div>
        <div className="flex-grow">
          <h2 className="text-2xl font-bold">{name}</h2>
          <p><strong>Primary Position:</strong> {position || 'Not specified'}</p>
          <p><strong>Secondary Position:</strong> {secondaryPosition || 'Not specified'}</p>
          <p><strong>City/Town:</strong> {cityTown}</p>
          {isCurrentUser && <p><strong>Sex:</strong> {sex}</p>}
          <p><strong>Date of Birth:</strong> {new Date(dateOfBirth).toLocaleDateString()}</p>
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
      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="text-xl font-semibold mb-2">Player Ratings</h3>
        <div className="flex justify-between">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">5v5 MMR</p>
            <p className="text-3xl font-bold">{mmr5v5}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">11v11 MMR</p>
            <p className="text-3xl font-bold">{mmr11v11}</p>
          </div>
        </div>
      </div>
    </div>
  );
}