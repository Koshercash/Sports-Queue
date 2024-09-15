'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { UserProfile } from '@/components/UserProfile';
import axios from 'axios';

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
  bio: string;
}

export default function ProfilePage() {
  const { id } = useParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    if (!id) {
      setError('User ID is missing');
      setLoading(false);
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const fetchUserData = async () => {
      try {
        const response = await axios.get(`http://localhost:3002/api/user/${id}`);
        setUserData(response.data);
        setIsCurrentUser(response.data.isCurrentUser);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load user data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id, router]);

  const handleProfilePictureChange = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await axios.post('http://localhost:3002/api/user/profile-picture', formData, {
        withCredentials: true,
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data' 
        },
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
    return <div>User not found.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <UserProfile
        {...userData}
        isCurrentUser={isCurrentUser}
        onProfilePictureChange={isCurrentUser ? handleProfilePictureChange : undefined}
      />
      <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
        Back
      </button>
    </div>
  );
}