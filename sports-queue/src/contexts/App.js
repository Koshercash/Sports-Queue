import React from 'react';
import { UserProvider } from '../../../frontend/src/contexts/UserContext';
import MainScreen from '../components/MainScreen';

function App() {
  return (
    <UserProvider>
      <MainScreen />
    </UserProvider>
  );
}

export default App;