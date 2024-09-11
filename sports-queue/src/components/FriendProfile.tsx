import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface FriendProfileProps {
  id: string;
  name: string;
  profilePicture: string;
}

export const FriendProfile: React.FC<FriendProfileProps> = ({ id, name, profilePicture }) => {
  return (
    <Link href={`/profile/${id}`} className="cursor-pointer flex items-center space-x-4">
      <Image
        src={profilePicture}
        alt={`${name}'s profile picture`}
        width={50}
        height={50}
        className="rounded-full"
      />
      <span>{name}</span>
    </Link>
  );
};