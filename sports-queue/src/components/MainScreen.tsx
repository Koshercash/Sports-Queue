import React, { useState, useEffect } from 'react';
import { InteractableProfilePicture } from './InteractableProfilePicture';

// Assuming you have a list of friends
const initialFriends = [
  { id: 1, name: 'John Doe', image: 'path/to/image1.jpg' },
  { id: 2, name: 'Jane Smith', image: 'path/to/image2.jpg' },
  // Add more friends here
];

const MainScreen: React.FC = (props) => {
  const [friends, setFriends] = useState(initialFriends);

  useEffect(() => {
    console.log('Current friends:', friends);
  }, [friends]);

  const handleRemoveFriend = (friendId: number) => {
    console.log(`Attempting to remove friend with id: ${friendId}`);
    setFriends(prevFriends => {
      const updatedFriends = prevFriends.filter(friend => friend.id !== friendId);
      console.log(`Updated friends list:`, updatedFriends);
      return updatedFriends;
    });
    console.log(`Friend removal process completed for id ${friendId}`);
  };

  console.log('MainScreen props:', props);

  return (
    <div>
      <h2>Friends List</h2>
      {friends.map(friend => (
        <div key={friend.id}>
          <InteractableProfilePicture
            currentImage={friend.image}
            isFriend={true}
            onRemoveFriend={() => handleRemoveFriend(friend.id)}
          />
          <p>{friend.name}</p>
        </div>
      ))}
    </div>
  );
};

export default MainScreen;