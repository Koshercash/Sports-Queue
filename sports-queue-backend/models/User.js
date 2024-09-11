const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  sex: { type: String, required: true },
  position: { type: String, required: true },
  skillLevel: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  profilePicture: { type: String, default: null }
});

module.exports = mongoose.model('User', userSchema);