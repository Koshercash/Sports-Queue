import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { InteractableProfilePicture } from './InteractableProfilePicture';

interface MatchHistoryProps {
  matches: RecentGame[];
  currentUserId: string;
  onPlayerClick: (playerId: string) => void;
}

interface RecentGame {
  id: string;
  mode: '5v5' | '11v11';
  blueScore: number;
  redScore: number;
  location: string;
  endTime: string;
  players: { id: string; name: string; profilePicture?: string }[];
  distance?: number;
}

export default function MatchHistory({ matches, currentUserId, onPlayerClick }: MatchHistoryProps) {
  const getMatchResult = (match: RecentGame) => {
    const isPlayerInBlueTeam = match.players.some(p => p.id === currentUserId);
    if (isPlayerInBlueTeam === undefined) return null;

    const isWin = (isPlayerInBlueTeam && match.blueScore > match.redScore) ||
                  (!isPlayerInBlueTeam && match.redScore > match.blueScore);

    return (
      <span className={`text-lg font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
        {isWin ? 'Win' : 'Loss'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {matches.length === 0 ? (
        <p className="text-xl">No recent matches found.</p>
      ) : (
        matches.map((match) => (
          <Card key={match.id} className="overflow-hidden">
            <CardHeader className="bg-gray-100 pb-2">
              <CardTitle className="text-xl flex justify-between items-center">
                <span>{new Date(match.endTime).toLocaleString()}</span>
                {getMatchResult(match)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-center mb-2">
                <p className="text-2xl font-semibold">{match.mode}</p>
              </div>
              <div className="flex justify-center items-center mb-2">
                <span className="text-4xl font-bold text-blue-600 mr-4">{match.blueScore}</span>
                <span className="text-4xl font-bold">-</span>
                <span className="text-4xl font-bold text-red-600 ml-4">{match.redScore}</span>
              </div>
              <p className="text-xl mb-4 text-center">{match.location}</p>
              <div>
                <p className="text-lg font-semibold mb-2">Players:</p>
                <div className="flex flex-wrap gap-4 justify-center">
                  {match.players.map(player => (
                    <div key={player.id} className="flex flex-col items-center">
                      <InteractableProfilePicture
                        currentImage={player.profilePicture || ''}
                        onClick={() => onPlayerClick(player.id)}
                        size="small"
                      />
                      <span className="text-sm mt-1">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}