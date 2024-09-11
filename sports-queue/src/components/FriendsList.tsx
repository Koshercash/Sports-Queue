import React from 'react';
import { FriendProfile } from './FriendProfile';

interface Friend {
  id: string;
  name: string;
  profilePicture: string;
}

interface FriendsListProps {
  friends: Friend[];
}

export const FriendsList: React.FC<FriendsListProps> = ({ friends }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Friends</h2>
      {friends.map((friend) => (
        <FriendProfile
          key={friend.id}
          id={friend.id}
          name={friend.name}
          profilePicture={friend.profilePicture}
        />
      ))}
    </div>
  );
};