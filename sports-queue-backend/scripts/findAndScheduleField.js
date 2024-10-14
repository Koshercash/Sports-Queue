import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Field } from '../models/Field.js';
import { Game } from '../models/Game.js'; // Assuming you have a Game model
import { getDistance } from 'geolib'; // Make sure to install geolib: npm install geolib

dotenv.config();

export async function findAndScheduleField(players, gameMode, duration = 60) {
  try {
    console.log('Current server time:', new Date().toISOString());
    console.log('Current server local time:', new Date().toString());

    const centerLat = players.reduce((sum, p) => sum + (p.location?.coordinates[1] || 0), 0) / players.length;
    const centerLon = players.reduce((sum, p) => sum + (p.location?.coordinates[0] || 0), 0) / players.length;

    console.log('Center coordinates:', { centerLat, centerLon });

    const now = new Date();
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    let fields = [];
    let searchRadius = 10000; // Start with a 10km radius
    const maxRadius = 80467; // 50 miles in meters

    while (fields.length === 0 && searchRadius <= maxRadius) {
      fields = await Field.find({
        size: { $in: [gameMode, 'both'] },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [centerLon, centerLat]
            },
            $maxDistance: searchRadius
          }
        }
      }).sort('location');

      console.log(`Found ${fields.length} potential fields within ${searchRadius / 1609.34} miles`);
      
      if (fields.length === 0) {
        searchRadius *= 2; // Double the search radius
      }
    }

    fields.forEach(field => {
      console.log(`Field: ${field.name}, Size: ${field.size}, Location: [${field.location.coordinates}]`);
    });

    if (fields.length === 0) {
      console.log('No suitable fields found within 50 miles');
      return null;
    }

    for (const field of fields) {
      console.log(`Checking field: ${field.name}`);
      
      const earliestPossibleStartTime = calculateEarliestStartTime(players, field.location);
      console.log(`Earliest possible start time: ${earliestPossibleStartTime.toISOString()}`);

      if (!field.availability || field.availability.length === 0) {
        console.log(`Field ${field.name} has no availability data`);
        continue;
      }

      for (const av of field.availability) {
        if (av.date > sixHoursLater) {
          console.log(`Availability date too far in the future: ${av.date}`);
          continue;
        }

        if (!av.slots || av.slots.length === 0) {
          console.log(`No slots available for date: ${av.date}`);
          continue;
        }

        // Find the first slot that starts after the earliestPossibleStartTime
        const suitableSlot = av.slots.find(slot => 
          slot.startTime >= earliestPossibleStartTime && 
          slot.startTime <= sixHoursLater &&
          slot.isAvailable
        );

        if (suitableSlot) {
          console.log(`Found suitable slot: ${suitableSlot.startTime.toISOString()} - ${suitableSlot.endTime.toISOString()}`);

          // Check for conflicting games
          const conflictingGame = await Game.findOne({
            field: field._id,
            $or: [
              { startTime: { $lt: suitableSlot.endTime, $gte: suitableSlot.startTime } },
              { endTime: { $gt: suitableSlot.startTime, $lte: suitableSlot.endTime } }
            ]
          });

          if (conflictingGame) {
            console.log(`Slot rejected due to conflicting game`);
            continue;
          }

          // If we've reached this point, we've found a suitable slot
          return {
            field: field,
            startTime: suitableSlot.startTime,
            endTime: new Date(suitableSlot.startTime.getTime() + duration * 60000),
            availabilityIndex: field.availability.indexOf(av),
            slotIndex: av.slots.indexOf(suitableSlot)
          };
        }
      }
    }

    console.log('No available time slots found within the next 6 hours');
    return null;
  } catch (error) {
    console.error('Error finding and scheduling field:', error);
    return null;
  }
}

function calculateEarliestStartTime(players, fieldLocation) {
  let maxTravelTime = 0;
  players.forEach(player => {
    if (player.location && player.location.coordinates) {
      const distance = getDistance(
        { latitude: player.location.coordinates[1], longitude: player.location.coordinates[0] },
        { latitude: fieldLocation.coordinates[1], longitude: fieldLocation.coordinates[0] }
      );
      // Assume average speed of 50 km/h, convert distance to km
      const travelTimeMinutes = Math.ceil((distance / 1000) / (50 / 60));
      if (travelTimeMinutes > maxTravelTime) {
        maxTravelTime = travelTimeMinutes;
      }
    }
  });

  // Add 15 minutes buffer to the max travel time
  const bufferMinutes = 15;
  const totalMinutes = maxTravelTime + bufferMinutes;

  const now = new Date();
  const earliestStartTime = new Date(now.getTime() + totalMinutes * 60000);

  // Round up to the nearest 5 minutes
  earliestStartTime.setMinutes(Math.ceil(earliestStartTime.getMinutes() / 5) * 5);

  console.log(`Calculated earliest start time: ${earliestStartTime.toISOString()}`);
  return earliestStartTime;
}
