import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";

interface Match {
  id: string;
  mode: '5v5' | '11v11';
  blueScore: number;
  redScore: number;
  location: string;
  endTime: string;
}

interface MatchHistoryProps {
  matches: Match[];
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ matches }) => {
  const router = useRouter();

  const handleMatchClick = (matchId: string) => {
    console.log('Navigating to match result:', matchId);
    router.push(`/match-result/${matchId}`);
  };

  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <div 
          key={match.id} 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleMatchClick(match.id)}
        >
          <Card>
            <CardContent className="p-4">
              <p className="font-bold">{new Date(match.endTime).toLocaleString()}</p>
              <p>Mode: {match.mode}</p>
              <p>Score: {match.blueScore} - {match.redScore}</p>
              <p>Location: {match.location}</p>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
};

export default MatchHistory;