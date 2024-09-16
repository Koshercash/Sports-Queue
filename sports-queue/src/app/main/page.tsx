
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
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
import styles from './styles.module.css';
import GameScreen from '../game/page';
import { useGeolocation } from '@/hooks/useGeolocation';
import MatchHistory from '@/components/MatchHistory';

interface UserProfile {
  id: string;
  name: string;
  sex: string;
  position: string;
  skillLevel: string;
  dateOfBirth: string;
  profilePicture: string | null;
  mmr5v5: number;
  mmr11v11: number;
  bio: string;
  cityTown: string; // Added cityTown property
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
  profilePicture?: string | null;
}

interface Match {
  team1: MatchPlayer[];
  team2: MatchPlayer[];
}

interface UserProfileData {
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
  cityTown: string; // Added cityTown property
}

interface PendingRequest {
  id: string;
  name: string;
  profilePicture: string | null;
}

interface RecentGame {
  id: string;
  mode: '5v5' | '11v11';
  blueScore: number;
  redScore: number;
  location: string;
  endTime: string;
  distance: number;
  players: { id: string; name: string }[];
}

interface Player {
  id: string;
  name: string;
  position: string;
  team: 'blue' | 'red';
  profilePicture?: string | null;
}

export default function MainScreen() {
  const [gameMode, setGameMode] = useState<'5v5' | '11v11'>('5v5')
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

  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [isSearchResultsVisible, setIsSearchResultsVisible] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [newMessages, setNewMessages] = useState<number>(0);
  const [notificationsViewed, setNotificationsViewed] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [inGame, setInGame] = useState(false);
  const [gameState, setGameState] = useState<'idle' | 'loading' | 'inGame'>('idle');
  const [isPenalized, setIsPenalized] = useState(false);
  const [penaltyEndTime, setPenaltyEndTime] = useState<Date | null>(null);
  const [isGameInProgress, setIsGameInProgress] = useState(false);
  const [lobbyTime, setLobbyTime] = useState(0);

  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const { latitude, longitude, error: geoError } = useGeolocation();
  const [matchHistory, setMatchHistory] = useState<RecentGame[]>([]);
  const [shouldRefreshMatchHistory, setShouldRefreshMatchHistory] = useState(false);

  const totalNotifications = pendingRequests.length + newMessages;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'friends') {
      setNotificationsViewed(true);
    }
  };

  const handleBackFromGame = (gameJustEnded = false) => {
    console.log('Handling back from game');
    if (gameJustEnded) {
      setInGame(false);
      setIsGameInProgress(false);
      setMatch(null);
      setGameState('idle');
      setQueueStatus('idle');
      setLobbyTime(0);
      localStorage.removeItem('gameState');
      setShouldRefreshMatchHistory(true);
    } else {
      const savedGameState = localStorage.getItem('gameState');
      if (savedGameState) {
        const parsedGameState = JSON.parse(savedGameState);
        setInGame(false);
        setIsGameInProgress(true);
        setMatch(parsedGameState.match);
        setGameMode(parsedGameState.mode);
        setLobbyTime(parsedGameState.lobbyTime);
        setQueueStatus('matched');
      }
    }
  };

  const handleReturnToGame = () => {
    console.log('Handling return to game');
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
      const parsedGameState = JSON.parse(savedGameState);
      console.log('Parsed game state:', parsedGameState);
      if (parsedGameState.isReturning) {
        setInGame(true);
        setGameState({
          ...parsedGameState,
          gameStartTime: parsedGameState.gameStartTime ? new Date(parsedGameState.gameStartTime) : null,
        });
        setMatch({
          team1: parsedGameState.players.filter((p: Player) => p.team === 'blue'),
          team2: parsedGameState.players.filter((p: Player) => p.team === 'red')
        });
        setGameMode(parsedGameState.mode);
        setIsGameInProgress(true);
        setLobbyTime(parsedGameState.lobbyTime || 0);
        setQueueStatus('matched');
        
        // Remove the isReturning flag
        localStorage.setItem('gameState', JSON.stringify({
          ...parsedGameState,
          isReturning: false
        }));
      } else {
        console.log('No game to return to');
      }
    } else {
      console.log('No saved game state found');
    }
  };

  const toggleQueue = async () => {
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
      const parsedGameState = JSON.parse(savedGameState);
      if (parsedGameState.isReturning || isGameInProgress) {
        handleReturnToGame();
        return;
      }
    }

    // Check penalty status before joining queue
    await checkPenaltyStatus();

    if (isPenalized) {
      alert(`You are currently penalized and cannot join games until ${penaltyEndTime?.toLocaleString()}`);
      return;
    }

    if (queueStatus === 'idle') {
      try {
        const token = localStorage.getItem('token');
        console.log('Attempting to join queue with token:', token ? 'Token exists' : 'No token');
        const response = await axios.post('http://localhost:3002/api/queue/join', 
          { gameMode },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Queue join response:', response.data);
        if (response.data.match) {
          setQueueStatus('matched');
          setMatch(response.data.match);
          setGameState('loading');
          setTimeout(() => {
            setGameState('inGame');
            setInGame(true);
            setIsGameInProgress(true);
            setLobbyTime(0); // Reset lobby time for new game
            localStorage.setItem('gameState', JSON.stringify({
              gameState: 'inGame',
              match: response.data.match,
              mode: gameMode,
              lobbyTime: 0,
              gameEnded: false
            }));
          }, 3000);
        } else {
          setQueueStatus('queuing');
        }
      } catch (error) {
        console.error('Detailed error in joining queue:', error);
        if (axios.isAxiosError(error)) {
          console.error('Axios error details:', error.response?.data);
          alert(error.response?.data?.error || 'Failed to join queue. Please try again.');
        } else {
          alert('An unexpected error occurred. Please try again.');
        }
      }
    } else if (queueStatus === 'queuing') {
      // Logic to leave the queue
      try {
        const token = localStorage.getItem('token');
        await axios.post('http://localhost:3002/api/queue/leave', 
          { gameMode },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setQueueStatus('idle');
        setDots('');
      } catch (error) {
        console.error('Failed to leave queue:', error);
        alert('Failed to leave queue. Please try again.');
      }
    }
  };

  const fetchUserProfile = async (userId?: string) => {
    try {
      const token = localStorage.getItem('token');
      const url = userId 
        ? `http://localhost:3002/api/user/${userId}`
        : 'http://localhost:3002/api/user-profile';
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Ensure the profilePicture URL is complete and add cityTown
      const userData = {
        ...response.data,
        profilePicture: response.data.profilePicture
          ? `http://localhost:3002${response.data.profilePicture}`
          : null,
        cityTown: response.data.cityTown || ''
      };
      
      if (userId) {
        setSelectedProfile(userData);
      } else {
        setUserProfile(userData);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/');
      }
    }
  };

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ friends: Friend[], pendingRequests: PendingRequest[] }>('http://localhost:3002/api/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Raw friends data from server:', response.data);
      
      if (response.data && response.data.friends && Array.isArray(response.data.friends)) {
        setFriends(response.data.friends);
      } else {
        console.error('Unexpected response format:', response.data);
        setFriends([]);
      }

      if (response.data && response.data.pendingRequests && Array.isArray(response.data.pendingRequests)) {
        setPendingRequests(response.data.pendingRequests);
        if (response.data.pendingRequests.length > 0) {
          setNotificationsViewed(false);
        }
      } else {
        console.error('Unexpected pending requests format:', response.data);
        setPendingRequests([]);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
      setFriends([]);
      setPendingRequests([]);
    }
  };

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

      if (response.data.error === 'Friendship already exists or pending') {
        setRemoveMessage('Friend request already sent or pending.');
      } else {
        setRemoveMessage('Friend request sent successfully.');
        setSearchResults(prevResults => prevResults.filter(user => user.id !== friendId));
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
      setRemoveMessage('Failed to send friend request. Please try again.');
    }
  };

  const acceptFriendRequest = async (friendId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:3002/api/friends/accept', { friendId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Server response for accepting friend request:', response.data);

      setRemoveMessage('Friend request accepted successfully.');
      fetchFriends(); // Refresh the friends list and pending requests
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      setRemoveMessage('Failed to accept friend request. Please try again.');
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

  const checkPenaltyStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('http://localhost:3002/api/penalty/status', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.isPenalized) {
        setIsPenalized(true);
        setPenaltyEndTime(new Date(response.data.penaltyEndTime));
        setQueueStatus('idle');
        setGameState('idle');
        setIsGameInProgress(false);
      } else {
        setIsPenalized(false);
        setPenaltyEndTime(null);
      }
    } catch (error) {
      console.error('Error checking penalty status:', error);
    }
  };

  const fetchMatchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }
      console.log('Fetching match history...');
      const response = await axios.get<RecentGame[]>('http://localhost:3002/api/user/match-history', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 5 }
      });
      console.log('Fetched match history:', response.data);
      setMatchHistory(response.data);

      // Add a sample match to the match history
      const sampleMatch: RecentGame = {
        id: 'sample-match-id',
        mode: '5v5',
        blueScore: 3,
        redScore: 2,
        location: 'Sample Stadium',
        endTime: new Date().toISOString(),
        players: [
          { id: 'player1', name: 'John Doe' },
          { id: 'player2', name: 'Jane Smith' },
          { id: 'player3', name: 'Bob Johnson' },
          { id: 'player4', name: 'Alice Brown' },
          { id: 'player5', name: 'Charlie Davis' },
        ],
        distance: 5
      };

      setMatchHistory([sampleMatch, ...response.data]);
      setShouldRefreshMatchHistory(false);
    } catch (error) {
      console.error('Failed to fetch match history:', error);
    }
  };

  const handleBioChange = async (newBio: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:3002/api/user/bio', { bio: newBio }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedProfile(prev => prev ? { ...prev, bio: newBio } : null);
      
      // Update the userProfile state as well
      setUserProfile(prev => prev ? { ...prev, bio: newBio } : null);
    } catch (error) {
      console.error('Failed to update bio:', error);
      alert('Failed to update bio. Please try again.');
    }
  };

  const handleAddFriendFromProfile = async () => {
    if (selectedProfile) {
      await addFriend(selectedProfile.id);
    }
  };

  const handleProfilePictureChange = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const token = localStorage.getItem('token');
      const response = await axios.post<{ profilePicture: string }>('http://localhost:3002/api/user/profile-picture', formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      if (response.data.profilePicture) {
        const fullProfilePictureUrl = `http://localhost:3002${response.data.profilePicture}`;
        setUserProfile(prevProfile => prevProfile ? {
          ...prevProfile,
          profilePicture: fullProfilePictureUrl
        } : null);
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      alert('Failed to update profile picture. Please try again.');
    }
  };

  const handleLeaveGame = async (gameStartTime: Date | null) => {
    try {
      console.log('Sending leave game request with:', { lobbyTime, gameStartTime });
      const response = await axios.post('http://localhost:3002/api/game/leave', {
        lobbyTime,
        gameStartTime: gameStartTime?.toISOString()
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Leave game response:', response.data);
      
      // Reset all game-related states
      setInGame(false);
      setIsGameInProgress(false);
      setMatch(null);
      setQueueStatus('idle');
      setGameState('idle');
      setLobbyTime(0);
      localStorage.removeItem('gameState');

      if (response.data.penalized) {
        setIsPenalized(true);
        setPenaltyEndTime(new Date(response.data.penaltyEndTime));
        alert(`You have been penalized for leaving too many games. You cannot join games until ${new Date(response.data.penaltyEndTime).toLocaleString()}`);
      } else {
        setIsPenalized(false);
        setPenaltyEndTime(null);
      }
    } catch (error) {
      console.error('Detailed error in handleLeaveGame:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', error.response?.data);
      }
    } finally {
      // Always reset these states, even if there's an error
      setInGame(false);
      setIsGameInProgress(false);
      setMatch(null);
      setQueueStatus('idle');
      setGameState('idle');
      setLobbyTime(0);
      localStorage.removeItem('gameState');
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

  const filteredFriends = friends.filter(friend => 
    friend.name.toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  useEffect(() => {
    console.log('Friends state updated:', friends);
  }, [friends]);

  useEffect(() => {
    localStorage.setItem('friends', JSON.stringify(friends));
  }, [friends]);

  useEffect(() => {
    const storedFriends = localStorage.getItem('friends');
    if (storedFriends) {
      setFriends(JSON.parse(storedFriends));
    }
  }, []);

  useEffect(() => {
    if (removeMessage) {
      const timer = setTimeout(() => {
        setRemoveMessage(null);
      }, 5000); // Clear the message after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [removeMessage]);

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

    const initializeApp = async () => {
      await checkPenaltyStatus(); // Check penalty status immediately
      await fetchUserProfile();
      await fetchFriends();
    };

    initializeApp();

    const intervalId = setInterval(() => {
      checkPenaltyStatus();
      fetchUserProfile();
    }, 60000); // Refresh penalty status and profile every minute

    return () => clearInterval(intervalId);
  }, [router]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGameInProgress) {
      interval = setInterval(() => {
        setLobbyTime(prevTime => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameInProgress]);

  useEffect(() => {
    const fetchRecentGames = async () => {
      if (latitude && longitude) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get<RecentGame[]>('http://localhost:3002/api/games/recent', {
            headers: { Authorization: `Bearer ${token}` },
            params: { latitude, longitude }
          });
          setRecentGames(response.data);
        } catch (error) {
          console.error('Failed to fetch recent games:', error);
        }
      }
    };

    fetchRecentGames();
  }, [latitude, longitude]);

  useEffect(() => {
    fetchMatchHistory();
  }, [shouldRefreshMatchHistory]);

  useEffect(() => {
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
      const parsedGameState = JSON.parse(savedGameState);
      console.log('Initial load - Parsed game state:', parsedGameState);
      if (parsedGameState.gameState !== 'ended' && parsedGameState.match) {
        setIsGameInProgress(true);
        setGameMode(parsedGameState.mode);
        setMatch(parsedGameState.match);
        setLobbyTime(parsedGameState.lobbyTime);
        setQueueStatus('matched');
      } else {
        console.log('Clearing invalid game state');
        localStorage.removeItem('gameState');
      }
    } else {
      console.log('No saved game state found on initial load');
    }
  }, []);

  const handlePlayerClick = (playerId: string) => {
    fetchUserProfile(playerId);
  };

  // Render the GameScreen component if inGame is true
  if (inGame && match) {
    return (
      <GameScreen
        mode={gameMode}
        players={[...match.team1, ...match.team2].map(player => ({
          id: player.id,
          name: player.name,
          position: player.position,
          team: match.team1.some(t => t.id === player.id) ? 'blue' : 'red',
          profilePicture: player.profilePicture || null
        }))}
        currentUserId={userProfile?.id || ''}
        onBackToMain={handleBackFromGame}
        onLeaveGame={handleLeaveGame}
        lobbyTime={lobbyTime}
      />
    );
  }

  // Main return statement for the MainScreen component
  return (
    <div className="min-h-screen bg-white text-black relative overflow-hidden">
      {activeTab === 'home' && <div className={styles.backgroundText}></div>}
      <header className="relative z-20 flex justify-between items-center p-4 bg-green-500 text-white">
        <h1 className="text-2xl font-bold">Sports Queue</h1>
        <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-white border-white hover:bg-green-600" onClick={() => setInfoDialogOpen(true)}>Info</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] z-50">
            <DialogHeader>
              <DialogTitle>Welcome to Sports Queue!</DialogTitle>
              <DialogDescription>
                <p className="mb-2">The best way to find your individual skill level, and quickly find competitive games near you.</p>
                <h3 className="font-bold mt-4 mb-2">Rules:</h3>
                <p className="mb-2">Sports Queue is entirely player ran, so it costs no money. However, for games you will need a red or blue jersey/penny or clothes to easily tell teams apart!</p>
                <p className="mb-2">To make sure game scores are correctly reported, enter the correct game score after the game, after 30 minutes the game will be concluded, and the highest vote will be used.</p>
                <h3 className="font-bold mt-4 mb-2">Cheating/Unfair Play:</h3>
                <p className="mb-2">If you are reported by 3 or more players in a single game, or excessively reported over multiple, action will be taken. This can be for excessive fouling, breaking the rules of the game, or harassing a player. Any physical fights or purposely conspiring to report the wrong score will be met with a permanent ban.</p>
                <p className="mb-2">Try to limit the roughness, focus on your skills as well as positioning and having fun! People may want to play many games so please do your best to not injure anyone else.</p>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </header>

      <main className="relative z-10 p-4 pb-32 overflow-y-auto h-[calc(100vh-180px)]">
        {removeMessage && (
          <div className="mb-4 p-4 border border-green-500 bg-green-50 rounded-md">
            <h4 className="font-bold">Notification</h4>
            <p>{removeMessage}</p>
          </div>
        )}

        <Tabs defaultValue="home" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="recent">Recent Games</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="friends" className="relative">
              Friends
              {totalNotifications > 0 && !notificationsViewed && (
                <span className={styles.notificationBadge}>
                  {totalNotifications}
                </span>
              )}
            </TabsTrigger>
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
                <CardDescription>View and edit your profile information</CardDescription>
              </CardHeader>
              <CardContent>
                {userProfile && (
                  <>
                    <Tabs defaultValue="info" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="info">Info</TabsTrigger>
                        <TabsTrigger value="matchHistory">Match History</TabsTrigger>
                      </TabsList>
                      <TabsContent value="info">
                        <UserProfile
                          {...userProfile}
                          isCurrentUser={true}
                          onProfilePictureChange={handleProfilePictureChange}
                          onBioChange={handleBioChange}
                        />
                      </TabsContent>
                      <TabsContent value="matchHistory">
                        <MatchHistory matches={matchHistory} currentUserId={userProfile?.id || ''} onPlayerClick={handlePlayerClick} />
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Games Nearby</CardTitle>
                <CardDescription>Games played within 50 miles of your location</CardDescription>
              </CardHeader>
              <CardContent>
                {geoError ? (
                  <p>Error fetching location. Please enable location services to see nearby games.</p>
                ) : (
                  <ul className="space-y-4">
                    {recentGames.map((game) => (
                      <li key={game.id} className="border-b pb-4">
                        <p className="font-bold">{new Date(game.endTime).toLocaleString()} - {game.location}</p>
                        <p>Mode: {game.mode}</p>
                        <p>Score: {game.blueScore} - {game.redScore}</p>
                        <p>Distance: {game.distance} miles away</p>
                        <p>Players: {game.players.map(p => p.name).join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                )}
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
                      <span className="ml-auto">MRR: {2000 - (rank * 100)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="friends" className="h-[calc(100vh-260px)] overflow-y-auto">
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
                <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-400px)]">
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
                </div>

                {pendingRequests.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2">Pending Friend Requests:</h3>
                    <ul className="space-y-2">
                      {pendingRequests.map((request) => (
                        <li key={request.id} className="flex items-center space-x-2 border-b pb-2">
                          <InteractableProfilePicture
                            currentImage={request.profilePicture}
                            onImageChange={undefined}
                            onClick={() => fetchUserProfile(request.id)}
                          />
                          <span>{request.name}</span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="ml-auto"
                            onClick={() => acceptFriendRequest(request.id)}
                          >
                            Accept
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {!infoDialogOpen && (
        <div className="fixed bottom-8 left-0 right-0 flex flex-col items-center space-y-4 z-30">
          <Button 
            className="w-64 h-16 text-2xl bg-green-500 hover:bg-green-600 text-white border-2 border-black"
            onClick={toggleQueue}
            disabled={gameState === 'loading' || isPenalized || (!isGameInProgress && queueStatus === 'matched')}
          >
            {isGameInProgress ? 'Return to Game' :
             queueStatus === 'idle' ? 'Play' : 
             queueStatus === 'queuing' ? `Queuing${dots}` : 'Match Found!'}
          </Button>
          <Button 
            variant="outline" 
            className="text-sm"
            onClick={() => setGameMode(gameMode === '5v5' ? '11v11' : '5v5')}
            disabled={queueStatus !== 'idle' || gameState !== 'idle' || isGameInProgress || isPenalized}
          >
            Game Mode: {gameMode}
          </Button>
        </div>
      )}

      {selectedProfile && (
        <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{selectedProfile.name}'s Profile</DialogTitle>
            </DialogHeader>
            <UserProfile
              {...selectedProfile}
              onProfilePictureChange={undefined}
              onBioChange={handleBioChange}
            />
            <div className="flex justify-between mt-4">
              <Button onClick={() => setSelectedProfile(null)}>Close</Button>
              {!selectedProfile.isCurrentUser && (
                <Button onClick={handleAddFriendFromProfile}>Add Friend</Button>
              )}
            </div>
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
