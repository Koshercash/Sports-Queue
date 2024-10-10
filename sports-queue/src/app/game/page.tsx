'use client';

import React, { useEffect, useState, useContext, useRef } from 'react'
import axios from 'axios'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Check, AlertCircle, User } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { UserProfile } from '@/components/UserProfile'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Label } from "@/components/ui/label"
import { useGameState } from '@/components/GameStateProvider'  // Import useGameState
import { InteractableProfilePicture } from '../../components/InteractableProfilePicture';
import { API_BASE_URL } from '../../config/api';
import { UserContext } from '../../contexts/UserContext';

// If useGameState and API_BASE_URL are not available, you'll need to create these
// For now, let's create placeholder versions:

interface MatchPlayer {
  id: string;
  name: string;
  position: string;
  secondaryPosition: string;
  assignedPosition: 'primary' | 'secondary';
  team: 'blue' | 'red';
  profilePicture?: string | null;
}

interface Match {
  id: string;
  gameId: string;
  team1: MatchPlayer[];
  team2: MatchPlayer[];
  // Add any other properties that might be present in the match object
}

interface GameScreenProps {
  match: Match | null;
  gameMode: '5v5' | '11v11';
  onBackFromGame: (gameJustEnded?: boolean) => void;
  currentUserId: string;
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

interface FieldInfo {
  name: string;
  gpsLink: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
}

const ProfileImage = ({ src, alt, className = "" }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className={`relative w-full h-full rounded-full overflow-hidden bg-gray-200 ${className}`}>
        <img src="/default-avatar.jpg" alt={alt} className="absolute inset-0 w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full rounded-full overflow-hidden bg-gray-200 ${className}`}>
      <Image
        src={src}
        alt={alt}
        layout="fill"
        objectFit="cover"
        onError={() => {
          console.error('Error loading profile image:', src);
          setError(true);
        }}
      />
    </div>
  );
};

export default function GameScreen({ match: initialMatch, gameMode, onBackFromGame, currentUserId }: GameScreenProps) {
  const router = useRouter();
  const { gameState, setGameState } = useGameState();
  const { user, isLoading, initializeUser } = useContext(UserContext);
  const [match, setMatch] = useState<Match | null>(() => {
    if (initialMatch) {
      return {
        ...initialMatch,
        team1: Array.isArray(initialMatch.team1) ? initialMatch.team1 : [],
        team2: Array.isArray(initialMatch.team2) ? initialMatch.team2 : []
      };
    }
    return null;
  });
  const [showChat, setShowChat] = useState(false)
  const [showPlayerList, setShowPlayerList] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ sender: string; message: string; team: 'blue' | 'red' }[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<UserProfileData | null>(null);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false)
  const [leaveWarningMessage, setLeaveWarningMessage] = useState('')
  const [reportedPlayer, setReportedPlayer] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [lobbyTime, setLobbyTime] = useState(0);
  const [userPlayer, setUserPlayer] = useState<MatchPlayer | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [fieldInfo, setFieldInfo] = useState<FieldInfo | null>(null);
  const [isFieldInfoLoading, setIsFieldInfoLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const players = match ? [
    ...(Array.isArray(match.team1) ? match.team1 : []),
    ...(Array.isArray(match.team2) ? match.team2 : [])
  ] : [];

  const handleLeaveGame = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/game/leave`, {
        lobbyTime,
        gameStartTime: gameState.gameStartTime
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      onBackFromGame(true);
    } catch (error) {
      console.error('Error leaving game:', error);
      alert('Failed to leave game. Please try again.');
    }
  };

  const handleLeaveGameClick = () => {
    if (gameState.gameState === 'ended') {
      onBackFromGame(true);
      return;
    }

    const now = new Date();
    const timeDifference = gameState.gameStartTime ? (now.getTime() - gameState.gameStartTime.getTime()) / (1000 * 60) : 0;
    
    let warningMessage = '';
    if (lobbyTime >= 8 && timeDifference <= 20 && gameState.gameState !== 'ended') {
      warningMessage = 'Warning: Leaving the game now may result in a penalty.';
    }

    setLeaveWarningMessage(warningMessage);
    setShowLeavePrompt(true);
  };

  const handleConfirmLeave = async () => {
    setShowLeavePrompt(false);
    await handleLeaveGame();
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const currentPlayer = players.find(p => p.id === currentUserId);
      setChatMessages([...chatMessages, { 
        sender: currentPlayer?.name || 'You', 
        message: newMessage.trim(), 
        team: currentPlayer?.team || 'blue'
      }]);
      setNewMessage('');
    }
  };

  const handlePlayerClick = async (playerId: string) => {
    console.log('Player clicked:', playerId);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/user/${playerId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('Fetched user profile:', response.data);
      
      const processedProfile = {
        ...response.data,
        profilePicture: getProfilePictureUrl(response.data.profilePicture)
      };
      console.log('Processed profile:', processedProfile);
      
      setSelectedProfile(processedProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', error.response?.data);
      }
    }
  };

  const handleAddFriend = async () => {
    if (selectedProfile) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_BASE_URL}/api/friends/add`, 
          { friendId: selectedProfile.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Friend request sent successfully');
      } catch (error) {
        console.error('Failed to send friend request:', error);
        alert('Failed to send friend request. Please try again.');
      }
    }
  };

  const handleReportPlayer = (playerId: string) => {
    if (!gameId && (!match || !match.id)) {
      console.error('No game ID found when attempting to report player:', { gameId, match });
      alert('Unable to report player at this time. No active game found.');
      return;
    }
    setReportedPlayer(playerId);
    setReportReason(null);
  };

  const confirmReportPlayer = async () => {
    console.log('Confirming report with:', { reportedPlayer, reportReason, gameId, match });
    if (reportedPlayer && reportReason && match) {
      try {
        const token = localStorage.getItem('token');
        const actualGameId = match.id || match.gameId; // Use match.id as fallback
        console.log('Sending report with data:', { 
          reportedUserId: reportedPlayer, 
          gameId: actualGameId, 
          reason: reportReason 
        });
        const response = await axios.post(`${API_BASE_URL}/api/report`, 
          { 
            reportedUserId: reportedPlayer,
            gameId: actualGameId,
            reason: reportReason
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Report response:', response.data);
        alert('Player reported successfully');
        setReportedPlayer(null);
        setReportReason(null);
      } catch (error) {
        console.error('Failed to report player:', error);
        if (axios.isAxiosError(error)) {
          console.error('Error response:', error.response?.data);
          alert(`Failed to report player: ${error.response?.data?.error || 'Unknown error'}`);
        } else {
          alert('Failed to report player. Please try again.');
        }
      }
    } else {
      if (!reportedPlayer) {
        alert('No player selected for reporting.');
      } else if (!reportReason) {
        alert('Please select a reason for reporting.');
      } else if (!match || (!match.id && !match.gameId)) {
        console.error('No game ID found:', { match });
        alert('No active game ID found. Please try rejoining the game.');
      }
    }
  };

  const getProfilePictureUrl = (profilePicture: string | null | undefined): string => {
    console.log('getProfilePictureUrl called with:', profilePicture);
    
    if (!profilePicture) {
      console.log('No profile picture, using default');
      return '/default-avatar.jpg';
    }
    
    if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://')) {
      console.log('Full URL detected, returning as-is:', profilePicture);
      return profilePicture;
    }
    
    // Remove any leading slashes and 'uploads/'
    const cleanProfilePicture = profilePicture.replace(/^\/?(uploads\/)?/, '');
    const fullUrl = `${API_BASE_URL}/uploads/${cleanProfilePicture}`;
    console.log('Constructed full URL:', fullUrl);
    return fullUrl;
  };

  const positionOrder = ['goalkeeper', 'defender', 'midfielder', 'striker'];
  const sortedPlayers = players.sort((a, b) => 
    positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position)
  );

  const blueTeam = sortedPlayers.filter(p => p.team === 'blue');
  const redTeam = sortedPlayers.filter(p => p.team === 'red');

  // Function to get the field location (this is a placeholder, replace with actual logic)
  const getFieldLocation = () => {
    return {
      name: "Central Park Field 1",
      gpsLink: "https://goo.gl/maps/exampleLink",
      image: "/Soccer-Field-Placeholder.jpg",  // Use the default image from the field-images folder
    };
  };

  const fieldLocation = getFieldLocation();

  const handleReadyUp = () => {
    if (gameState.gameState === 'lobby') {
      const newReadyState = !gameState.isReady;
      setGameState((prevState: any) => ({
        ...prevState,
        isReady: newReadyState,
        readyCount: newReadyState ? prevState.readyCount + 1 : prevState.readyCount - 1,
        gameState: newReadyState ? 'inProgress' : 'lobby',
        totalGameTime: newReadyState ? 120 : 0,
        halfTimeOccurred: false,
      }));
    }
  };

  const handleReportScore = () => {
    if (gameState.gameState === 'reportScore') {
      setGameState((prevState: any) => ({
        ...prevState,
        gameState: 'ended',
      }));
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleGameEnd = async () => {
    // Update the game state to 'ended'
    setGameState((prevState: any) => ({
      ...prevState,
      gameState: 'ended',
    }));

    // Save the game result
    try {
      const token = localStorage.getItem('token');
      const gameResult = {
        mode: gameMode,
        blueScore: gameState.blueScore,
        redScore: gameState.redScore,
        players: players.map(p => p.id),
        endTime: new Date().toISOString(),
        location: fieldLocation.name,
      };

      const response = await axios.post(`${API_BASE_URL}/api/game/result`, gameResult, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Game result saved:', response.data);

      localStorage.setItem('gameState', JSON.stringify({
        ...JSON.parse(localStorage.getItem('gameState') || '{}'),
        gameEnded: true
      }));

      onBackFromGame(true); // Pass true to indicate a game just ended
    } catch (error) {
      console.error('Failed to save game result:', error);
      alert('Failed to save game result. The game has ended, but it may not appear in your recent games.');
      onBackFromGame(true);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      if (!user && !isLoading) {
        console.log('User not found, attempting to reinitialize...');
        await initializeUser();
      }
    };
    loadUser();
  }, [user, isLoading, initializeUser]);

  useEffect(() => {
    console.log('GameScreen mounted. Initial match:', initialMatch);
    console.log('Current user from context:', user);
    console.log('Current userId prop:', currentUserId);
    
    if (initialMatch) {
      console.log('Setting match from initialMatch:', initialMatch);
      setMatch(initialMatch);
    }

    // Load game state from localStorage on component mount
    const savedGameStateString = localStorage.getItem('gameState');
    if (savedGameStateString) {
      const savedGameState = JSON.parse(savedGameStateString);
      console.log('Loaded game state:', savedGameState);
      setGameState({
        ...savedGameState,
        gameState: savedGameState.gameState || 'lobby',
        lobbyTime: savedGameState.lobbyTime || 0,
        matchId: currentUserId, // Use the current user's ID as the match ID
      });
      setLobbyTime(savedGameState.lobbyTime || 0);
      if (savedGameState.match) {
        console.log('Setting match from saved state:', savedGameState.match);
        setMatch(savedGameState.match);
      }
    } else {
      console.log('No saved game state found, initializing new state');
      setGameState({
        gameState: 'lobby',
        totalGameTime: 0,
        gameTime: 0,
        reportScoreTime: 0,
        blueScore: 0,
        redScore: 0,
        halfTimeOccurred: false,
        isReady: false,
        readyCount: 0,
        gameStartTime: null,
        lobbyTime: 0,
        matchId: currentUserId, // Use the current user's ID as the match ID
      });
    }

    // Start the lobby timer
    const startTime = Date.now() - (savedGameStateString ? JSON.parse(savedGameStateString).lobbyTime || 0 : 0) * 1000;
    const timer = setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      setLobbyTime(elapsedTime);
      setGameState((prevState: any) => ({
        ...prevState,
        lobbyTime: elapsedTime
      }));
    }, 1000);

    // Clear the timer when the component unmounts
    return () => clearInterval(timer);
  }, [initialMatch, user, currentUserId]);

  useEffect(() => {
    if (match && user) {
      const allPlayers = [
        ...(Array.isArray(match.team1) ? match.team1 : []),
        ...(Array.isArray(match.team2) ? match.team2 : [])
      ];
      console.log('All players:', allPlayers);
      console.log('Current user:', user);
      let foundPlayer = allPlayers.find(p => p.id === (user.id || user._id || currentUserId));
      
      if (foundPlayer) {
        console.log('Found player in match:', foundPlayer);
        setUserPlayer(foundPlayer);
      } else {
        console.log('User not found in match. Returning to main screen.');
        alert('You are not part of this match. Returning to the main screen.');
        onBackFromGame(true);
      }
    }
  }, [match, user, currentUserId, onBackFromGame]);

  useEffect(() => {
    if (match && !match.id) {
      console.error('Match object does not have an id:', match);
    }
  }, [match]);

  useEffect(() => {
    if (initialMatch && (initialMatch.id || initialMatch.gameId)) {
      setGameId(initialMatch.id || initialMatch.gameId);
      console.log('Set gameId from initialMatch:', initialMatch.id || initialMatch.gameId);
    } else if (gameState && gameState.matchId) {
      setGameId(gameState.matchId);
      console.log('Set gameId from gameState:', gameState.matchId);
    } else {
      console.error('No game ID found in initialMatch or gameState');
    }
  }, [initialMatch, gameState]);

  useEffect(() => {
    const fetchFieldInfo = async () => {
      if (match && match.gameId) {
        try {
          setIsFieldInfoLoading(true);
          const token = localStorage.getItem('token');
          console.log('Fetching field info for game:', match.gameId);
          const response = await axios.get<FieldInfo>(`${API_BASE_URL}/api/field/${match.gameId}`, {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Field info received:', response.data);
          setFieldInfo(response.data);
        } catch (error) {
          console.error('Error fetching field info:', error);
          if (axios.isAxiosError(error)) {
            console.error('Axios error details:', error.response?.data);
          }
        } finally {
          setIsFieldInfoLoading(false);
        }
      } else {
        console.log('No game ID available to fetch field info');
      }
    };
  
    fetchFieldInfo();
  }, [match]);

  const handleBackClick = () => {
    console.log('Back button clicked');
    const currentGameState = {
      ...gameState,
      lobbyTime: lobbyTime,
      match: match,
      gameMode: gameMode,
      lastUpdated: Date.now()
    };
    localStorage.setItem('gameState', JSON.stringify(currentGameState));
    onBackFromGame();
  };

  useEffect(() => {
    let reconnectInterval: NodeJS.Timeout;

    const connectWebSocket = () => {
      if (user && user.id) {
        if (wsRef.current) {
          wsRef.current.close();
        }

        wsRef.current = new WebSocket(`ws://localhost:3002`);
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'auth', userId: user.id }));
          }
        };

        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          // Handle incoming messages
          console.log('Received message:', data);
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket connection closed. Reconnecting...');
          reconnectInterval = setTimeout(connectWebSocket, 5000);
        };
      }
    };

    if (!isLoading && user) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
      }
    };
  }, [user, isLoading]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !userPlayer) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-xl mb-4">Error: User not found or not part of this match. Please try logging in again.</p>
        <Button onClick={() => window.location.href = '/'}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black relative flex flex-col">
      <div className="absolute inset-0 flex">
        <div className="w-1/2 bg-blue-600 opacity-80"></div>
        <div className="w-1/2 bg-red-600 opacity-80"></div>
      </div>
      <div className="relative z-10 p-4 flex-grow">
        <div className="flex items-center">
          <Button 
            variant="outline"
            className="absolute top-4 left-4 bg-white text-green-500 border-green-500 hover:bg-green-50 h-10 px-3 text-sm flex items-center"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Back</span>
          </Button>
          <Button 
            variant="outline"
            className="absolute top-4 right-4 bg-white text-green-500 border-green-500 hover:bg-green-50 h-10 px-4"
            onClick={handleLeaveGameClick}
          >
            {gameState.gameState === 'ended' ? 'Return to Main' : 'Leave Game'}
          </Button>
        </div>
        <h1 className="text-5xl font-bold text-center mb-8 text-white">{gameMode}</h1>
        
        <div className="w-full h-[60vh] bg-green-800 relative mb-8 rounded-xl overflow-hidden border-4 border-white">
          {/* Simplified soccer field graphic */}
          <div className="absolute inset-0 flex">
            <div className="w-1/2 border-r-2 border-white"></div>
            <div className="w-1/2"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-2 border-white"></div>
          </div>
          {/* Goal lines */}
          <div className="absolute top-1/3 left-0 w-1 h-1/3 bg-white"></div>
          <div className="absolute top-1/3 right-0 w-1 h-1/3 bg-white"></div>
          
          <div className={`absolute ${userPlayer.team === 'blue' ? 'left-1/4' : 'right-1/4'} inset-y-0 transform ${userPlayer.team === 'blue' ? '-translate-x-1/2' : 'translate-x-1/2'} flex flex-col justify-between items-center py-4`}>
            <p className="text-4xl font-bold text-white mb-2">Position:</p>
            <div className={`w-48 h-48 rounded-full overflow-hidden border-4 ${userPlayer.team === 'blue' ? 'border-blue-500' : 'border-red-500'} shadow-lg relative`}>
              {userPlayer.profilePicture ? (
                <ProfileImage
                  src={getProfilePictureUrl(userPlayer.profilePicture)}
                  alt={userPlayer.name}
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <User className="text-gray-400" size={64} />
                </div>
              )}
            </div>
            <p className="text-4xl font-bold text-white">
              {userPlayer.position} ({userPlayer.assignedPosition === 'primary' ? 'Primary' : 'Secondary'})
            </p>
          </div>

          {/* Field location information */}
          <div className={`absolute ${userPlayer?.team === 'blue' ? 'right-1/4' : 'left-1/4'} inset-y-0 transform ${userPlayer?.team === 'blue' ? 'translate-x-1/2' : '-translate-x-1/2'} flex flex-col justify-between items-center py-4`}>
            {isFieldInfoLoading ? (
              <div className="text-center">
                <p className="text-2xl text-white">Loading field information...</p>
              </div>
            ) : fieldInfo ? (
              <div className="text-center">
                <p className="text-4xl font-bold text-white mb-2">Field Location:</p>
                <p className="text-3xl text-white">{fieldInfo.name}</p>
                <div className="w-56 h-56 relative mt-2">
                <Image
                  src={`${API_BASE_URL}${fieldInfo.imageUrl}`}
                  alt="Field Location"
                  layout="fill"
                  objectFit="cover"
                  className="rounded-lg"
                  onError={(e) => {
                    console.error(`Failed to load image: ${API_BASE_URL}${fieldInfo.imageUrl}`);
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // prevents looping
                    target.src = '/default-field-image.jpg'; // replace with a default image path
                  }}
                />
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-2xl text-white">Field information not available</p>
              </div>
            )}
          </div>

          {/* Game state display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {gameState.gameState === 'inProgress' && (
              <div className="text-8xl font-bold text-white">
                {formatTime(gameState.totalGameTime)}
              </div>
            )}
            {gameState.gameState === 'halftime' && (
              <div className="flex flex-col items-center">
                <div className="text-5xl font-bold text-white mb-4 absolute top-8">HALFTIME</div>
                <div className="text-8xl font-bold text-white">{formatTime(gameState.totalGameTime)}</div>
              </div>
            )}
            {gameState.gameState === 'reportScore' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-5xl font-bold text-white bg-black bg-opacity-50 p-8 rounded-xl flex flex-col items-center">
                  <div>Report Score</div>
                  <div className="mt-2 text-8xl">{formatTime(gameState.reportScoreTime)}</div>
                  <div className="flex justify-center items-center space-x-8 mt-4">
                    <Input 
                      type="number" 
                      value={gameState.blueScore} 
                      onChange={(e) => {
                        const value = Math.max(0, parseInt(e.target.value) || 0);
                        setGameState((prevState: any) => ({ ...prevState, blueScore: value }));
                      }}
                      min="0"
                      className="w-24 h-24 text-4xl text-center text-blue-500 bg-white"
                    />
                    <span className="text-white">-</span>
                    <Input 
                      type="number" 
                      value={gameState.redScore} 
                      onChange={(e) => {
                        const value = Math.max(0, parseInt(e.target.value) || 0);
                        setGameState((prevState: any) => ({ ...prevState, redScore: value }));
                      }}
                      min="0"
                      className="w-24 h-24 text-4xl text-center text-red-500 bg-white"
                    />
                  </div>
                  <Button 
                    onClick={handleReportScore}
                    className="mt-4 bg-green-500 text-white hover:bg-green-600"
                  >
                    Submit Score
                  </Button>
                </div>
              </div>
            )}
            {gameState.gameState === 'ended' && (
              <div className="text-5xl font-bold text-green-300 flex flex-col items-center bg-black bg-opacity-50 p-8 rounded-xl">
                <div className="mb-4">Game Result:</div>
                <div className="flex justify-center items-center space-x-8">
                  <span className="text-blue-500 text-9xl">{gameState.blueScore}</span>
                  <span className="text-white text-7xl">-</span>
                  <span className="text-red-500 text-9xl">{gameState.redScore}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GPS Link outside of the field graphic */}
        {fieldInfo && (
          <div className={`absolute ${userPlayer?.team === 'blue' ? 'right-1/4' : 'left-1/4'} transform ${userPlayer?.team === 'blue' ? 'translate-x-1/2' : '-translate-x-1/2'} text-center`} style={{ top: 'calc(60vh + 1rem)' }}>
            <a 
              href={`https://www.mapbox.com/maps/streets/?q=${fieldInfo.latitude},${fieldInfo.longitude}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-2xl text-blue-500 underline hover:text-blue-700"
            >
              View on Mapbox
            </a>
          </div>
        )}

        <div className="flex items-center justify-center mb-8">
          {gameState.gameState === 'lobby' ? (
            <div className="flex items-center space-x-4">
              <Button 
                className={`text-white text-3xl font-bold px-12 py-6 rounded-xl shadow-lg transform transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300 ${
                  gameState.isReady ? 'bg-red-500 hover:bg-red-600 active:bg-red-700' : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
                }`}
                onClick={handleReadyUp}
              >
                {gameState.isReady ? 'CANCEL' : 'READY UP'}
              </Button>
              {gameState.isReady && (
                <Check className="text-green-500 w-16 h-16" />
              )}
            </div>
          ) : (
            <Button 
              className="bg-gray-400 text-white text-3xl font-bold px-12 py-6 rounded-xl cursor-not-allowed" 
              disabled
            >
              GAME IN PROGRESS
            </Button>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="font-semibold text-blue-200 text-xl">Blue Team</p>
          <p className="font-semibold text-red-200 text-xl">Red Team</p>
        </div>

        <div className="flex justify-between items-center mb-4 bg-white bg-opacity-80 p-2 rounded">
          <p className="font-medium">Current Time: {new Date().toLocaleTimeString()}</p>
          <p className="font-medium">Game Start Time: {gameState.gameStartTime?.toLocaleTimeString()}</p>
          <p className="font-medium">Lobby Time: {lobbyTime} seconds</p>
        </div>

        <div className="flex space-x-4 mt-4">
          <Button 
            className="flex-1 bg-green-500 text-white hover:bg-green-600" 
            onClick={() => setShowChat(!showChat)}
          >
            {showChat ? 'Close Chat' : 'Open Chat'}
          </Button>
          <Button 
            className="flex-1 bg-green-500 text-white hover:bg-green-600" 
            onClick={() => setShowPlayerList(!showPlayerList)}
          >
            {showPlayerList ? 'Close Player List' : 'Open Player List'}
          </Button>
        </div>
      </div>

      {/* Chat and Player List container */}
      <div className="relative z-20 mt-4">
        <div className="flex space-x-4 p-4">
          {showChat && (
            <div className={`bg-white rounded-lg shadow-lg ${showPlayerList ? 'w-1/2' : 'w-full'}`}>
              <div className="h-64 flex flex-col p-4">
                <ScrollArea className="flex-grow mb-4">
                  <div className="space-y-2">
                    {chatMessages.map((msg: { sender: string; message: string; team: 'blue' | 'red' }, index: number) => (
                      <p key={index}>
                        <strong className={msg.team === 'blue' ? 'text-blue-600' : 'text-red-600'}>
                          {msg.sender}:
                        </strong> {msg.message}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex space-x-2">
                  <Input 
                    placeholder="Type a message..." 
                    className="flex-grow" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button 
                    className="bg-green-500 text-white hover:bg-green-600"
                    onClick={handleSendMessage}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showPlayerList && (
            <div className={`bg-white rounded-lg shadow-lg ${showChat ? 'w-1/2' : 'w-full'}`}>
              <div className="h-64 p-4">
                <div className="flex h-full">
                  <div className="w-1/2 pr-2">
                    <h4 className="font-semibold text-blue-600 mb-2">Blue Team</h4>
                    <ScrollArea className="h-[calc(100%-2rem)]">
                      <ul className="space-y-2">
                        {match && Array.isArray(match.team1) && match.team1.map((player, index) => (
                          <li 
                            key={`blue-${player.id}-${index}`} 
                            className="flex items-center space-x-2 cursor-pointer" 
                            onClick={() => handlePlayerClick(player.id)}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                              {player.profilePicture ? (
                                <ProfileImage
                                  src={getProfilePictureUrl(player.profilePicture)}
                                  alt={player.name}
                                />
                              ) : (
                                <User className="text-gray-400" size={24} />
                              )}
                            </div>
                            <span className="text-blue-600">{player.name}</span>
                            <span className="text-sm text-gray-500">
                              ({player.position})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                  <div className="w-1/2 pl-2 border-l">
                    <h4 className="font-semibold text-red-600 mb-2">Red Team</h4>
                    <ScrollArea className="h-[calc(100%-2rem)]">
                      <ul className="space-y-2">
                        {match && Array.isArray(match.team2) && match.team2.map((player, index) => (
                          <li 
                            key={`red-${player.id}-${index}`} 
                            className="flex items-center space-x-2 cursor-pointer" 
                            onClick={() => handlePlayerClick(player.id)}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                              {player.profilePicture ? (
                                <ProfileImage
                                  src={getProfilePictureUrl(player.profilePicture)}
                                  alt={player.name}
                                />
                              ) : (
                                <User className="text-gray-400" size={24} />
                              )}
                            </div>
                            <span className="text-red-600">{player.name}</span>
                            <span className="text-sm text-gray-500">
                              ({player.position})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedProfile && (
        <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{selectedProfile.name}'s Profile</DialogTitle>
            </DialogHeader>
            <UserProfile
              {...selectedProfile}
              onProfilePictureChange={undefined}
              onBioChange={undefined}
              isEditable={false}
              cityTown={selectedProfile.cityTown}
              secondaryPosition={selectedProfile.secondaryPosition || ''}
              profilePicture={selectedProfile.profilePicture || '/default-avatar.jpg'}
            />
            <div className="flex justify-between mt-4">
              <Button onClick={() => setSelectedProfile(null)}>Close</Button>
              {!selectedProfile.isCurrentUser && (
                <Button onClick={handleAddFriend}>Add Friend</Button>
              )}
              {!selectedProfile.isCurrentUser && gameState.gameState !== 'ended' && (
                <Button 
                  onClick={() => handleReportPlayer(selectedProfile.id)}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Report Player
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Leave Game Prompt */}
      <Dialog open={showLeavePrompt} onOpenChange={setShowLeavePrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure you want to leave the game?</DialogTitle>
            {leaveWarningMessage && (
              <div className="text-yellow-500">
                <DialogDescription>{leaveWarningMessage}</DialogDescription>
              </div>
            )}
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowLeavePrompt(false)}>Cancel</Button>
            <Button onClick={handleConfirmLeave}>Leave Game</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add this new Dialog for confirming player reports */}
      <Dialog open={!!reportedPlayer} onOpenChange={() => setReportedPlayer(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Report Player</DialogTitle>
            <DialogDescription>
              Please select the primary reason for reporting this player. Choose the most significant issue. False reports may result in penalties.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { value: "excessive_fouling", label: "Excessive Fouling" },
              { value: "cheating", label: "Cheating" },
              { value: "verbal_abuse", label: "Verbal Abuse/Harassment" },
              { value: "no_show", label: "No Show/Leaving" },
              { value: "physical_fighting", label: "Physical Fighting" },
              { value: "false_score", label: "False Score Reporting" }
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={option.value}
                  name="reportReason"
                  value={option.value}
                  checked={reportReason === option.value}
                  onChange={() => setReportReason(option.value)}
                  className="form-radio h-4 w-4 text-green-600"
                />
                <Label htmlFor={option.value}>{option.label}</Label>
              </div>
            ))}
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => {
              setReportedPlayer(null);
              setReportReason(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={confirmReportPlayer} 
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={!reportReason}
            >
              Confirm Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}