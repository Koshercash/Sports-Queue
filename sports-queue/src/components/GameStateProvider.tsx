'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';

interface GameState {
  gameState: string;
  totalGameTime: number;
  gameTime: number;
  reportScoreTime: number;
  blueScore: number;
  redScore: number;
  halfTimeOccurred: boolean;
  isReady: boolean;
  readyCount: number;
  gameStartTime: Date | null; // Add this line
}

interface GameStateContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>({
    gameState: 'lobby',
    totalGameTime: 0,
    gameTime: 0,
    reportScoreTime: 0,
    blueScore: 0,
    redScore: 0,
    halfTimeOccurred: false,
    isReady: false,
    readyCount: 0,
    gameStartTime: null, // Add this line
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (gameState.gameState === 'inProgress' || gameState.gameState === 'halftime') {
      timer = setInterval(() => {
        setGameState(prevState => {
          const halfTime = 60; // Half of the total game time (120 seconds)
          const newTotalGameTime = prevState.totalGameTime - 1;

          if (prevState.gameState === 'inProgress' && newTotalGameTime === halfTime && !prevState.halfTimeOccurred) {
            // Trigger halftime when we reach the halfway point
            return {
              ...prevState,
              gameState: 'halftime',
              halfTimeOccurred: true,
              totalGameTime: 15, // 15 seconds for halftime
            };
          } else if (prevState.gameState === 'halftime' && newTotalGameTime <= 0) {
            // Transition back to inProgress after halftime
            return {
              ...prevState,
              gameState: 'inProgress',
              totalGameTime: halfTime, // Reset for second half
            };
          } else if (prevState.gameState === 'inProgress' && newTotalGameTime <= 0) {
            // End the game
            return {
              ...prevState,
              gameState: 'reportScore',
              reportScoreTime: 30, // 30 seconds to report score
            };
          }

          // Normal time decrement
          return {
            ...prevState,
            totalGameTime: newTotalGameTime,
          };
        });
      }, 1000);
    } else if (gameState.gameState === 'reportScore') {
      timer = setInterval(() => {
        setGameState(prevState => {
          if (prevState.reportScoreTime <= 0) {
            clearInterval(timer);
            return {
              ...prevState,
              gameState: 'ended',
            };
          }
          return {
            ...prevState,
            reportScoreTime: prevState.reportScoreTime - 1,
          };
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState.gameState]);

  return (
    <GameStateContext.Provider value={{ gameState, setGameState }}>
      {children}
    </GameStateContext.Provider>
  );
};