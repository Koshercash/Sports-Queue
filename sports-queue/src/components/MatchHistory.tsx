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
  mmrChange?: number;
}

export default function MatchHistory({ matches, currentUserId, onPlayerClick }: MatchHistoryProps) {
  const getMatchResult = (match: RecentGame) => {
    const isPlayerInBlueTeam = match.players.some(p => p.id === currentUserId);
    if (isPlayerInBlueTeam === undefined) return null;

    const isWin = (isPlayerInBlueTeam && match.blueScore > match.redScore) ||
                  (!isPlayerInBlueTeam && match.redScore > match.blueScore);

    const resultText = isWin ? 'Win' : 'Loss';
    const resultColor = isWin ? 'text-green-500' : 'text-red-500';

    return (
      <span className={`text-lg font-bold ${resultColor}`}>
        {resultText}
      </span>
    );
  };

  const getMmrChange = (match: RecentGame) => {
    if (match.mmrChange === undefined) return null;

    const mmrChangeColor = match.mmrChange >= 0 ? 'text-green-500' : 'text-red-500';
    const mmrChangeSign = match.mmrChange >= 0 ? '+' : '';

    return (
      <span className={`text-3xl font-bold ${mmrChangeColor}`}>
        {mmrChangeSign}{match.mmrChange}
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
              <CardTitle className="text-xl flex justify-between items-start">
                <span>{new Date(match.endTime).toLocaleString()}</span>
                {getMatchResult(match)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 relative">
              <div className="absolute top-2 right-2 flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-500">MMR</span>
                {getMmrChange(match)}
              </div>
              <div className="text-center mb-4">
                <p className="text-2xl font-semibold">{match.mode}</p>
              </div>
              <div className="flex justify-center items-center mb-4">
                <span className="text-5xl font-bold text-blue-600 mr-4">{match.blueScore}</span>
                <span className="text-5xl font-bold">-</span>
                <span className="text-5xl font-bold text-red-600 ml-4">{match.redScore}</span>
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