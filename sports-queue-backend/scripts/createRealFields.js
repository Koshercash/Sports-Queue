import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Field } from '../models/Field.js';
import { fetchFieldData } from './fetchFieldData.js';
import { fetchAndSaveFieldImage } from './fetchFieldImages.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createRealFields = async (centerLat, centerLng) => {
  try {
    console.log(`Creating fields around center point: ${centerLat}, ${centerLng}`);
    // Delete existing fields
    await Field.deleteMany({});
    console.log('Existing fields deleted');

    const fieldsData = await fetchFieldData(centerLat, centerLng);
    console.log(`Fetched ${fieldsData.length} fields from Mapbox`);

    for (const fieldData of fieldsData) {
      const { name, latitude, longitude, size, placeId } = fieldData;
      const availability = generateAvailability();
      const imageUrl = await fetchAndSaveFieldImage(placeId, name, longitude, latitude);
      console.log(`Image URL for ${name}: ${imageUrl}`);

      const newField = new Field({
        name,
        location: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        size,
        availability,
        imageUrl: imageUrl || null
      });

      await newField.save();
      console.log(`Field ${newField.name} created with availability:`, availability);
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