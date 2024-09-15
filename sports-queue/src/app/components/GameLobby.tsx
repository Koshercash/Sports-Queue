'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '../GameContext';
import axios from 'axios';

const GameLobby: React.FC = () => {
  const router = useRouter();
  const { resetGame, currentGameId, setCurrentGameId } = useGameContext();

  const handleLeaveGame = async () => {
    try {
      if (currentGameId) {
        await axios.post('http://localhost:3002/api/leave-game', { gameId: currentGameId }, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      }
      resetGame();
      setCurrentGameId(null);
      router.push('/'); // Assuming '/' is your home or game selection page
    } catch (error) {
      console.error('Error leaving game:', error);
    }
  };

  return (
    <div>
      <h1>Game Lobby</h1>
      {/* Add other lobby content here */}
      <button onClick={handleLeaveGame}>Leave Game</button>
    </div>
  );
};

export default GameLobby;