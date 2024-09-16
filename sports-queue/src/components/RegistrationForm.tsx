import React, { useState } from 'react';
import { InteractableProfilePicture } from './InteractableProfilePicture';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface RegistrationFormProps {
  onSubmit: (formData: FormData) => void;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  profilePicture: File | null;
  cityTown: string; // Add this line
  // Add other fields as needed
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    profilePicture: null,
    cityTown: '', // Add this line
    // Initialize other fields
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfilePictureChange = (file: File) => {
    setFormData(prev => ({ ...prev, profilePicture: file }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <Input
        type="text"
        name="name"
        value={formData.name}
        onChange={handleInputChange}
        placeholder="Name"
        required
      />
      <Input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleInputChange}
        placeholder="Email"
        required
      />
      <Input
        type="password"
        name="password"
        value={formData.password}
        onChange={handleInputChange}
        placeholder="Password"
        required
      />
      <Input
        type="text"
        name="cityTown"
        value={formData.cityTown}
        onChange={handleInputChange}
        placeholder="City/Town"
        required
      />
      <div className="flex flex-col items-center space-y-2">
        <div className="w-40 h-40">
          <InteractableProfilePicture
            currentImage={formData.profilePicture ? URL.createObjectURL(formData.profilePicture) : null}
            onImageChange={handleProfilePictureChange}
            size="custom"
            customSize="w-full h-full"
          />
        </div>
        <span className="text-sm text-gray-600">Profile Picture</span>
      </div>
      {/* Add other form fields as needed */}
      <Button type="submit" className="w-full">Register</Button>
    </form>
  );
};