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
  cityTown: string;
  phone: string;
  sex: string;
  position: string;
  skillLevel: string;
  dateOfBirth: string;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    profilePicture: null,
    cityTown: '',
    phone: '',
    sex: '',
    position: '',
    skillLevel: '',
    dateOfBirth: '',
  });

  const [step, setStep] = useState(1);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleNextStep = () => {
    if (formData.name && formData.email && formData.password) {
      setStep(2);
    } else {
      alert("Please fill in all required fields.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      {step === 1 && (
        <>
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
          <Button type="button" onClick={handleNextStep} className="w-full">Next</Button>
        </>
      )}
      {step === 2 && (
        <>
          <Input
            type="text"
            name="cityTown"
            value={formData.cityTown}
            onChange={handleInputChange}
            placeholder="City/Town"
            required
          />
          <Input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Phone Number"
            required
          />
          <select
            name="sex"
            value={formData.sex}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Sex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <Input
            type="text"
            name="position"
            value={formData.position}
            onChange={handleInputChange}
            placeholder="Position"
            required
          />
          <select
            name="skillLevel"
            value={formData.skillLevel}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Skill Level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="pro">Professional</option>
          </select>
          <Input
            type="date"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleInputChange}
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
          <div className="flex space-x-2">
            <Button type="button" onClick={() => setStep(1)} className="w-1/2">Back</Button>
            <Button type="submit" className="w-1/2">Register</Button>
          </div>
        </>
      )}
    </form>
  );
};