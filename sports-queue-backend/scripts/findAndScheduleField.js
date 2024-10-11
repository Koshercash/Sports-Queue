import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Field } from '../models/Field.js';
import { Game } from '../models/Game.js'; // Assuming you have a Game model
import { getDistance } from 'geolib'; // Make sure to install geolib: npm install geolib

dotenv.config();

export async function findAndScheduleField(players, gameMode, duration = 60) {
  try {
    const centerLat = players.reduce((sum, p) => sum + (p.location?.coordinates[1] || 0), 0) / players.length;
    const centerLon = players.reduce((sum, p) => sum + (p.location?.coordinates[0] || 0), 0) / players.length;

    console.log('Center coordinates:', { centerLat, centerLon });

    const now = new Date();
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

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
      
      // Calculate the furthest player's travel time
      const furthestTravelTime = calculateFurthestTravelTime(players, field);
      console.log(`Furthest travel time: ${furthestTravelTime} minutes`);

      // Earliest possible start time considering travel
      const earliestPossibleStart = new Date(now.getTime() + furthestTravelTime * 60000 + 10 * 60000); // Add 10 minutes buffer
      console.log(`Earliest possible start time: ${earliestPossibleStart}`);

      if (!field.availability || field.availability.length === 0) {
        console.log(`Field ${field.name} has no availability data`);
        continue;
      }

      for (const av of field.availability) {
        if (av.date > fourHoursLater) {
          console.log(`Availability date too far in the future: ${av.date}`);
          continue;
        }

        if (!av.slots || av.slots.length === 0) {
          console.log(`No slots available for date: ${av.date}`);
          continue;
        }

        for (const slot of av.slots) {
          if (slot.startTime < earliestPossibleStart) {
            console.log(`Slot too early considering travel time: ${slot.startTime}`);
            continue;
          }

          if (slot.startTime > fourHoursLater) {
            console.log(`Slot too far in the future: ${slot.startTime}`);
            continue;
          }

          if (!slot.isAvailable) {
            console.log(`Slot not available: ${slot.startTime} - ${slot.endTime}`);
            continue;
          }

          console.log(`Checking slot: ${slot.startTime} - ${slot.endTime}`);

          const conflictingGame = await Game.findOne({
            field: field._id,
            $or: [
              { startTime: { $lt: slot.endTime, $gte: slot.startTime } },
              { endTime: { $gt: slot.startTime, $lte: slot.endTime } }
            ]
          });

          if (conflictingGame) {
            console.log(`Slot rejected due to conflicting game`);
            continue;
          }

          const previousGame = await Game.findOne({
            field: field._id,
            endTime: { $lt: slot.startTime }
          }).sort({ endTime: -1 });

          const nextGame = await Game.findOne({
            field: field._id,
            startTime: { $gt: slot.endTime }
          }).sort({ startTime: 1 });

          if ((!previousGame || (slot.startTime - previousGame.endTime) >= 3600000) &&
              (!nextGame || (nextGame.startTime - slot.endTime) >= 3600000)) {
            console.log(`Found available slot: ${slot.startTime} - ${slot.endTime}`);
            return {
              field: field,
              startTime: slot.startTime,
              endTime: new Date(slot.startTime.getTime() + duration * 60000),
              availabilityIndex: field.availability.indexOf(av),
              slotIndex: av.slots.indexOf(slot)
            };
          } else {
            console.log(`Slot rejected due to insufficient time between games`);
          }
        }
      }
    }

    console.log('No available time slots found within the next 4 hours');
    return null;
  } catch (error) {
    console.error('Error finding and scheduling field:', error);
    return null;
  }
}

function calculateFurthestTravelTime(players, field) {
  let maxTravelTime = 0;
  const fieldCoords = { latitude: field.location.coordinates[1], longitude: field.location.coordinates[0] };

  players.forEach(player => {
    if (player.location && player.location.coordinates) {
      const playerCoords = { latitude: player.location.coordinates[1], longitude: player.location.coordinates[0] };
      const distanceInMeters = getDistance(playerCoords, fieldCoords);
      const travelTimeMinutes = Math.ceil(distanceInMeters / 833.33); // Assuming average speed of 50 km/h
      maxTravelTime = Math.max(maxTravelTime, travelTimeMinutes);
    }
  });

  return maxTravelTime;
}