import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { InteractableProfilePicture } from './InteractableProfilePicture';

interface Match {
  id: string;
  mode: '5v5' | '11v11';
  blueScore: number;
  redScore: number;
  location: string;
  endTime: string;
  players: { id: string; name: string; profilePicture?: string }[];
  mmrChange: number;
}

interface MatchHistoryProps {
  matches: Match[];
  currentUserId: string;
  onPlayerClick: (playerId: string) => void;
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ matches, currentUserId, onPlayerClick }) => {
  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <Card key={match.id} className="overflow-hidden">
          <CardHeader className="bg-gray-100 py-2 px-3">
            <CardTitle className="flex justify-between items-center">
              <span className="text-base w-1/3">{new Date(match.endTime).toLocaleString()}</span>
              <span className="text-lg font-bold w-1/3 text-center -ml-3">{match.mode}</span>
              <span className="text-sm font-semibold text-gray-600 w-1/3 text-right">
                MMR: {match.mmrChange > 0 ? '+' : ''}{match.mmrChange}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 relative">
            <div className={`absolute top-0 right-0 p-2 text-3xl font-bold ${match.mmrChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {match.mmrChange > 0 ? 'Win' : 'Loss'}
            </div>
            <p className="text-base mb-2 text-center font-semibold">{match.location}</p>
            <div className="flex justify-center items-center mb-4">
              <span className="text-5xl font-bold text-blue-600 mr-4">{match.blueScore}</span>
              <span className="text-3xl font-bold">-</span>
              <span className="text-5xl font-bold text-red-600 ml-4">{match.redScore}</span>
            </div>
            <div>
              <p className="text-base font-semibold mb-2">Players:</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {match.players.map(player => (
                  <div key={player.id} className="flex flex-col items-center">
                    <div className="rounded-full overflow-hidden w-10 h-10">
                      <InteractableProfilePicture
                        currentImage={player.profilePicture || ''}
                        onClick={() => onPlayerClick(player.id)}
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
  );
};

export default MatchHistory;