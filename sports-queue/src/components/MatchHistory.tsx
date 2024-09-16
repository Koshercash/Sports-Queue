import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface MatchHistoryProps {
  matches: RecentGame[];
}

interface RecentGame {
  id: string;
  mode: '5v5' | '11v11';
  blueScore: number;
  redScore: number;
  location: string;
  endTime: string;
  players: { id: string; name: string }[];
}

export default function MatchHistory({ matches }: MatchHistoryProps) {
  return (
    <div className="space-y-4">
      {matches.length === 0 ? (
        <p>No recent matches found.</p>
      ) : (
        matches.map((match) => (
          <Card key={match.id}>
            <CardHeader>
              <CardTitle>{match.mode} Match - {new Date(match.endTime).toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                Score: <span className="text-blue-600">{match.blueScore}</span> - <span className="text-red-600">{match.redScore}</span>
              </p>
              <p>Location: {match.location}</p>
              <p>Players: {match.players.map(p => p.name).join(', ')}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}