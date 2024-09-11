import React from 'react';
import { InteractableProfilePicture } from './InteractableProfilePicture';

interface UserProfileProps {
  id: string;
  name: string;
  email: string;
  phone: string;
  sex: string;
  position: string;
  skillLevel: string;
  dateOfBirth: string;
  profilePicture: string | null;
  isCurrentUser: boolean;
  mmr5v5: number;
  mmr11v11: number;
  onProfilePictureChange?: (file: File) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  name, email, phone, sex, position, skillLevel, dateOfBirth, profilePicture, isCurrentUser, mmr5v5, mmr11v11, onProfilePictureChange
}) => {
  return (
    <div className="space-y-4">
      <InteractableProfilePicture
        currentImage={profilePicture ? `http://localhost:3002${profilePicture}` : null}
        onImageChange={isCurrentUser ? onProfilePictureChange : undefined}
      />
      <h2 className="text-2xl font-bold">{name}</h2>
      <p>Email: {email}</p>
      <p>Phone: {phone}</p>
      <p>Sex: {sex}</p>
      <p>Position: {position}</p>
      <p>Skill Level: {skillLevel}</p>
      <p>Date of Birth: {dateOfBirth}</p>
      <p>5v5 MMR: {mmr5v5}</p>
      <p>11v11 MMR: {mmr11v11}</p>
    </div>
  );
};