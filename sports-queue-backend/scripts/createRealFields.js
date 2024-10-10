import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Field } from '../models/Field.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createRealFields = async () => {
  try {
    // Read real field data from a JSON file
    const fieldsData = JSON.parse(
      await fs.readFile(path.join(__dirname, 'realFieldsData.json'), 'utf8')
    );

    for (const field of fieldsData) {
      const newField = new Field({
        name: field.name,
        size: field.size,
        location: {
          type: 'Point',
          coordinates: [field.longitude, field.latitude],
        },
        availability: generateAvailability(),
        imageUrl: `/uploads/fields/${field.name.toLowerCase().replace(/\s+/g, '-')}.jpg` // Assuming you have these images
      });

      await newField.save();
      console.log(`Field ${field.name} created`);
    }

    console.log('All fields created successfully');
  } catch (error) {
    console.error('Error creating real fields:', error);
  }
};

const generateAvailability = () => {
  const availability = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) { // Generate availability for the next 7 days
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0); // Set to start of day
    const slots = [];
    for (let hour = 0; hour < 24; hour++) { // Generate slots for all 24 hours
      const startTime = new Date(date);
      startTime.setHours(hour);
      const endTime = new Date(startTime);
      endTime.setHours(hour + 1);
      slots.push({
        startTime,
        endTime,
        isAvailable: Math.random() > 0.3, // 70% chance of being available
      });
    }
    availability.push({ date, slots });
  }
  return availability;
};

// Uncomment the following line if you want to run this script directly
// createRealFields();