'use client';

import React, { useState, useEffect, useContext, useCallback } from 'react';
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
import { API_BASE_URL } from '../../config/api';
import { UserContext } from '../../contexts/UserContext';
import AdminDashboard from '@/components/AdminDashboard';
import { jwtDecode } from "jwt-decode";
import { LeaderboardPlayer } from '@/types/leaderboard';
import { GameStateProvider } from '@/components/GameStateProvider';

interface UserProfile {
  id: string;
  name: string;
  sex: string;
  position: string;
  secondaryPosition: string;
  skillLevel: string;
  dateOfBirth: string;
  profilePicture: string | null;
  mmr5v5: number;
  mmr11v11: number;
  bio: string;
  cityTown: string;
}

interface Friend {
  id: string;
  name: string;
  profilePicture: string | null;
}

interface MatchPlayer {
  userId: string;
  name: string;
  position: string;
  secondaryPosition: string;
  assignedPosition: 'primary' | 'secondary';
  team: 'blue' | 'red';
  profilePicture?: string | null;
}

interface Match {
  id: string;
  team1: MatchPlayer[];
  team2: MatchPlayer[];
}

interface UserProfileData {
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
  cityTown: string;
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
  players: { id: string; name: string; profilePicture?: string }[];
  mmrChange: number;
  averageMMR: number;
}

interface Player {
  id: string;
  name: string;
  position: string;
  secondaryPosition: string;
  team: 'blue' | 'red';
  profilePicture?: string | null;
}

export default function MainScreen() {
  const { user, isLoading } = useContext(UserContext);
  const router = useRouter();
  const { latitude, longitude, error: geoError } = useGeolocation();

  const [gameMode, setGameMode] = useState<'5v5' | '11v11'>('5v5');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
  const [matchHistory, setMatchHistory] = useState<RecentGame[]>([]);
  const [shouldRefreshMatchHistory, setShouldRefreshMatchHistory] = useState(false);

  const [leaderboardPlayers, setLeaderboardPlayers] = useState<LeaderboardPlayer[]>([]);
  const [leaderboardMode, setLeaderboardMode] = useState<'5v5' | '11v11'>('5v5');
  const [leaderboardGender, setLeaderboardGender] = useState<'male' | 'female'>('male');
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const playersPerPage = 50;
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

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
      clearGameState();
    } else {
      const savedGameState = localStorage.getItem('gameState');
      if (savedGameState) {
        const parsedGameState = JSON.parse(savedGameState);
        setInGame(false);
        setIsGameInProgress(true);
        setMatch(parsedGameState.match);
        setGameMode(parsedGameState.mode);
        setLobbyTime(parsedGameState.lobbyTime || 0);
        setQueueStatus('matched');
        setGameState('inGame');
      }
    }
  };

  const handleReturnToGame = () => {
    console.log('Handling return to game');
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
      const parsedGameState = JSON.parse(savedGameState);
      console.log('Parsed game state:', parsedGameState);
      if (parsedGameState.match) {
        setInGame(true);
        setGameState('inGame');
        setMatch(parsedGameState.match);
        setGameMode(parsedGameState.mode);
        setIsGameInProgress(true);
        setLobbyTime(parsedGameState.lobbyTime || 0);
        setQueueStatus('matched');
        console.log('Game state updated for return to game');
      } else {
        console.log('No valid game to return to');
        clearGameState();
      }
    } else {
      console.log('No saved game state found');
      clearGameState();
    }
  };

  const clearGameState = () => {
    localStorage.removeItem('gameState');
    setQueueStatus('idle');
    setMatch(null);
    setGameState('idle');
    setIsGameInProgress(false);
    setLobbyTime(0);
    setInGame(false);
  };

  const toggleQueue = async () => {
    console.log('Toggle Queue called. Current state:', { queueStatus, isGameInProgress, gameState });
    
    // Clear existing game state
    clearGameState(); // Use clearGameState function to reset state
    
    await checkPenaltyStatus();
    
    if (isPenalized) {
      alert(`You are currently penalized and cannot join games until ${penaltyEndTime?.toLocaleString()}`);
      return;
    }
    
    if (queueStatus === 'idle') {
      try {
        const token = localStorage.getItem('token');
        console.log('Attempting to join queue with token:', token ? 'Token exists' : 'No token');
        const response = await axios.post(`${API_BASE_URL}/api/queue/join`, 
          { gameMode },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Queue join response:', response.data);
        if (response.data.match) {
          console.log('Match found:', response.data.match);
          setQueueStatus('matched');
          setMatch(response.data.match);
          setGameState('loading');
          setIsGameInProgress(true);
          
          const gameStateToSave = {
            gameState: 'lobby',
            match: response.data.match,
            mode: gameMode,
            lobbyTime: 0,
            gameEnded: false,
            savedAt: new Date().toISOString(),
            matchId: response.data.match.id
          };
          console.log('Saving game state:', gameStateToSave);
          localStorage.setItem('gameState', JSON.stringify(gameStateToSave));
          
          setTimeout(() => {
            console.log('Setting game state to inGame');
            setGameState('inGame');
            setInGame(true);
            setLobbyTime(0);
          }, 3000);
        } else {
          setQueueStatus('queuing');
        }
      } catch (error) {
        console.error('Detailed error in joining queue:', error);
        if (axios.isAxiosError(error)) {
          console.error('Axios error details:', error.response?.data);
          alert(`Failed to join queue: ${error.response?.data?.error || 'Unknown error'}. Please try again.`);
        } else {
          alert('An unexpected error occurred. Please try again.');
        }
        setQueueStatus('idle');
      }
    } else if (queueStatus === 'queuing') {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_BASE_URL}/api/queue/leave`, 
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
        ? `${API_BASE_URL}/api/user/${userId}`
        : `${API_BASE_URL}/api/user-profile`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const userData = {
        ...response.data,
        profilePicture: response.data.profilePicture
          ? `${API_BASE_URL}${response.data.profilePicture}`
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
      const response = await axios.get<{ friends: Friend[], pendingRequests: PendingRequest[] }>(`${API_BASE_URL}/api/friends`, {
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
      const response = await axios.get(`${API_BASE_URL}/api/users/search?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formattedResults = response.data
        .map((user: UserProfile) => ({
          ...user,
          profilePicture: user.profilePicture 
            ? user.profilePicture.startsWith('http')
              ? user.profilePicture
              : `${API_BASE_URL}${user.profilePicture}`
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
      const response = await axios.post(`${API_BASE_URL}/api/friends/add`, { friendId }, {
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
      const response = await axios.post(`${API_BASE_URL}/api/friends/accept`, { friendId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Server response for accepting friend request:', response.data);

      setRemoveMessage('Friend request accepted successfully.');
      fetchFriends();
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
      const response = await axios.delete(`${API_BASE_URL}/api/friends/${friendToRemove.id}`, {
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

      const response = await axios.get(`${API_BASE_URL}/api/penalty/status`, {
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
      const response = await axios.get<RecentGame[]>(`${API_BASE_URL}/api/user/match-history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 5 }
      });
      console.log('Fetched match history:', response.data);
      setMatchHistory(response.data);

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
        distance: 5,
        mmrChange: 10,
        averageMMR: 1500
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
      await axios.put(`${API_BASE_URL}/api/user/bio`, { bio: newBio }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedProfile(prev => prev ? { ...prev, bio: newBio } : null);
      
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
      const response = await axios.post<{ profilePicture: string }>(`${API_BASE_URL}/api/user/profile-picture`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      if (response.data.profilePicture) {
        const fullProfilePictureUrl = `${API_BASE_URL}${response.data.profilePicture}`;
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
      const response = await axios.post(`${API_BASE_URL}/api/game/leave`, {
        lobbyTime,
        gameStartTime: gameStartTime?.toISOString()
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Leave game response:', response.data);
      
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
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [removeMessage]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (queueStatus === 'queuing') {
      interval = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
      }, 750);
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
      await checkPenaltyStatus();
      await fetchUserProfile();
      await fetchFriends();
    };

    initializeApp();

    const intervalId = setInterval(() => {
      checkPenaltyStatus();
      fetchUserProfile();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGameInProgress && !inGame) {
      const savedGameState = localStorage.getItem('gameState');
      if (savedGameState) {
        const parsedGameState = JSON.parse(savedGameState);
        const elapsedTime = Math.floor((Date.now() - parsedGameState.lastUpdated) / 1000);
        setLobbyTime(parsedGameState.lobbyTime + elapsedTime);
      }

      timer = setInterval(() => {
        setLobbyTime(prevTime => {
          const newTime = prevTime + 1;
          const updatedGameState = JSON.parse(localStorage.getItem('gameState') || '{}');
          updatedGameState.lobbyTime = newTime;
          updatedGameState.lastUpdated = Date.now();
          localStorage.setItem('gameState', JSON.stringify(updatedGameState));
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isGameInProgress, inGame]);

  useEffect(() => {
    const fetchRecentGames = async () => {
      if (latitude && longitude) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get<RecentGame[]>(`${API_BASE_URL}/api/games/recent`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { latitude, longitude }
          });
          
          const nearbyGames = response.data.filter(game => game.distance <= 50);

          const allGames = [...nearbyGames, ...matchHistory];
          const uniqueGames = allGames.filter((game, index, self) =>
            index === self.findIndex((t) => t.id === game.id)
          );
          
          uniqueGames.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
          
          setRecentGames(uniqueGames);
        } catch (error) {
          console.error('Failed to fetch recent games:', error);
        }
      }
    };

    fetchRecentGames();
  }, [latitude, longitude, matchHistory]);

  useEffect(() => {
    fetchMatchHistory();
  }, [shouldRefreshMatchHistory]);

  useEffect(() => {
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
      const parsedGameState = JSON.parse(savedGameState);
      console.log('Initial load - Parsed game state:', parsedGameState);
      
      // Check if the saved state is less than 2 hours old
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const savedTime = new Date(parsedGameState.savedAt || 0);
      
      if (parsedGameState.gameState === 'inGame' && parsedGameState.match && savedTime > twoHoursAgo) {
        setIsGameInProgress(true);
        setGameMode(parsedGameState.mode);
        setMatch(parsedGameState.match);
        setLobbyTime(parsedGameState.lobbyTime);
        setQueueStatus('matched');
        setGameState('inGame');
        setInGame(true);
      } else {
        console.log('Clearing invalid or old game state');
        clearGameState();
      }
    } else {
      console.log('No saved game state found on initial load');
      clearGameState();
    }
  }, []);

  const handlePlayerClick = (playerId: string) => {
    fetchUserProfile(playerId);
  };

  const fetchLeaderboard = useCallback(async (page = 1) => {
    try {
      setIsLoadingMore(true);
      const token = localStorage.getItem('token');
      const response = await axios.get<{ players: LeaderboardPlayer[], totalPlayers: number }>(`${API_BASE_URL}/api/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          mode: leaderboardMode, 
          gender: leaderboardGender,
          page: page,
          limit: playersPerPage,
          search: leaderboardSearch
        }
      });
      const playersWithFullUrls = response.data.players.map(player => ({
        ...player,
        profilePicture: player.profilePicture 
          ? `${API_BASE_URL}${player.profilePicture}`
          : null
      }));
      if (page === 1) {
        setLeaderboardPlayers(playersWithFullUrls);
      } else {
        setLeaderboardPlayers(prev => [...prev, ...playersWithFullUrls]);
      }
      setLeaderboardPage(page);
      setIsLoadingMore(false);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setIsLoadingMore(false);
    }
  }, [leaderboardMode, leaderboardGender, leaderboardSearch]);

  const handleLoadMore = () => {
    fetchLeaderboard(leaderboardPage + 1);
  };

  useEffect(() => {
    console.log('Current user in UserContext:', user);
  }, [user]);
  
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard(1);
    }
  }, [activeTab, fetchLeaderboard]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decodedToken = jwtDecode(token) as { isAdmin?: boolean };
        setIsAdmin(decodedToken.isAdmin || false);
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
  }, []);

  return (
    <GameStateProvider>
      <div className="min-h-screen bg-white text-black relative overflow-hidden">
        {inGame ? (
          <GameScreen
            match={match}
            gameMode={gameMode}
            onBackFromGame={handleBackFromGame}
            currentUserId={user?.userId || ''}
          />
        ) : (
          <>
            <header className="relative z-20 flex justify-between items-center p-4 bg-green-500 text-white">
              <h1 className="text-2xl font-bold">Sports Queue</h1>
              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    className="text-white border-white hover:bg-green-600"
                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                  >
                    Admin
                  </Button>
                )}
                <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-white border-white hover:bg-green-600" onClick={() => setInfoDialogOpen(true)}>Info</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
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
              </div>
            </header>

            <main className="relative z-10 p-4 pb-32 overflow-y-auto h-[calc(100vh-180px)]">
              {showAdminPanel && isAdmin && <AdminDashboard />}
              
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
                        <div className="space-y-4">
                          {recentGames.map((game) => (
                            <Card key={game.id} className="overflow-hidden">
                              <CardHeader className="bg-gray-100 py-2 px-3">
                                <CardTitle className="flex justify-between items-center">
                                  <span className="text-base w-1/3">{new Date(game.endTime).toLocaleString()}</span>
                                  <span className="text-lg font-bold w-1/3 text-center -ml-3">{game.mode}</span>
                                  <span className="text-sm font-semibold text-gray-600 w-1/3 text-right">
                                    Avg MMR: {game.averageMMR}
                                  </span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                <p className="text-base mb-1 text-center font-semibold">{game.location}</p>
                                <p className="text-sm mb-2 text-center text-gray-600">
                                  {game.distance.toFixed(1)} miles away
                                </p>
                                <div className="flex justify-center items-center mb-4">
                                  <span className="text-5xl font-bold text-blue-600 mr-4">{game.blueScore}</span>
                                  <span className="text-3xl font-bold">-</span>
                                  <span className="text-5xl font-bold text-red-600 ml-4">{game.redScore}</span>
                                </div>
                                <div>
                                  <p className="text-base font-semibold mb-2">Players:</p>
                                  <div className="flex flex-wrap gap-3 justify-center">
                                    {game.players.map(player => (
                                      <div key={player.id} className="flex flex-col items-center">
                                        <div className="rounded-full overflow-hidden w-10 h-10">
                                          <InteractableProfilePicture
                                            currentImage={player.profilePicture || ''}
                                            onClick={() => handlePlayerClick(player.id)}
                                            size="small"
                                          />
                                        </div>
                                        <span className="text-sm mt-1">{player.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="leaderboard">
                  <div className="pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex space-x-2">
                        <Tabs defaultValue="5v5" onValueChange={(value) => setLeaderboardMode(value as '5v5' | '11v11')}>
                          <TabsList className="h-8">
                            <TabsTrigger value="5v5" className="px-2 py-1 text-sm">5v5</TabsTrigger>
                            <TabsTrigger value="11v11" className="px-2 py-1 text-sm">11v11</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <Tabs defaultValue="male" onValueChange={(value) => setLeaderboardGender(value as 'male' | 'female')}>
                          <TabsList className="h-8">
                            <TabsTrigger value="male" className="px-2 py-1 text-sm">Male</TabsTrigger>
                            <TabsTrigger value="female" className="px-2 py-1 text-sm">Female</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <Input
                        type="text"
                        placeholder="Search player"
                        className="w-48"
                        value={leaderboardSearch}
                        onChange={(e) => setLeaderboardSearch(e.target.value)}
                      />
                    </div>
                    <div className="mt-4">
                      <h3 className="text-lg font-semibold mb-2">
                        Top {leaderboardGender === 'male' ? 'Male' : 'Female'} Players ({leaderboardMode})
                      </h3>
                      <div className="flex space-x-4">
                        <div className="w-1/2 space-y-2">
                          {leaderboardPlayers
                            .filter(player => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()))
                            .slice(0, Math.ceil(leaderboardPlayers.length / 2))
                            .map((player) => (
                              <div key={player.id} className="flex items-center justify-between bg-white p-2 rounded-lg shadow">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-semibold w-6 text-right">#{player.rank}</span>
                                  <div className="rounded-full overflow-hidden w-8 h-8">
                                    <InteractableProfilePicture
                                      currentImage={player.profilePicture}
                                      onClick={() => handlePlayerClick(player.id)}
                                      size="small"
                                    />
                                  </div>
                                  <span className="text-sm font-semibold">{player.name}</span>
                                </div>
                                <span className="text-sm font-bold text-green-600">MMR: {player.mmr}</span>
                              </div>
                            ))}
                        </div>
                        <div className="w-1/2 space-y-2">
                          {leaderboardPlayers
                            .filter(player => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()))
                            .slice(Math.ceil(leaderboardPlayers.length / 2))
                            .map((player) => (
                              <div key={player.id} className="flex items-center justify-between bg-white p-2 rounded-lg shadow">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-semibold w-6 text-right">#{player.rank}</span>
                                  <div className="rounded-full overflow-hidden w-8 h-8">
                                    <InteractableProfilePicture
                                      currentImage={player.profilePicture}
                                      onClick={() => handlePlayerClick(player.id)}
                                      size="small"
                                    />
                                  </div>
                                  <span className="text-sm font-semibold">{player.name}</span>
                                </div>
                                <span className="text-sm font-bold text-green-600">MMR: {player.mmr}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      {leaderboardPlayers.length < 1000 && !isLoadingMore && (
                        <Button 
                          onClick={handleLoadMore} 
                          className="w-full mt-4"
                          disabled={isLoadingMore}
                        >
                          Load More
                        </Button>
                      )}
                      {isLoadingMore && (
                        <p className="text-center mt-4">Loading more players...</p>
                      )}
                    </div>
                  </div>
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
                  onClick={isGameInProgress ? handleReturnToGame : toggleQueue}
                  disabled={gameState === 'loading' || isPenalized}
                >
                  {isGameInProgress ? 'Return to Game' :
                   queueStatus === 'idle' ? 'Play' : 
                   queueStatus === 'queuing' ? `Queuing${dots}` : 'Enter Game'}
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
                    mmr11v11={selectedProfile.mmr11v11 || 0}
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
          </>
        )}
      </div>
    </GameStateProvider>
  )
}

