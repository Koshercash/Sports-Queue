const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Field = require('../models/Field'); // Adjust the path as needed

const MAPBOX_API_KEY = 'your_mapbox_api_key_here';

async function fetchAndSaveFieldImage(field) {
  try {
    const [lon, lat] = field.location.coordinates;
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon},${lat},15,0/300x300?access_token=${MAPBOX_API_KEY}`;
    
    const response = await axios({
      url,
      responseType: 'stream'
    });

    const imagePath = path.join(__dirname, '..', 'uploads', `field_${field._id}.jpg`);
    const writer = fs.createWriteStream(imagePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    }).then(() => {
      field.imagePath = `field_${field._id}.jpg`;
      return field.save();
    });
  } catch (error) {
    console.error(`Error fetching image for field ${field._id}:`, error);
  }
}

async function fetchAllFieldImages() {
  await mongoose.connect('your_mongodb_connection_string_here');
  
  const fields = await Field.find({ imagePath: { $exists: false } });
  
  for (const field of fields) {
    await fetchAndSaveFieldImage(field);
    console.log(`Processed field ${field._id}`);
  }

  await mongoose.disconnect();
}

fetchAllFieldImages().then(() => console.log('Finished fetching field images'));