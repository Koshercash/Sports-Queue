'use client';  // Add this at the top of the file

import React, { createContext, useState, useContext, useEffect } from 'react';

interface GameContextType {
  gameState: 'lobby' | 'inProgress' | 'halftime' | 'ended' | 'reportScore';
  setGameState: React.Dispatch<React.SetStateAction<'lobby' | 'inProgress' | 'halftime' | 'ended' | 'reportScore'>>;
  totalGameTime: number;
  setTotalGameTime: React.Dispatch<React.SetStateAction<number>>;
  gameTime: number;
  setGameTime: React.Dispatch<React.SetStateAction<number>>;
  reportScoreTime: number;
  setReportScoreTime: React.Dispatch<React.SetStateAction<number>>;
  blueScore: number;
  setBlueScore: React.Dispatch<React.SetStateAction<number>>;
  redScore: number;
  setRedScore: React.Dispatch<React.SetStateAction<number>>;
  halfTimeOccurred: boolean;
  setHalfTimeOccurred: React.Dispatch<React.SetStateAction<boolean>>;
  isReady: boolean;
  setIsReady: React.Dispatch<React.SetStateAction<boolean>>;
  readyCount: number;
  setReadyCount: React.Dispatch<React.SetStateAction<number>>;
  resetGame: () => void; // Add this line
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  currentGameId: string | null;
  setCurrentGameId: React.Dispatch<React.SetStateAction<string | null>>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<'lobby' | 'inProgress' | 'halftime' | 'ended' | 'reportScore'>('lobby');
  const [totalGameTime, setTotalGameTime] = useState(120);
  const [gameTime, setGameTime] = useState(60);
  const [reportScoreTime, setReportScoreTime] = useState(15);
  const [blueScore, setBlueScore] = useState(0);
  const [redScore, setRedScore] = useState(0);
  const [halfTimeOccurred, setHalfTimeOccurred] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

  const resetGame = () => {
    setGameState('lobby');
    setTotalGameTime(120);
    setGameTime(60);
    setReportScoreTime(15);
    setBlueScore(0);
    setRedScore(0);
    setHalfTimeOccurred(false);
    setIsReady(false);
    setReadyCount(0);
    setCurrentGameId(null);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === 'inProgress' || gameState === 'halftime' || gameState === 'reportScore') {
      interval = setInterval(() => {
        if (gameState === 'reportScore') {
          setReportScoreTime((prevTime) => {
            if (prevTime === 0) {
              setGameState('ended');
              return 0;
            }
            return prevTime - 1;
          });
        } else if (gameState === 'halftime') {
          setGameTime((prevTime) => {
            if (prevTime === 0) {
              setGameState('inProgress');
              return totalGameTime / 2; // Start second half
            }
            return prevTime - 1;
          });
        } else {
          setTotalGameTime((prevTime) => {
            if (prevTime === 0) {
              setGameState('reportScore');
              setReportScoreTime(15); // 15 seconds for score reporting
              return 0;
            }
            if (prevTime === totalGameTime / 2 && !halfTimeOccurred) {
              setGameState('halftime');
              setHalfTimeOccurred(true);
              setGameTime(15); // 15 seconds halftime
              return prevTime; // Don't decrement totalGameTime during halftime
            }
            return prevTime - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, halfTimeOccurred, totalGameTime]);

  return (
    <GameContext.Provider value={{
      gameState, setGameState,
      totalGameTime, setTotalGameTime,
      gameTime, setGameTime,
      reportScoreTime, setReportScoreTime,
      blueScore, setBlueScore,
      redScore, setRedScore,
      halfTimeOccurred, setHalfTimeOccurred,
      isReady, setIsReady,
      readyCount, setReadyCount,
      resetGame,
      isLoggedIn, setIsLoggedIn,
      currentGameId,
      setCurrentGameId
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};