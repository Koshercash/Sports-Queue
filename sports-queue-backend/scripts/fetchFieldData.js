import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

export async function fetchFieldData(latitude, longitude, radius = 10000) {
  try {
    const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/soccer%20field.json`, {
      params: {
        access_token: MAPBOX_ACCESS_TOKEN,
        proximity: `${longitude},${latitude}`,
        types: 'poi',
        limit: 10,
        radius: radius
      }
    });

    return response.data.features.map(place => ({
      name: place.text,
      latitude: place.center[1],
      longitude: place.center[0],
      size: 'both', // Default size, you might want to determine this based on additional data
      placeId: place.id
    }));
  } catch (error) {
    console.error('Error fetching field data:', error);
    return [];
  }
}