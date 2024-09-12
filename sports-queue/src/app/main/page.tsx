'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/components/UserProfile';
import { InteractableProfilePicture } from '../../components/InteractableProfilePicture';
import Link from 'next/link';

interface UserProfile {
  id: string;
  name: string;
  position: string;
  skillLevel: string;
  mmr5v5: number;
  mmr11v11: number;
  profilePicture: string | null;
}

interface Friend {
  id: string;
  name: string;
  profilePicture: string | null;
}

interface MatchPlayer {
  id: string;
  name: string;
  position: string;
}

interface Match {
  team1: MatchPlayer[];
  team2: MatchPlayer[];
}

interface UserProfileData {
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
}

export default function MainScreen() {
  const [gameMode, setGameMode] = useState('5v5')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter();

  const [queueStatus, setQueueStatus] = useState<'idle' | 'queuing' | 'matched'>('idle');
  const [match, setMatch] = useState<Match | null>(null);
  const [dots, setDots] = useState('');

  const [selectedProfile, setSelectedProfile] = useState<UserProfileData | null>(null);
  const [removeMessage, setRemoveMessage] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);

  // Add a new state for friends search query
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  // Add this near the top of your component
  const [isSearchResultsVisible, setIsSearchResultsVisible] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (queueStatus === 'queuing') {
      interval = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
      }, 750); // Slowed down to 750ms (3/4 of a second)
    }
    return () => clearInterval(interval);
  }, [queueStatus]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const response = await axios.get('http://localhost:3002/api/user-profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserProfile(response.data);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem('token');
          router.push('/');
        }
      }
    };

    fetchUserProfile();
    fetchFriends();

    const intervalId = setInterval(() => {
      fetchUserProfile();
    }, 60000); // Refresh profile every minute

    return () => clearInterval(intervalId);
  }, [router]);

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<Friend[]>('http://localhost:3002/api/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Raw friends data from server:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        const formattedFriends = response.data.map(friend => {
          console.log('Processing friend:', friend);
          const formattedFriend = {
            ...friend,
            id: friend.id,
            name: friend.name,
            profilePicture: friend.profilePicture
              ? friend.profilePicture.startsWith('http')
                ? friend.profilePicture
                : `http://localhost:3002${friend.profilePicture}`
              : null
          };
          console.log('Formatted friend:', formattedFriend);
          return formattedFriend;
        });
        console.log('All formatted friends:', formattedFriends);
        setFriends(prevFriends => {
          const updatedFriends = formattedFriends.map(newFriend => {
            const existingFriend = prevFriends.find(f => f.id === newFriend.id);
            return existingFriend?.profilePicture ? { ...newFriend, profilePicture: existingFriend.profilePicture } : newFriend;
          });
          return updatedFriends;
        });
      } else {
        console.error('Unexpected response format:', response.data);
        setFriends([]);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
      setFriends([]);
    }
  };

  // Add this useEffect to call fetchFriends on component mount
  useEffect(() => {
    fetchFriends();
  }, []);

  const searchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:3002/api/users/search?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formattedResults = response.data
        .map((user: UserProfile) => ({
          ...user,
          profilePicture: user.profilePicture 
            ? user.profilePicture.startsWith('http')
              ? user.profilePicture
              : `http://localhost:3002${user.profilePicture}`
            : null
        }))
        .filter((user: UserProfile) => !friends.some(friend => friend.id === user.id));
      console.log('Formatted search results:', formattedResults);
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const addFriend = async (friendId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:3002/api/friends/add', { friendId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Server response for adding friend:', response.data);

      if (response.data.error === 'Friendship already exists') {
        setRemoveMessage('This user is already your friend.');
        return;
      }

      const newFriend = response.data;
      const friendFromSearch = searchResults.find(user => user.id === friendId);
      
      const formattedNewFriend = {
        id: friendId,
        name: newFriend.name || friendFromSearch?.name,
        profilePicture: friendFromSearch?.profilePicture || newFriend.profilePicture || null
      };
      
      if (formattedNewFriend.profilePicture && !formattedNewFriend.profilePicture.startsWith('http')) {
        formattedNewFriend.profilePicture = `http://localhost:3002${formattedNewFriend.profilePicture}`;
      }
      
      console.log('Formatted new friend to be added:', formattedNewFriend);
      setFriends(prevFriends => [...prevFriends, formattedNewFriend]);
      setSearchResults(prevResults => prevResults.filter(user => user.id !== friendId));
      setSearchQuery('');
      
      console.log('Updated friends list:', [...friends, formattedNewFriend]);
    } catch (error) {
      console.error('Failed to add friend:', error);
      setRemoveMessage('Failed to add friend. Please try again.');
    }
  };

  const removeFriend = async (friend: Friend) => {
    console.log('Attempting to remove friend:', friend);
    if (!friend || typeof friend !== 'object') {
      console.error('Invalid friend object:', friend);
      setRemoveMessage('Invalid friend selected for removal');
      return;
    }
    if (!friend.id) {
      console.error('Friend object has no id:', friend);
      setRemoveMessage('Friend object is missing an id');
      return;
    }
    setFriendToRemove(friend);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove || !friendToRemove.id) {
      console.error('Invalid friend to remove:', friendToRemove);
      setRemoveMessage('Invalid friend selected for removal');
      return;
    }
  
    console.log('Attempting to remove friend:', friendToRemove);
  
    try {
      const token = localStorage.getItem('token');
      console.log('Using token:', token ? 'Token exists' : 'No token found');
      const response = await axios.delete(`http://localhost:3002/api/friends/${friendToRemove.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Server response:', response.data);
      setRemoveMessage(response.data.message);
      setFriends(friends.filter(f => f.id !== friendToRemove.id));
      setFriendToRemove(null);
      setTimeout(() => setRemoveMessage(null), 3000);
    } catch (error) {
      console.error('Error removing friend:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        setRemoveMessage(`Failed to remove friend: ${error.response?.data?.error || error.message}`);
      } else {
        console.error('Unexpected error:', error);
        setRemoveMessage('An unexpected error occurred while removing friend');
      }
    }
  };

  const toggleQueue = async () => {
    if (queueStatus === 'idle') {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post('http://localhost:3002/api/queue/join', 
          { gameMode },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.match) {
          setQueueStatus('matched');
          setMatch(response.data.match);
        } else {
          setQueueStatus('queuing');
        }
      } catch (error) {
        console.error('Failed to join queue:', error);
        alert('Failed to join queue. Please try again.');
      }
    } else if (queueStatus === 'queuing') {
      try {
        const token = localStorage.getItem('token');
        await axios.post('http://localhost:3002/api/queue/leave', 
          { gameMode },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setQueueStatus('idle');
        setDots(''); // Reset dots when leaving queue
      } catch (error) {
        console.error('Failed to leave queue:', error);
        alert('Failed to leave queue. Please try again.');
      }
    }
  };

  const fetchUserProfile = async (userId: string) => {
    console.log('Fetching profile for user:', userId);
    if (!userId) {
      console.error('Invalid userId:', userId);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      console.log('Using token:', token);
      const response = await axios.get<UserProfileData>(`http://localhost:3002/api/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched user profile:', response.data);
      setSelectedProfile(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        setRemoveMessage(`Failed to load user data: ${error.response?.data?.error || error.message}`);
      } else {
        console.error('Unexpected error:', error);
        setRemoveMessage('An unexpected error occurred while fetching user data');
      }
    }
  };

  useEffect(() => {
    console.log('Current friends state:', friends);
    friends.forEach(friend => {
      console.log(`Friend ${friend.name}:`, {
        id: friend.id,
        profilePicture: friend.profilePicture
      });
    });
  }, [friends]);

  // Add a function to filter friends based on the search query
  const filteredFriends = friends.filter(friend => 
    friend.name.toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  useEffect(() => {
    console.log('Friends state updated:', friends);
  }, [friends]);

  useEffect(() => {
    localStorage.setItem('friends', JSON.stringify(friends));
  }, [friends]);

  // Add this at the beginning of the MainScreen component
  useEffect(() => {
    const storedFriends = localStorage.getItem('friends');
    if (storedFriends) {
      setFriends(JSON.parse(storedFriends));
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-black relative">
      <header className="flex justify-between items-center p-4 bg-green-500 text-white">
        <h1 className="text-2xl font-bold">Sports Queue</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-white border-white hover:bg-green-600">Info</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Welcome to Sports Queue!</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              <p className="mb-2">The best way to find your individual skill level, and quickly find competitive games near you.</p>
              <h3 className="font-bold mt-4 mb-2">Rules:</h3>
              <p className="mb-2">Sports Queue is entirely player ran, so it costs no money. However, for games you will need a red or blue jersey/penny or clothes to easily tell teams apart!</p>
              <p className="mb-2">To make sure game scores are correctly reported, enter the correct game score after the game, after 30 minutes the game will be concluded, and the highest vote will be used.</p>
              <h3 className="font-bold mt-4 mb-2">Cheating/Unfair Play:</h3>
              <p className="mb-2">If you are reported by 3 or more players in a single game, or excessively reported over multiple, action will be taken. This can be for excessive fouling, breaking the rules of the game, or harassing a player. Any physical fights or purposely conspiring to report the wrong score will be met with a permanent ban.</p>
              <p className="mb-2">Try to limit the roughness, focus on your skills as well as positioning and having fun! People may want to play many games so please do your best to not injure anyone else.</p>
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 pb-32">
        {removeMessage && (
          <div className="mb-4 p-4 border border-green-500 bg-green-50 rounded-md">
            <h4 className="font-bold">Notification</h4>
            <p>{removeMessage}</p>
          </div>
        )}

        <Tabs defaultValue="home">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="recent">Recent Games</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
          </TabsList>
          <TabsContent value="home">
            <Card>
              <CardHeader>
                <CardTitle>Welcome to Sports Queue</CardTitle>
                <CardDescription>Your home for organizing and joining sports games</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Click the Play button below to join or create a game.</p>
                <p>Current game mode: {gameMode}</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>View your profile information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4 mb-4">
                  <Link href={`/profile/${userProfile?.id}`}>
                    <InteractableProfilePicture
                      currentImage={userProfile?.profilePicture ? `http://localhost:3002${userProfile.profilePicture}` : null}
                      onImageChange={undefined}
                      priority={true}
                    />
                  </Link>
                  <div>
                    <h3 className="text-xl font-bold">{userProfile?.name || 'User Name'}</h3>
                    <p>Position: {userProfile?.position || 'Not set'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p><strong>Skill Level:</strong> {userProfile?.skillLevel || 'Not set'}</p>
                  <p><strong>5v5 MMR:</strong> {userProfile?.mmr5v5 || 'Not set'}</p>
                  <p><strong>11v11 MMR:</strong> {userProfile?.mmr11v11 || 'Not set'}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Games</CardTitle>
                <CardDescription>Games played near you</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[1, 2, 3].map((game) => (
                    <li key={game} className="border-b pb-2">
                      <p className="font-bold">Game {game}</p>
                      <p>Score: 3 - 2</p>
                      <p>Location: Central Park Field {game}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>Top players based on MMR</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[1, 2, 3].map((rank) => (
                    <li key={rank} className="flex items-center space-x-2 border-b pb-2">
                      <span className="font-bold">{rank}.</span>
                      <Avatar>
                        <AvatarImage src={`/placeholder-avatar-${rank}.jpg`} alt={`Rank ${rank} player`} />
                        <AvatarFallback>R{rank}</AvatarFallback>
                      </Avatar>
                      <span>Player {rank}</span>
                      <span className="ml-auto">MMR: {2000 - (rank * 100)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="friends">
            <Card>
              <CardHeader>
                <CardTitle>Friends</CardTitle>
                <CardDescription>Manage your friends list</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2 mb-4">
                  <Input 
                    placeholder="Search users" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Button onClick={searchUsers}>Search</Button>
                  {searchResults.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSearchResults([])}
                    >
                      X
                    </Button>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold mb-2">Search Results:</h3>
                    <ul className="space-y-2">
                      {searchResults.map((user) => (
                        <li key={user.id} className="flex items-center space-x-2 border-b pb-2">
                          <InteractableProfilePicture
                            currentImage={user.profilePicture}
                            onImageChange={undefined}
                            onClick={() => fetchUserProfile(user.id)}
                          />
                          <span>{user.name}</span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="ml-auto"
                            onClick={() => addFriend(user.id)}
                          >
                            Add Friend
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Add new search bar for friends list */}
                <div className="mb-4">
                  <Input 
                    placeholder="Filter friends" 
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                  />
                </div>
                <h3 className="font-bold mb-2">Your Friends:</h3>
                <ul className="space-y-2">
                  {filteredFriends.map((friend) => (
                    <li key={friend.id} className="flex items-center space-x-2 border-b pb-2">
                      <InteractableProfilePicture
                        currentImage={friend.profilePicture || null}
                        onImageChange={undefined}
                        onClick={() => friend.id && fetchUserProfile(friend.id)}
                      />
                      <span className="font-semibold">{friend.name}</span>
                      <div className="ml-auto space-x-2">
                        <Button variant="outline" size="sm">Message</Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeFriend(friend)}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center space-y-4">
        <Button 
          className="w-64 h-16 text-2xl bg-green-500 hover:bg-green-600 text-white border-2 border-black"
          onClick={toggleQueue}
          disabled={queueStatus === 'matched'}
        >
          {queueStatus === 'idle' ? 'Play' : queueStatus === 'queuing' ? `Queuing${dots}` : 'Match Found!'}
        </Button>
        <Button 
          variant="outline" 
          className="text-sm"
          onClick={() => setGameMode(gameMode === '5v5' ? '11v11' : '5v5')}
          disabled={queueStatus !== 'idle'}
        >
          Game Mode: {gameMode}
        </Button>
      </div>

      {match && (
        <Dialog 
          open={queueStatus === 'matched'} 
          onOpenChange={(open) => {
            if (!open) setQueueStatus('idle');
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Match Found!</DialogTitle>
            </DialogHeader>
            <div>
              <h3>Team 1</h3>
              <ul>
                {match.team1.map(player => (
                  <li key={player.id}>{player.name} - {player.position}</li>
                ))}
              </ul>
              <h3>Team 2</h3>
              <ul>
                {match.team2.map(player => (
                  <li key={player.id}>{player.name} - {player.position}</li>
                ))}
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedProfile && (
        <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedProfile.name}'s Profile</DialogTitle>
            </DialogHeader>
            <UserProfile
              {...selectedProfile}
              onProfilePictureChange={undefined}
            />
            <Button onClick={() => setSelectedProfile(null)}>Close</Button>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!friendToRemove} onOpenChange={(open) => {
        if (!open) setFriendToRemove(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Friend</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to remove {friendToRemove?.name} from your friends list?</p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setFriendToRemove(null)}>Cancel</Button>
            <Button onClick={confirmRemoveFriend}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="link" className="absolute bottom-4 left-4">Home</Button>
    </div>
  )
}