'use client';

import React, { useState } from 'react';
import { InteractableProfilePicture } from '../../components/InteractableProfilePicture';
import styles from './styles.module.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [sex, setSex] = useState('');
  const [position, setPosition] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [idPicture, setIdPicture] = useState<File | null>(null);
  const router = useRouter();

  const handleProfilePictureChange = (file: File | null) => {
    setProfilePicture(file);
  };

  const handleIdPictureChange = (file: File | null) => {
    setIdPicture(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('phone', phone);
      formData.append('sex', sex);
      formData.append('position', position);
      formData.append('skillLevel', skillLevel);
      formData.append('dateOfBirth', dateOfBirth);
      if (profilePicture) formData.append('profilePicture', profilePicture);
      if (idPicture) formData.append('idPicture', idPicture);

      const response = await axios.post('http://localhost:3002/api/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      localStorage.setItem('token', response.data.token);
      router.push('/main');
    } catch (error) {
      console.error('Registration failed:', error);
      // Handle error (e.g., show error message to user)
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={styles.registrationProfilePicture}>
          <InteractableProfilePicture
            currentImage={profilePicture ? URL.createObjectURL(profilePicture) : null}
            onImageChange={handleProfilePictureChange}
          />
        </div>
        <Input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <select value={sex} onChange={(e) => setSex(e.target.value)} required className="w-full p-2 border rounded">
          <option value="">Select Sex</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <Input type="text" placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} required />
        <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} required className="w-full p-2 border rounded">
          <option value="">Select Skill Level</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <Input type="date" placeholder="Date of Birth" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
        <div>
          <label className="block mb-2">ID Picture:</label>
          <input type="file" onChange={(e) => handleIdPictureChange(e.target.files ? e.target.files[0] : null)} accept="image/*" />
        </div>
        <Button type="submit">Register</Button>
      </form>
    </div>
  );
}