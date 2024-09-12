import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "../../components/ui/scroll-area"

interface Player {
  id: string;
  name: string;
  position: string;
  team: 'blue' | 'red';
  profilePicture: string | null;
}

interface GameScreenProps {
  mode: '5v5' | '11v11';
  players: Player[];
}

export default function GameScreen({ mode = '5v5', players }: GameScreenProps) {
  const [showChat, setShowChat] = useState(false)
  const [showPlayerList, setShowPlayerList] = useState(false)

  const getPositionStyle = (position: string, team: 'blue' | 'red', index: number) => {
    const baseStyle = "absolute transform -translate-x-1/2 -translate-y-1/2";
    const teamColor = team === 'blue' ? 'border-blue-300' : 'border-red-300';
    
    if (mode === '5v5') {
      switch (position) {
        case 'goalkeeper': return `${baseStyle} ${team === 'blue' ? 'left-[10%]' : 'right-[10%]'} top-1/2 ${teamColor}`;
        case 'defender': return `${baseStyle} ${team === 'blue' ? 'left-[30%]' : 'right-[30%]'} ${index % 2 === 0 ? 'top-[30%]' : 'top-[70%]'} ${teamColor}`;
        case 'midfielder': return `${baseStyle} ${team === 'blue' ? 'left-[50%]' : 'right-[50%]'} top-1/2 ${teamColor}`;
        case 'striker': return `${baseStyle} ${team === 'blue' ? 'left-[70%]' : 'right-[70%]'} top-1/2 ${teamColor}`;
        default: return `${baseStyle} ${team === 'blue' ? 'left-1/4' : 'right-1/4'} top-1/2 ${teamColor}`;
      }
    } else {
      // 11v11 positioning
      switch (position) {
        case 'goalkeeper': return `${baseStyle} ${team === 'blue' ? 'left-[5%]' : 'right-[5%]'} top-1/2 ${teamColor}`;
        case 'defender': return `${baseStyle} ${team === 'blue' ? 'left-[20%]' : 'right-[20%]'} top-[${20 + (index * 15)}%] ${teamColor}`;
        case 'midfielder': return `${baseStyle} ${team === 'blue' ? 'left-[40%]' : 'right-[40%]'} top-[${25 + (index * 12.5)}%] ${teamColor}`;
        case 'striker': return `${baseStyle} ${team === 'blue' ? 'left-[60%]' : 'right-[60%]'} top-[${30 + (index * 20)}%] ${teamColor}`;
        default: return `${baseStyle} ${team === 'blue' ? 'left-1/4' : 'right-1/4'} top-1/2 ${teamColor}`;
      }
    }
  };

  return (
    <div className="min-h-screen bg-white text-black relative">
      <div className="absolute inset-0 flex">
        <div className="w-1/2 bg-blue-600 opacity-80"></div>
        <div className="w-1/2 bg-red-600 opacity-80"></div>
      </div>
      <div className="relative z-10 p-4">
        <Button variant="outline" className="absolute top-4 left-4 bg-white">Leave Game</Button>
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
          
          {/* Player positions */}
          {players.map((player, index) => (
            <div
              key={player.id}
              className={getPositionStyle(player.position, player.team, index)}
            >
              <Avatar>
                <AvatarImage src={player.profilePicture || `/placeholder-avatar-${index + 1}.jpg`} alt={player.name} />
                <AvatarFallback>{player.team === 'blue' ? 'B' : 'R'}{index + 1}</AvatarFallback>
              </Avatar>
            </div>
          ))}
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
          <p className="font-medium">Time: 7:00 PM</p>
          <p className="font-medium">Location: Central Park Field 3</p>
        </div>

        <div className="flex space-x-4">
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

        <div className="flex space-x-4 mt-4">
          {showChat && (
            <Card>
              <div className="flex-1 p-4">
                <ScrollArea className="h-48 mb-4">
                  <div className="space-y-2">
                    <p><strong className="text-blue-600">Player 1 (Blue):</strong> Good luck everyone!</p>
                    <p><strong className="text-red-600">Player 2 (Red):</strong> Let's have a great game!</p>
                  </div>
                </ScrollArea>
                <div className="flex space-x-2">
                  <Input placeholder="Type a message..." className="flex-grow" />
                  <Button className="bg-green-500 hover:bg-green-600 text-white">Send</Button>
                </div>
              </div>
            </Card>
          )}

          {showPlayerList && (
            <Card>
              <div className="flex-1 p-4">
                <h3 className="font-bold mb-2">Players</h3>
                <div className="flex">
                  <div className="w-1/2 pr-2">
                    <h4 className="font-semibold text-blue-600 mb-1">Blue Team</h4>
                    <ScrollArea className="h-48">
                      <ul className="space-y-2">
                        {players.filter(p => p.team === 'blue').map((player, index) => (
                          <li key={player.id} className="flex items-center space-x-2">
                            <Avatar>
                              <AvatarImage src={player.profilePicture || `/placeholder-avatar-${index * 2 + 1}.jpg`} alt={player.name} />
                              <AvatarFallback>B{index + 1}</AvatarFallback>
                            </Avatar>
                            <span className="text-blue-600">{player.name}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                  <div className="w-1/2 pl-2 border-l">
                    <h4 className="font-semibold text-red-600 mb-1">Red Team</h4>
                    <ScrollArea className="h-48">
                      <ul className="space-y-2">
                        {players.filter(p => p.team === 'red').map((player, index) => (
                          <li key={player.id} className="flex items-center space-x-2">
                            <Avatar>
                              <AvatarImage src={player.profilePicture || `/placeholder-avatar-${index * 2 + 2}.jpg`} alt={player.name} />
                              <AvatarFallback>R{index + 1}</AvatarFallback>
                            </Avatar>
                            <span className="text-red-600">{player.name}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}