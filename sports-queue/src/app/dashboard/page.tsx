'use client';

import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/components/UserProfile';
import { FriendsList } from '@/components/FriendsList';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  sex: string;
  position: string;
  skillLevel: string;
  dateOfBirth: string;
  profilePicture: string | null;
  mmr5v5: number;
  mmr11v11: number;
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const fetchData = async () => {
      try {
        const userResponse = await axios.get<UserData>('http://localhost:3002/api/user-profile');
        setUserData(userResponse.data);

        const friendsResponse = await axios.get('http://localhost:3002/api/friends');
        setFriends(friendsResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load user data. Please try logging in again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleProfilePictureChange = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await axios.post<{ profilePicture: string }>('http://localhost:3002/api/user/profile-picture', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.profilePicture) {
        setUserData(prevData => prevData ? {
          ...prevData,
          profilePicture: response.data.profilePicture
        } : null);
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      alert('Failed to update profile picture. Please try again.');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!userData) {
    return <div>No user data available. Please try logging in again.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <UserProfile
        {...userData}
        isCurrentUser={true}
        onProfilePictureChange={handleProfilePictureChange}
      />
      <FriendsList friends={friends} />
    </div>
  );
}