'use client';  // Add this line at the top of the file

import React, { useState, ChangeEvent } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { InteractableProfilePicture } from '@/components/InteractableProfilePicture';
import { useSearchParams } from 'next/navigation';

export default function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showRegister = searchParams.get('register') === 'true';
  const [isRegistering, setIsRegistering] = useState(showRegister);
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    idPicture: null as File | null,
    sex: '',
    position: '',
    secondaryPosition: '',
    skillLevel: '',
    dateOfBirth: '',
    profilePicture: null as File | null,
    cityTown: '',
  })

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleLoginInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value })
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
        return formData.name && formData.email && formData.password && formData.phone && formData.dateOfBirth && formData.cityTown && isOver16(formData.dateOfBirth)
      case 2:
        return formData.idPicture
      case 3:
        return formData.sex
      case 4:
        return formData.position && formData.secondaryPosition && formData.position !== formData.secondaryPosition
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
            } else if (key === 'secondaryPosition') {
              // Ensure secondaryPosition is a string
              formDataToSend.append(key, value as string);
            } else {
              formDataToSend.append(key, value as string | Blob);
            }
          }
        });

        console.log('Form data being sent:', Object.fromEntries(formDataToSend));

        const response = await axios.post('http://localhost:3002/api/register', formDataToSend, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3002/api/login', loginData);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        router.push('/main');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please check your credentials.');
    }
  };

  const handlePositionChange = (value: string, isSecondary: boolean) => {
    if (isSecondary) {
      if (value === formData.position) {
        alert("Secondary position cannot be the same as primary position.");
        return;
      }
      setFormData(prev => ({ ...prev, secondaryPosition: value }));
    } else {
      if (value === formData.secondaryPosition) {
        setFormData(prev => ({ ...prev, position: value, secondaryPosition: '' }));
      } else {
        setFormData(prev => ({ ...prev, position: value }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute inset-0 border-8 border-green-500 animate-border-rotate"></div>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-4xl font-bold text-green-500 mb-8">Sports Queue</h1>
        {!isRegistering ? (
          <div className="w-full max-w-md space-y-4">
            <Input name="email" type="email" placeholder="Email" value={loginData.email} onChange={handleLoginInputChange} required />
            <Input name="password" type="password" placeholder="Password" value={loginData.password} onChange={handleLoginInputChange} required />
            <Button className="w-full" onClick={handleLogin}>Login</Button>
            <Button className="w-full" onClick={() => setIsRegistering(true)}>Register</Button>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div className="w-full max-w-md space-y-4">
                <Input name="name" placeholder="Name" value={formData.name} onChange={handleInputChange} required />
                <Input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
                <Input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleInputChange} required />
                <Input name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleInputChange} required />
                <Input name="cityTown" placeholder="City/Town" value={formData.cityTown} onChange={handleInputChange} required />
                <Input name="dateOfBirth" type="date" placeholder="Date of Birth" value={formData.dateOfBirth} onChange={handleInputChange} required />
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
              <div className="w-full max-w-md space-y-8">
                <div className="space-y-2 bg-white p-4 rounded-lg shadow-md relative z-20">
                  <Label className="text-lg font-semibold">Primary Position</Label>
                  <Select onValueChange={(value) => handlePositionChange(value, false)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary position" />
                    </SelectTrigger>
                    <div className="z-30">
                      <SelectContent>
                        {["goalkeeper", "fullback", "centerback", "winger", "midfielder", "striker"].filter(pos => pos !== formData.secondaryPosition).map((pos) => (
                          <SelectItem key={pos} value={pos}>
                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </div>
                  </Select>
                </div>
                <div className="space-y-2 bg-white p-4 rounded-lg shadow-md relative z-10">
                  <Label className="text-lg font-semibold">Secondary Position</Label>
                  <Select onValueChange={(value) => handlePositionChange(value, true)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select secondary position" />
                    </SelectTrigger>
                    <SelectContent>
                      {["goalkeeper", "fullback", "centerback", "winger", "midfielder", "striker"].filter(pos => pos !== formData.position).map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={handleNext}
                  disabled={!formData.position || !formData.secondaryPosition || formData.position === formData.secondaryPosition}
                >
                  Next
                </Button>
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
            <div className="w-full max-w-md mt-4">
              <Button 
                className="w-full"
                onClick={() => setIsRegistering(false)}
              >
                Back to Login
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}