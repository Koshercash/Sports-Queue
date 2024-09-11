import React from 'react';
import { InteractableProfilePicture } from './InteractableProfilePicture';
import axios from 'axios'; // Make sure to import axios

interface Friend {
  id: string;
  name: string;
  profilePicture: string;
}

interface FriendsListProps {
  friends: Friend[];
  onRemoveFriend: (id: string) => void | Promise<void>;
  onFriendClick: (id: string) => void;
}

export const FriendsList: React.FC<FriendsListProps> = ({ friends, onRemoveFriend, onFriendClick }) => {
  const handleRemoveFriend = async (id: string) => {
    try {
      if (!id) {
        throw new Error('Friend ID is undefined');
      }
      const result = onRemoveFriend(id);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error('Failed to remove friend:', error);
      // ... rest of the error handling ...
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Friends</h2>
      {friends.map((friend) => (
        <div key={friend.id} className="flex items-center space-x-4">
          <InteractableProfilePicture
            currentImage={friend.profilePicture}
            onClick={() => onFriendClick(friend.id)}
            isFriend={true}
            onRemoveFriend={() => handleRemoveFriend(friend.id)}
          />
          <span>{friend.name}</span>
        </div>
      ))}
    </div>
  );
};