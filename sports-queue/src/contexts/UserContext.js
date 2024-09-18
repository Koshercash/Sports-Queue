'use client';

import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('Token found in localStorage:', token ? 'Yes' : 'No');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        console.log('Decoded token:', decodedToken);
        setUser({
          ...decodedToken,
          isAdmin: decodedToken.isAdmin || false
        });
      } catch (error) {
        console.error('Error decoding token:', error);
        localStorage.removeItem('token');
      }
    }
  }, []);

  const login = (token) => {
    console.log('Login called with token:', token);
    localStorage.setItem('token', token);
    try {
      const decodedToken = jwtDecode(token);
      console.log('Decoded token in login:', decodedToken);
      setUser({
        ...decodedToken,
        isAdmin: decodedToken.isAdmin || false
      });
    } catch (error) {
      console.error('Error decoding token in login:', error);
    }
  };

  const logout = () => {
    console.log('Logout called');
    localStorage.removeItem('token');
    setUser(null);
  };

  console.log('Current user in UserContext:', user);

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};