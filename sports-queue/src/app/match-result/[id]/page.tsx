'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

interface MatchResult {
  id: string;
  mode: '5v5' | '11v11';
  blueScore: number;
  redScore: number;
  location: string;
  endTime: string;
  players: {
    id: string;
    name: string;
    team: 'blue' | 'red';
  }[];
}

export default function MatchResultScreen() {
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const fetchMatchResult = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No token found');
        }
        console.log('Fetching match result for ID:', params.id);
        const response = await axios.get<MatchResult>(`http://localhost:3002/api/match-result/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Received match result:', response.data);
        setMatchResult(response.data);
      } catch (error) {
        console.error('Failed to fetch match result:', error);
        setError('Failed to load match result. Please try again.');
      }
    };

    if (params.id) {
      fetchMatchResult();
    } else {
      setError('No match ID provided');
    }
  }, [params.id]);

  if (error) {
    return <div className="container mx-auto p-4">Error: {error}</div>;
  }

  if (!matchResult) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Button onClick={() => router.back()} className="mb-4">Back</Button>
      <Card>
        <CardHeader>
          <CardTitle>Match Result</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-bold">{new Date(matchResult.endTime).toLocaleString()}</p>
          <p>Mode: {matchResult.mode}</p>
          <p>Score: {matchResult.blueScore} - {matchResult.redScore}</p>
          <p>Location: {matchResult.location}</p>
          <div className="mt-4">
            <h3 className="font-bold">Players:</h3>
            <div className="flex">
              <div className="w-1/2">
                <h4 className="font-semibold text-blue-600">Blue Team</h4>
                <ul>
                  {matchResult.players.filter(p => p.team === 'blue').map(player => (
                    <li key={player.id}>{player.name}</li>
                  ))}
                </ul>
              </div>
              <div className="w-1/2">
                <h4 className="font-semibold text-red-600">Red Team</h4>
                <ul>
                  {matchResult.players.filter(p => p.team === 'red').map(player => (
                    <li key={player.id}>{player.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}