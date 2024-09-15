'use client';

import React, { useState, ChangeEvent } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';
import { InteractableProfilePicture } from '@/components/InteractableProfilePicture';
import { useGameContext } from './GameContext';

const AuthScreen: React.FC = () => {
  const router = useRouter();
  const { setGameState, setIsLoggedIn, setCurrentGameId } = useGameContext();
  const [isRegistering, setIsRegistering] = useState(true);
  const [step, setStep] = useState(1);
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
  });

  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, idPicture: e.target.files[0] });
    }
  };

  const handleSexChange = (value: string) => {
    setFormData(prev => ({ ...prev, sex: value }));
  };

  const handleProfilePictureChange = (file: File) => {
    setFormData(prev => ({ ...prev, profilePicture: file }));
    setProfilePicture(URL.createObjectURL(file));
  };

  const handleNext = () => {
    if (isStepValid()) {
      setStep(step + 1);
    } else {
      alert("Please fill in all required fields before proceeding.");
    }
  };

  const isStepValid = () => {
    // Implement validation logic for each step
    return true; // Placeholder
  };

  const isOver16 = (dateOfBirth: string): boolean => {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      return age - 1 >= 16;
    }
    
    return age >= 16;
  };

  const handleSubmit = async () => {
    if (isRegistering) {
      if (!isStepValid()) {
        alert("Please fill in all required fields before registering.");
        return;
      }
      if (!isOver16(formData.dateOfBirth)) {
        alert("You must be 16 years or older to register.");
        return;
      }
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

      const endpoint = isRegistering ? 'http://localhost:3002/api/register' : 'http://localhost:3002/api/login';
      const response = await axios.post(endpoint, formDataToSend, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        
        // After successful login/registration, get the current game state from the server
        const gameStateResponse = await axios.get('http://localhost:3002/api/game-state', {
          headers: { 'Authorization': `Bearer ${response.data.token}` }
        });

        if (gameStateResponse.data.gameId) {
          setCurrentGameId(gameStateResponse.data.gameId);
          setGameState(gameStateResponse.data.state);
        } else {
          // If there's no active game, reset the game state
          setCurrentGameId(null);
          setGameState('lobby');
        }

        setIsLoggedIn(true);
        router.push('/main');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authentication failed:', error.response?.data || error.message);
        alert(`Authentication failed: ${error.response?.data?.error || error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
        alert('An unexpected error occurred. Please try again.');
      }
    }
  };

  const renderAuthForm = () => {
    if (!isRegistering) {
      return (
        <div className="w-full max-w-md space-y-4">
          <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
          <Input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleInputChange} required />
          <Button className="w-full" onClick={handleSubmit}>Login</Button>
          <Button className="w-full" onClick={() => setIsRegistering(true)}>Switch to Register</Button>
        </div>
      );
    }

    switch (step) {
      case 1:
        return (
          <div className="w-full max-w-md space-y-4">
            <Input name="name" placeholder="Name" value={formData.name} onChange={handleInputChange} required />
            <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
            <Input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleInputChange} required />
            <Input name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleInputChange} required />
            <Input name="dateOfBirth" type="date" placeholder="Date of Birth" value={formData.dateOfBirth} onChange={handleInputChange} required />
            <Button className="w-full" onClick={handleNext}>Next</Button>
            <Button className="w-full" onClick={() => setIsRegistering(false)}>Switch to Login</Button>
          </div>
        );
      case 2:
        return (
          <div className="w-full max-w-md space-y-4">
            <Label>Upload ID Picture</Label>
            <Input type="file" accept="image/*" onChange={handleFileChange} required />
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        );
      case 3:
        return (
          <div className="w-full max-w-md space-y-4">
            <Label>Sex</Label>
            <RadioGroup onValueChange={handleSexChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" checked={formData.sex === 'male'} />
                <Label htmlFor="male">Male</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" checked={formData.sex === 'female'} />
                <Label htmlFor="female">Female</Label>
              </div>
            </RadioGroup>
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        );
      case 4:
        return (
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
        );
      case 5:
        return (
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
        );
      case 6:
        return (
          <div className="w-full max-w-md space-y-4">
            <Label>Profile Picture (Optional)</Label>
            <InteractableProfilePicture
              currentImage={profilePicture}
              onImageChange={handleProfilePictureChange}
            />
            <Button className="w-full" onClick={handleSubmit}>Register</Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute inset-0 border-8 border-green-500 animate-border-rotate"></div>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-4xl font-bold text-green-500 mb-8">Sports Queue</h1>
        {renderAuthForm()}
      </div>
    </div>
  );
};

export default AuthScreen;