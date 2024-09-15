'use client';

import React from 'react';
import { useGameContext } from './GameContext';
import GameLobby from './components/GameLobby';
import AuthScreen from './AuthScreen';

const GamePage: React.FC = () => {
  const { gameState, isLoggedIn } = useGameContext();

  if (!isLoggedIn) {
    return <AuthScreen />;
  }

  // ... rest of the component
};

export default GamePage;