import React, { createContext, useState, useEffect } from 'react';
import { UserProvider } from '../../../frontend/src/contexts/UserContext';
import MainScreen from '../components/MainScreen';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser(token);
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(async function(registration) {
          console.log('Service Worker registered with scope:', registration.scope);
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          });
          
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('No token found, unable to save push subscription');
            return;
          }

          // Send the subscription to your server
          return axios.post(`${API_BASE_URL}/api/subscribe`, subscription, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
          });
        })
        .then(function(response) {
          console.log('Push subscription saved:', response.data);
        })
        .catch(function(error) {
          console.error('Error saving push subscription:', error);
        });
    }
  }, []);

  const fetchUser = async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/user-profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, { email, password });
      localStorage.setItem('token', response.data.token);
      await fetchUser(response.data.token);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AppContext.Provider value={{ user, login, logout }}>
      <UserProvider>
        <MainScreen />
      </UserProvider>
    </AppContext.Provider>
  );
};

function App() {
  return (
    <AppProvider>
      <MainScreen />
    </AppProvider>
  );
}

export default App;