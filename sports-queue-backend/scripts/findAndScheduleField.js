import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Field } from '../models/Field.js';
import { Game } from '../models/Game.js'; // Assuming you have a Game model
import { getDistance } from 'geolib'; // Make sure to install geolib: npm install geolib

dotenv.config();

export async function findAndScheduleField(players, gameMode, duration = 60) {
  try {
    console.log('Current server time:', new Date().toISOString());

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

    if (fields.length === 0) {
      console.log('No suitable fields found within 50 miles');
      return null;
    }

    const earliestPossibleStartTime = calculateEarliestStartTime(players, fields[0].location);
    console.log(`Earliest possible start time: ${earliestPossibleStartTime.toISOString()}`);

    let bestSlot = null;
    let bestField = null;

    for (const field of fields) {
      console.log(`Checking field: ${field.name}`);

      if (!field.availability || field.availability.length === 0) {
        console.log(`Field ${field.name} has no availability data`);
        continue;
      }

      field.availability.sort((a, b) => a.date - b.date);

      for (const av of field.availability) {
        if (av.date > fourHoursLater) {
          console.log(`Availability date too far in the future: ${av.date}`);
          break;
        }

        if (!av.slots || av.slots.length === 0) {
          console.log(`No slots available for date: ${av.date}`);
          continue;
        }

        av.slots.sort((a, b) => a.startTime - b.startTime);

        for (const slot of av.slots) {
          if (slot.startTime >= earliestPossibleStartTime && 
              slot.startTime <= fourHoursLater &&
              slot.isAvailable) {
            console.log(`Evaluating slot: ${slot.startTime.toISOString()} - ${slot.endTime.toISOString()}`);

            const conflictingGame = await Game.findOne({
              field: field._id,
              status: { $in: ['lobby', 'inProgress'] },
              $or: [
                { startTime: { $lt: slot.endTime, $gte: slot.startTime } },
                { endTime: { $gt: slot.startTime, $lte: slot.endTime } }
              ]
            });

            if (conflictingGame) {
              console.log(`Slot rejected due to conflicting active game`);
              continue;
            }

            if (!bestSlot || slot.startTime < bestSlot.startTime) {
              bestSlot = slot;
              bestField = field;
              console.log(`New best slot found: ${bestSlot.startTime.toISOString()} at ${bestField.name}`);
            }

            if (slot.startTime <= new Date(now.getTime() + 30 * 60000)) {
              console.log(`Found slot within next 30 minutes, using immediately`);
              return createScheduleResult(field, slot, av, duration);
            }
          } else {
            console.log(`Slot rejected: startTime=${slot.startTime.toISOString()}, isAvailable=${slot.isAvailable}`);
          }
        }
      }
    }

    if (bestSlot && bestField) {
      console.log(`Using best slot found: ${bestSlot.startTime.toISOString()} at ${bestField.name}`);
      return createScheduleResult(bestField, bestSlot, bestField.availability.find(av => av.slots.includes(bestSlot)), duration);
    }

    console.log('No available time slots found within the next 2 hours');
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

  // Reduce buffer time to 10 minutes
  const bufferMinutes = 10;
  const totalMinutes = Math.max(15, maxTravelTime + bufferMinutes); // Minimum 15 minutes from now

  const now = new Date();
  const earliestStartTime = new Date(now.getTime() + totalMinutes * 60000);

  // Round up to the nearest 5 minutes
  earliestStartTime.setMinutes(Math.ceil(earliestStartTime.getMinutes() / 5) * 5);

  console.log(`Calculated earliest start time: ${earliestStartTime.toISOString()}`);
  return earliestStartTime;
}

function createScheduleResult(field, slot, availability, duration) {
  return {
    field: field,
    startTime: slot.startTime,
    endTime: new Date(slot.startTime.getTime() + duration * 60000),
    availabilityIndex: field.availability.indexOf(availability),
    slotIndex: availability.slots.indexOf(slot)
  };
}
