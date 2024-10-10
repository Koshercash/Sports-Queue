import mongoose from 'mongoose';

const GameSchema = new mongoose.Schema({
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  gameMode: String,
  status: { type: String, enum: ['lobby', 'inProgress', 'ended'], default: 'lobby' },
  startTime: Date,
  endTime: Date,
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' }
});

export const Game = mongoose.model('Game', GameSchema);