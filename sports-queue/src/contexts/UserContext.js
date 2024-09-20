'use client';

import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeUser = async () => {
      const token = localStorage.getItem('token');
      console.log('Token found in localStorage:', token ? 'Yes' : 'No');
      if (token) {
        try {
          const decodedToken = jwtDecode(token);
          console.log('Decoded token:', decodedToken);
          
          // Fetch user details from the server
          const response = await axios.get(`${API_BASE_URL}/api/user-profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const userData = {
            ...decodedToken,
            ...response.data,
            isAdmin: decodedToken.isAdmin || false
          };
          
          console.log('User data set in context:', userData);
          setUser(userData);
        } catch (error) {
          console.error('Error initializing user:', error);
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };

    initializeUser();
  }, []);

  const login = async (token) => {
    console.log('Login called with token:', token);
    localStorage.setItem('token', token);
    try {
      const decodedToken = jwtDecode(token);
      console.log('Decoded token in login:', decodedToken);
      
      // Fetch user details from the server
      const response = await axios.get(`${API_BASE_URL}/api/user-profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const userData = {
        ...decodedToken,
        ...response.data,
        isAdmin: decodedToken.isAdmin || false
      };
      
      console.log('User data set in login:', userData);
      setUser(userData);
    } catch (error) {
      console.error('Error decoding token or fetching user data in login:', error);
    }
  };

  const logout = () => {
    console.log('Logout called');
    localStorage.removeItem('token');
    setUser(null);
  };

  console.log('Current user in UserContext:', user);

  return (
    <UserContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};