import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

export async function fetchAndSaveFieldImage(placeId, fieldName, longitude, latitude) {
  try {
    const imageUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${longitude},${latitude},15,0/400x400@2x?access_token=${MAPBOX_ACCESS_TOKEN}`;
    
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

    const imageName = `${fieldName.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    const uploadDir = path.join(__dirname, '..', 'uploads', 'fields');
    const imagePath = path.join(uploadDir, imageName);
    
    // Create the directory if it doesn't exist
    await fs.mkdir(uploadDir, { recursive: true });
    
    await fs.writeFile(imagePath, response.data);

    console.log(`Image saved for ${fieldName} at ${imagePath}`);

    return `/uploads/fields/${imageName}`;
  } catch (error) {
    console.error(`Error fetching image for ${fieldName}:`, error);
    return null;
  }
}