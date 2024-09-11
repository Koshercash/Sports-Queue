'use client';  // Add this line at the top of the file

import React, { useState, ChangeEvent, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';
import { InteractableProfilePicture } from '@/components/InteractableProfilePicture';

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    idPicture: null as File | null,
    sex: '',
    position: '',
    skillLevel: '',
    dateOfBirth: '',
    profilePicture: null as File | null,
    // Remove address field
  })

  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, idPicture: e.target.files[0] })
    }
  }

  const handleSexChange = (value: string) => {
    setFormData(prev => ({ ...prev, sex: value }));
  };

  const handleProfilePictureChange = (file: File) => {
    setFormData(prev => ({ ...prev, profilePicture: file }));
    setProfilePicture(URL.createObjectURL(file));
  };

  const handleNext = () => {
    if (isStepValid()) {
      setStep(step + 1)
    } else {
      alert("Please fill in all required fields before proceeding.")
    }
  }

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.name && formData.email && formData.password && formData.phone && formData.dateOfBirth && isOver16(formData.dateOfBirth)
      case 2:
        return formData.idPicture
      case 3:
        return formData.sex
      case 4:
        return formData.position
      case 5:
        return formData.skillLevel
      case 6:
        return true // Profile picture is optional
      default:
        return false
    }
  }

  const isOver16 = (dateOfBirth: string): boolean => {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      return age - 1 >= 16;
    }
    
    return age >= 16;
  }

  const getMMRFromSkillLevel = (skillLevel: string): number => {
    switch (skillLevel) {
      case 'beginner': return 300;
      case 'average': return 600;
      case 'intermediate': return 1000;
      case 'advanced': return 1400;
      case 'pro': return 1800;
      default: return 300;
    }
  }

  const handleSignUp = async () => {
    if (isStepValid()) {
      if (!isOver16(formData.dateOfBirth)) {
        alert("You must be 16 years or older to register.");
        return;
      }
      
      try {
        const formDataToSend = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== null) {
            if (key === 'dateOfBirth') {
              formDataToSend.append(key, new Date(value as string).toISOString());
            } else {
              formDataToSend.append(key, value as string | Blob);
            }
          }
        });

        const response = await axios.post('http://localhost:3002/api/register', formDataToSend, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
          
          // Send friend request to Alice immediately after successful registration
          try {
            const friendRequestResponse = await axios.post('http://localhost:3002/api/friends/send-dummy-request', {}, {
              headers: { 'Authorization': `Bearer ${response.data.token}` }
            });
            console.log('Friend request sent:', friendRequestResponse.data.message);
          } catch (friendRequestError) {
            console.error('Error sending friend request:', friendRequestError);
          }

          router.push('/main');
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Registration failed:', error.response?.data || error.message);
          alert(`Registration failed: ${error.response?.data?.error || error.message}`);
        } else {
          console.error('An unexpected error occurred:', error);
          alert('An unexpected error occurred. Please try again.');
        }
      }
    } else {
      alert("Please fill in all required fields before signing up.")
    }
  };

  const [addingFriend, setAddingFriend] = useState<string | null>(null);

  const handleAddFriend = async (friendId: string) => {
    console.log('Adding friend:', friendId);
    if (addingFriend === friendId) {
      console.log('Already adding this friend, returning');
      return;
    }
    setAddingFriend(friendId);
    try {
      const response = await axios.post('http://localhost:3002/api/friends/add', 
        { friendId },
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      console.log('Server response:', response.data);
      alert(response.data.message);
      await fetchFriends();
    } catch (error) {
      console.error('Error adding friend:', error);
      if (axios.isAxiosError(error) && error.response) {
        alert(error.response.data.error);
      } else {
        alert('Failed to add friend. Please try again.');
      }
    } finally {
      setAddingFriend(null);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    console.log('Attempting to remove friend:', friendId);
    const isConfirmed = window.confirm("Are you sure you want to remove this friend?");
    console.log('User confirmed:', isConfirmed);
    if (isConfirmed) {
      try {
        const response = await axios.delete('http://localhost:3002/api/friends/remove', {
          data: { friendId },
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        console.log('Server response:', response.data);
        alert(response.data.message);
        await fetchFriends();
      } catch (error) {
        console.error('Error removing friend:', error);
        alert('Failed to remove friend. Please try again.');
      }
    }
  };

  const [friends, setFriends] = useState<Array<{ id: string, name: string }>>([]);

  // Add this useEffect to fetch friends when the component mounts
  useEffect(() => {
    if (isLoggedIn) {
      fetchFriends();
    }
  }, [isLoggedIn]);

  const fetchFriends = async () => {
    try {
      const response = await axios.get('http://localhost:3002/api/friends', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Fetched friends:', response.data);
      setFriends(response.data);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute inset-0 border-8 border-green-500 animate-border-rotate"></div>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-4xl font-bold text-green-500 mb-8">Sports Queue</h1>
        {step === 1 && (
          <div className="w-full max-w-md space-y-4">
            <Input name="name" placeholder="Name" value={formData.name} onChange={handleInputChange} required />
            <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
            <Input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleInputChange} required />
            <Input name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleInputChange} required />
            <Input name="dateOfBirth" type="date" placeholder="Date of Birth" value={formData.dateOfBirth} onChange={handleInputChange} required />
            {/* Remove address input */}
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        )}
        {step === 2 && (
          <div className="w-full max-w-md space-y-4">
            <Label>Upload ID Picture</Label>
            <Input type="file" accept="image/*" onChange={handleFileChange} required />
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        )}
        {step === 3 && (
          <div className="w-full max-w-md space-y-4">
            <Label>Sex</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="male"
                  value="male"
                  checked={formData.sex === 'male'}
                  onChange={() => handleSexChange('male')}
                />
                <Label htmlFor="male">Male</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="female"
                  value="female"
                  checked={formData.sex === 'female'}
                  onChange={() => handleSexChange('female')}
                />
                <Label htmlFor="female">Female</Label>
              </div>
            </div>
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        )}
        {step === 4 && (
          <div className="w-full max-w-md space-y-4">
            <Label>Preferred Position</Label>
            <Select onValueChange={(value) => setFormData((prev) => ({ ...prev, position: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="goalkeeper">Goalkeeper</SelectItem>
                <SelectItem value="fullback">Full Back</SelectItem>
                <SelectItem value="centerback">Center Back</SelectItem>
                <SelectItem value="winger">Winger</SelectItem>
                <SelectItem value="midfielder">Midfielder</SelectItem>
                <SelectItem value="striker">Striker</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        )}
        {step === 5 && (
          <div className="w-full max-w-md space-y-4">
            <Label>Skill Level</Label>
            <Select onValueChange={(value) => setFormData((prev) => ({ ...prev, skillLevel: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select skill level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="average">Average</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        )}
        {step === 6 && (
          <div className="w-full max-w-md space-y-4">
            <Label>Profile Picture (Optional)</Label>
            <InteractableProfilePicture
              currentImage={profilePicture}
              onImageChange={handleProfilePictureChange}
            />
            <Button className="w-full" onClick={handleSignUp}>Sign Up</Button>
          </div>
        )}
      </div>
      
      {isLoggedIn && (
        <div className="mt-4">
          <h2>Friends List</h2>
          {friends.map(friend => (
            <div key={friend.id} className="flex items-center justify-between">
              <span>{friend.name}</span>
              <Button 
                onClick={() => handleAddFriend(friend.id)} 
                disabled={addingFriend === friend.id}
                className={`transition-all duration-300 ${addingFriend === friend.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {addingFriend === friend.id ? 'Adding...' : 'Add Friend'}
              </Button>
              <Button onClick={() => handleRemoveFriend(friend.id)}>Remove Friend</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}