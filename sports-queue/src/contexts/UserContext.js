'use client';

import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";
import axios from 'axios'; // Assuming axios is imported for the API request
import { API_BASE_URL } from '../config/api';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/user-profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  };

  const initializeUser = async () => {
    const token = localStorage.getItem('token');
    console.log('Token found in localStorage:', token ? 'Yes' : 'No');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        console.log('Decoded token:', decodedToken);
        
        const userProfile = await fetchUserProfile(token);
        
        const userData = {
          ...decodedToken,
          ...userProfile,
          isAdmin: decodedToken.isAdmin || false
        };
        console.log('Setting user data:', userData);
        setUser(userData);
      } catch (error) {
        console.error('Error initializing user:', error);
        localStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    initializeUser();
  }, []);

  const login = async (token) => {
    console.log('Login called with token:', token);
    localStorage.setItem('token', token);
    await initializeUser();
  };

  const logout = () => {
    console.log('Logout called');
    localStorage.removeItem('token');
    setUser(null);
  };

  console.log('Current user in UserContext:', user);

  return (
    <UserContext.Provider value={{ user, login, logout, isLoading, initializeUser }}>
      {children}
    </UserContext.Provider>
  );
};