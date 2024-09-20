'use client';

import React, { useEffect, useState, useContext } from 'react'
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
  userId: string;
  name: string;
  position: string;
  team: 'blue' | 'red';
  profilePicture?: string | null;
}

interface Match {
  id: string;
  team1: MatchPlayer[];
  team2: MatchPlayer[];
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
  dateOfBirth: string;
  profilePicture: string | null;
  isCurrentUser: boolean;
  mmr5v5: number;
  mmr11v11: number;
  bio: string;
  cityTown: string;
}

export default function GameScreen({ match: initialMatch, gameMode, onBackFromGame, currentUserId }: GameScreenProps) {
  const router = useRouter();
  const { gameState, setGameState } = useGameState();
  const { user, isLoading, initializeUser } = useContext(UserContext);
  const [match, setMatch] = useState<Match | null>(initialMatch);
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

  const players = match ? [...match.team1, ...match.team2] : [];

  const onLeaveGame = async (gameStartTime: Date | null) => {
    console.log('Leaving game', gameStartTime);
    // Implement the leave game logic here
    // For now, we'll just call onBackFromGame
    onBackFromGame(true);
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
    console.log('Current match state:', match);
  }, [match]);

  useEffect(() => {
    if (match && user) {
      const allPlayers = [...match.team1, ...match.team2];
      console.log('All players:', allPlayers);
      console.log('User ID to match:', user.id || user.userId);
      let foundPlayer = allPlayers.find(p => p.userId === (user.id || user.userId));
      
      // If the user is not found in the match, assign them to a random position
      if (!foundPlayer) {
        console.log('User not found in match. Assigning random position.');
        const randomTeam = Math.random() < 0.5 ? 'blue' : 'red';
        const randomPosition = ['goalkeeper', 'defender', 'midfielder', 'striker'][Math.floor(Math.random() * 4)];
        foundPlayer = {
          userId: user.id || user.userId,
          name: user.name,
          position: randomPosition,
          team: randomTeam,
          profilePicture: user.profilePicture
        };
      }
      
      console.log('Found or assigned user player:', foundPlayer);
      setUserPlayer(foundPlayer);
    }
  }, [match, user]);

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
    await onLeaveGame(gameState.gameStartTime);
    // Clear local game state
    localStorage.removeItem('gameState');
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
    });
    onBackFromGame(true); // Pass true to indicate we're leaving the game
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const currentPlayer = players.find(p => p.userId === currentUserId);
      setChatMessages([...chatMessages, { 
        sender: currentPlayer?.name || 'You', 
        message: newMessage.trim(), 
        team: currentPlayer?.team || 'blue'
      }]);
      setNewMessage('');
    }
  };

  const handlePlayerClick = async (player: MatchPlayer) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? 'exists' : 'not found');
      console.log('Fetching profile for player:', player.userId);
      const response = await axios.get<UserProfileData>(`${API_BASE_URL}/api/user/${player.userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Profile data received:', response.data);
      const profileData = {
        ...response.data,
        profilePicture: response.data.profilePicture
          ? response.data.profilePicture.startsWith('http')
            ? response.data.profilePicture
            : `${API_BASE_URL}${response.data.profilePicture}`
          : null,
        cityTown: response.data.cityTown || ''
      };
      setSelectedProfile(profileData);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      if (axios.isAxiosError(error)) {
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
      }
      alert('Failed to load user profile. Please try again.');
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
    setReportedPlayer(playerId);
    setReportReason(null);
  };

  const confirmReportPlayer = async () => {
    if (reportedPlayer && reportReason) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_BASE_URL}/api/report-player`, 
          { 
            reportedPlayerId: reportedPlayer,
            reason: reportReason
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Player reported successfully');
      } catch (error) {
        console.error('Failed to report player:', error);
        alert('Failed to report player. Please try again.');
      }
      setReportedPlayer(null);
      setReportReason(null);
    } else {
      alert('Please select a reason for reporting.');
    }
  };

  const getPlayerImage = (player: MatchPlayer) => {
    if (player.profilePicture) {
      return player.profilePicture.startsWith('http')
        ? player.profilePicture
        : `${API_BASE_URL}${player.profilePicture}`;
    }
    return '/default-avatar.jpg'; // Return a default avatar image path
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
        players: players.map(p => p.userId),
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div>
        <p>Error: User not found. Please try logging in again.</p>
        <button onClick={() => window.location.href = '/'}>Go to Login</button>
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
          
          {userPlayer && (
            <div className={`absolute ${userPlayer.team === 'blue' ? 'left-1/4' : 'right-1/4'} inset-y-0 transform ${userPlayer.team === 'blue' ? '-translate-x-1/2' : 'translate-x-1/2'} flex flex-col justify-between items-center py-4`}>
              <p className="text-4xl font-bold text-white mb-2">Position:</p>
              <div className={`w-48 h-48 rounded-full overflow-hidden border-4 ${userPlayer.team === 'blue' ? 'border-blue-500' : 'border-red-500'} shadow-lg relative`}>
                {userPlayer.profilePicture ? (
                  <Image
                    src={userPlayer.profilePicture}
                    alt={userPlayer.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <User className="text-gray-400" size={64} />
                  </div>
                )}
              </div>
              <p className="text-4xl font-bold text-white">{userPlayer.position}</p>
            </div>
          )}

          {/* Field location information */}
          <div className={`absolute ${userPlayer?.team === 'blue' ? 'right-1/4' : 'left-1/4'} inset-y-0 transform ${userPlayer?.team === 'blue' ? 'translate-x-1/2' : '-translate-x-1/2'} flex flex-col justify-between items-center py-4`}>
            <div className="text-center">
              <p className="text-4xl font-bold text-white mb-2">Field Location:</p>
              <p className="text-3xl text-white">{fieldLocation.name}</p>
            </div>
            <div className="w-56 h-56 relative">
              <Image
                src={fieldLocation.image}
                alt="Field Location"
                layout="fill"
                objectFit="cover"
                className="rounded-lg"
              />
            </div>
            <a href={fieldLocation.gpsLink} target="_blank" rel="noopener noreferrer" className="text-2xl text-blue-300 underline">GPS Link</a>
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
                        {match && match.team1.map((player) => (
                          <li key={player.userId} className="flex items-center space-x-2 cursor-pointer" onClick={() => handlePlayerClick(player)}>
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                              {player.profilePicture ? (
                                <Image
                                  src={getPlayerImage(player)}
                                  alt={player.name}
                                  width={40}
                                  height={40}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <User className="text-gray-400" size={24} />
                              )}
                            </div>
                            <span className="text-blue-600">{player.name}</span>
                            <span className="text-sm text-gray-500">({player.position})</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                  <div className="w-1/2 pl-2 border-l">
                    <h4 className="font-semibold text-red-600 mb-2">Red Team</h4>
                    <ScrollArea className="h-[calc(100%-2rem)]">
                      <ul className="space-y-2">
                        {match && match.team2.map((player) => (
                          <li key={player.userId} className="flex items-center space-x-2 cursor-pointer" onClick={() => handlePlayerClick(player)}>
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                              {player.profilePicture ? (
                                <Image
                                  src={getPlayerImage(player)}
                                  alt={player.name}
                                  width={40}
                                  height={40}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <User className="text-gray-400" size={24} />
                              )}
                            </div>
                            <span className="text-red-600">{player.name}</span>
                            <span className="text-sm text-gray-500">({player.position})</span>
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