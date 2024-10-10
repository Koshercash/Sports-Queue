import mongoose from 'mongoose';

const FieldSchema = new mongoose.Schema({
  name: String,
  size: { type: String, enum: ['5v5', '11v11', 'both'] },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }
  },
  availability: [{
    date: Date,
    slots: [{
      startTime: Date,
      endTime: Date,
      isAvailable: Boolean
    }]
  }],
  imageUrl: String
});

FieldSchema.index({ location: '2dsphere' });

export const Field = mongoose.model('Field', FieldSchema);