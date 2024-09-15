import { useState, useEffect } from 'react'
import axios from 'axios'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { UserProfile } from '@/components/UserProfile'
import Image from 'next/image'
import { useRouter } from 'next/navigation';

interface Player {
  id: string;
  name: string;
  position: string;
  team: 'blue' | 'red';
  profilePicture?: string | null;
}

interface GameScreenProps {
  mode: '5v5' | '11v11';
  players: Player[];
  currentUserId: string;
  onBackToMain: () => void;
  onLeaveGame: (gameStartTime: Date | null) => Promise<void>;
  lobbyTime: number;
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
}

export default function GameScreen({ mode = '5v5', players, currentUserId, onBackToMain, onLeaveGame, lobbyTime }: GameScreenProps) {
  const [showChat, setShowChat] = useState(false)
  const [showPlayerList, setShowPlayerList] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ sender: string; message: string; team: 'blue' | 'red' }[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<UserProfileData | null>(null);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false)
  const [leaveWarningMessage, setLeaveWarningMessage] = useState('')
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Set the game start time 20 minutes from now
    setGameStartTime(new Date(Date.now() + 20 * 60 * 1000));
  }, []);

  const handleLeaveGameClick = () => {
    const now = new Date();
    const timeDifference = gameStartTime ? (gameStartTime.getTime() - now.getTime()) / (1000 * 60) : 0;
    
    let warningMessage = '';
    if (lobbyTime >= 8 && timeDifference <= 20) {
      warningMessage = 'Warning: Leaving the game now may result in a penalty.';
    }

    setLeaveWarningMessage(warningMessage);
    setShowLeavePrompt(true);
  };

  const handleConfirmLeave = async () => {
    setShowLeavePrompt(false);
    try {
      console.log('Attempting to leave game with:', { lobbyTime, gameStartTime });
      await onLeaveGame(gameStartTime);
      console.log('Game left successfully, navigating to main screen');
      router.push('/main');
    } catch (error) {
      console.error('Detailed error in handleConfirmLeave:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', error.response?.data);
      }
      alert('Failed to leave game. Please try again.');
    }
  };

  const getPositionStyle = (position: string, team: 'blue' | 'red', index: number, totalPlayers: number) => {
    const baseStyle = "absolute transform -translate-x-1/2 -translate-y-1/2";
    const teamColor = team === 'blue' ? 'border-blue-500' : 'border-red-500';
    const isBlueTeam = team === 'blue';
    
    if (mode === '5v5') {
      switch (position) {
        case 'goalkeeper': return `${baseStyle} ${isBlueTeam ? 'left-[5%]' : 'left-[95%]'} top-1/2 ${teamColor}`;
        case 'defender': return `${baseStyle} ${isBlueTeam ? 'left-[20%]' : 'left-[80%]'} ${index % 2 === 0 ? 'top-[30%]' : 'top-[70%]'} ${teamColor}`;
        case 'midfielder': return `${baseStyle} ${isBlueTeam ? 'left-[35%]' : 'left-[65%]'} top-1/2 ${teamColor}`;
        case 'striker': return `${baseStyle} ${isBlueTeam ? 'left-[45%]' : 'left-[55%]'} top-1/2 ${teamColor}`;
        default: return `${baseStyle} ${isBlueTeam ? 'left-[30%]' : 'left-[70%]'} top-1/2 ${teamColor}`;
      }
    } else {
      // 11v11 positioning
      const positions = {
        goalkeeper: [{ x: 5, y: 50 }],
        defender: [
          { x: 15, y: 20 },
          { x: 15, y: 40 },
          { x: 15, y: 60 },
          { x: 15, y: 80 },
        ],
        midfielder: [
          { x: 30, y: 25 },
          { x: 30, y: 50 },
          { x: 30, y: 75 },
        ],
        striker: [
          { x: 40, y: 33 },
          { x: 40, y: 66 },
        ],
      };

      let pos = positions[position as keyof typeof positions] || [{ x: 25, y: 50 }];
      let { x, y } = pos[index % pos.length];

      if (!isBlueTeam) {
        x = 100 - x;
      }

      // Ensure players stay within field boundaries
      x = Math.max(2, Math.min(98, x));
      y = Math.max(5, Math.min(95, y));

      return `${baseStyle} left-[${x}%] top-[${y}%] ${teamColor}`;
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const currentPlayer = players.find(p => p.id === 'current_player_id'); // Replace with actual current player ID
      setChatMessages([...chatMessages, { 
        sender: currentPlayer?.name || 'You', 
        message: newMessage.trim(), 
        team: currentPlayer?.team || 'blue'
      }]);
      setNewMessage('');
    }
  };

  const handlePlayerClick = async (player: Player) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<UserProfileData>(`http://localhost:3002/api/user/${player.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const profileData = {
        ...response.data,
        profilePicture: response.data.profilePicture
          ? response.data.profilePicture.startsWith('http')
            ? response.data.profilePicture
            : `http://localhost:3002${response.data.profilePicture}`
          : null
      };
      setSelectedProfile(profileData);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      alert('Failed to load user profile. Please try again.');
    }
  };

  const handleAddFriend = async () => {
    if (selectedProfile) {
      try {
        const token = localStorage.getItem('token');
        await axios.post('http://localhost:3002/api/friends/add', 
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

  const getPlayerImage = (player: Player) => {
    if (player.profilePicture) {
      return player.profilePicture.startsWith('http') 
        ? player.profilePicture 
        : `http://localhost:3002${player.profilePicture}`;
    }
    return null;
  };

  const handleBackClick = () => {
    onBackToMain();
  };

  const positionOrder = ['goalkeeper', 'defender', 'midfielder', 'striker'];
  const sortedPlayers = players.sort((a, b) => 
    positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position)
  );

  const blueTeam = sortedPlayers.filter(p => p.team === 'blue');
  const redTeam = sortedPlayers.filter(p => p.team === 'red');

  const userPlayer = players.find(p => p.id === currentUserId);

  // Function to get the field location (this is a placeholder, replace with actual logic)
  const getFieldLocation = () => {
    return {
      name: "Central Park Field",
      gpsLink: "https://goo.gl/maps/exampleLink",
      image: "/images/central-park-field.jpg" // Add an actual image path
    };
  };

  const fieldLocation = getFieldLocation();

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
            className="absolute top-4 left-4 bg-white text-green-500 hover:bg-green-50 h-10 px-3 text-sm flex items-center"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Back</span>
          </Button>
          <Button 
            variant="outline" 
            className="absolute top-4 right-4 bg-white h-10 px-4"
            onClick={handleLeaveGameClick}
          >
            Leave Game
          </Button>
        </div>
        <h1 className="text-4xl font-bold text-center mb-8 text-white">{mode}</h1>
        
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
            <div className={`absolute ${userPlayer.team === 'blue' ? 'left-1/2' : 'right-1/2'} top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center`}>
              <p className="text-2xl font-bold text-white mb-2">Position:</p>
              <div className={`w-16 h-16 rounded-full overflow-hidden border-4 ${userPlayer.team === 'blue' ? 'border-blue-500' : 'border-red-500'} shadow-lg relative mb-2`}>
                <Avatar>
                  {userPlayer.profilePicture ? (
                    <AvatarImage src={getPlayerImage(userPlayer) || ''} alt={userPlayer.name} />
                  ) : (
                    <AvatarFallback>{userPlayer.name.charAt(0)}</AvatarFallback>
                  )}
                </Avatar>
              </div>
              <p className="text-2xl font-bold text-white">{userPlayer.position}</p>
            </div>
          )}

          {/* Field location information */}
          <div className={`absolute ${userPlayer?.team === 'blue' ? 'right-1/4' : 'left-1/4'} top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center`}>
            <p className="text-2xl font-bold text-white mb-2">Field Location:</p>
            <p className="text-xl text-white mb-2">{fieldLocation.name}</p>
            <a href={fieldLocation.gpsLink} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline mb-2">GPS Link</a>
            <img src={fieldLocation.image} alt="Field Location" className="w-32 h-32 object-cover rounded-lg" />
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <Button className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-2xl font-bold px-12 py-6 rounded-xl shadow-lg transform transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300">
            READY UP
          </Button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="font-semibold text-blue-200 text-xl">Blue Team</p>
          <p className="font-semibold text-red-200 text-xl">Red Team</p>
        </div>

        <div className="flex justify-between items-center mb-4 bg-white bg-opacity-80 p-2 rounded">
          <p className="font-medium">Current Time: {new Date().toLocaleTimeString()}</p>
          <p className="font-medium">Game Start Time: {gameStartTime?.toLocaleTimeString()}</p>
          <p className="font-medium">Lobby Time: {lobbyTime} seconds</p>
        </div>

        <div className="flex space-x-4 mt-4">
          <Button 
            className="flex-1 bg-green-500 hover:bg-green-600 text-white" 
            onClick={() => setShowChat(!showChat)}
          >
            {showChat ? 'Close Chat' : 'Open Chat'}
          </Button>
          <Button 
            className="flex-1 bg-green-500 hover:bg-green-600 text-white" 
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
                    {chatMessages.map((msg, index) => (
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
                    className="bg-green-500 hover:bg-green-600 text-white"
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
                <h3 className="font-bold mb-2">Players</h3>
                <div className="flex h-[calc(100%-2rem)]">
                  <div className="w-1/2 pr-2">
                    <h4 className="font-semibold text-blue-600 mb-1">Blue Team</h4>
                    <ScrollArea className="h-full">
                      <ul className="space-y-2">
                        {blueTeam.map((player) => (
                          <li key={player.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => handlePlayerClick(player)}>
                            <div className="w-10 h-10 rounded-full overflow-hidden">
                              <Image
                                src={getPlayerImage(player) || ''}
                                alt={player.name}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full"
                              />
                            </div>
                            <span className="text-blue-600">{player.name}</span>
                            <span className="text-sm text-gray-500">({player.position})</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                  <div className="w-1/2 pl-2 border-l">
                    <h4 className="font-semibold text-red-600 mb-1">Red Team</h4>
                    <ScrollArea className="h-full">
                      <ul className="space-y-2">
                        {redTeam.map((player) => (
                          <li key={player.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => handlePlayerClick(player)}>
                            <div className="w-10 h-10 rounded-full overflow-hidden">
                              <Image
                                src={getPlayerImage(player) || ''}
                                alt={player.name}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full"
                              />
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
            />
            <div className="flex justify-between mt-4">
              <Button onClick={() => setSelectedProfile(null)}>Close</Button>
              {!selectedProfile.isCurrentUser && (
                <Button onClick={handleAddFriend}>Add Friend</Button>
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
    </div>
  )
}