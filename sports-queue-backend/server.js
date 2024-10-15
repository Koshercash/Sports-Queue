import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { MongoMemoryServer } from 'mongodb-memory-server';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { WebSocketServer } from 'ws';
import http from 'http';
import axios from 'axios';
import { DateTime } from 'luxon';
import { getDistance, computeDestinationPoint } from 'geolib';
import { createRealFields } from './scripts/createRealFields.js';
import { findAndScheduleField } from './scripts/findAndScheduleField.js';
import { Game } from './models/Game.js';
import { Field } from './models/Field.js';
import webpush from 'web-push';

dotenv.config();

// Add this line
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: 'uploads/' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

webpush.setVapidDetails(
  'https://localhost:3000', // Replace with your actual domain
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // or whatever your frontend URL is
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const activeConnections = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'auth') {
        ws.userId = data.userId;
        activeConnections.set(data.userId, ws);
        console.log(`WebSocket authenticated for user ${data.userId}`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    if (ws.userId) {
      activeConnections.delete(ws.userId);
      console.log(`WebSocket connection closed for user ${ws.userId}`);
    }
  });
});

async function startServer() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to in-memory MongoDB');

  // Define all schemas and models first
  const UserSchema = new mongoose.Schema({
    isAdmin: { type: Boolean, default: false },
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    sex: String,
    position: String,
    secondaryPosition: String,
    skillLevel: String,
    mmr5v5: Number,
    mmr11v11: Number,
    idPicture: String,
    dateOfBirth: Date,
    profilePicturePath: String,
    bio: { type: String, default: '' },
    cityTown: String,
    location: {
      type: { type: String, enum: ['Point'], required: false, default: 'Point' },
      coordinates: { type: [Number], required: false, default: [0, 0] }
    },
    pushSubscription: {
      endpoint: String,
      keys: {
        p256dh: String,
        auth: String
      }
    }
  });

  // Create User model
  const User = mongoose.model('User', UserSchema);

  // Now define updateExistingUsers function
  async function updateExistingUsers() {
    try {
      await User.updateMany(
        { location: { $exists: false } },
        { $set: { location: { type: 'Point', coordinates: [0, 0] } } }
      );
      console.log('Updated existing users with default location');
    } catch (error) {
      console.error('Error updating existing users:', error);
    }
  }

  // Call updateExistingUsers after User model is defined
  await updateExistingUsers();

  const FriendSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'] }
  });

  const QueueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gameMode: String,
    timestamp: { type: Date, default: Date.now }
  });

  const PenaltySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    leaveCount: { type: Number, default: 0 },
    lastLeavePenaltyDate: Date,
    penaltyEndTime: Date
  });

  const ReportSchema = new mongoose.Schema({
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportingUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
    reason: String,
    timestamp: { type: Date, default: Date.now }
  });

  const BanSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    stage: { type: Number, default: 0 }, // 0: No ban, 1: Warning, 2: 1 day, 3: 7 days, 4: Permanent
    expiresAt: Date,
    lastProgressedAt: Date
  });

  const BanAppealSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  });

  const FieldSchema = new mongoose.Schema({
    name: String,
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }
    },
    size: { type: String, enum: ['5v5', '11v11', 'both'] },
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

  const ScheduledGameSchema = new mongoose.Schema({
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
    startTime: Date,
    endTime: Date,
    gameMode: String
  });

  FieldSchema.index({ location: '2dsphere' });

  // Create models
  const Friend = mongoose.model('Friend', FriendSchema);
  const Queue = mongoose.model('Queue', QueueSchema);
  const Penalty = mongoose.model('Penalty', PenaltySchema);
  const Report = mongoose.model('Report', ReportSchema);
  const Ban = mongoose.model('Ban', BanSchema);
  const BanAppeal = mongoose.model('BanAppeal', BanAppealSchema);
  const ScheduledGame = mongoose.model('ScheduledGame', ScheduledGameSchema);

  // Create indexes after models are defined
  await Queue.collection.createIndex({ gameMode: 1, 'userId.position': 1, 'userId.secondaryPosition': 1, 'userId.mmr5v5': 1, 'userId.mmr11v11': 1, joinedAt: 1 });

  // Add this new function to check if a player has been reported too many times
  async function checkReportThreshold(reportingUserId) {
    const recentReports = await Report.countDocuments({
      reportingUser: reportingUserId,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });
    return recentReports >= 10; // Threshold of 10 reports per week
  }

  // Modify the handleReport function
  async function handleReport(reportedUserId, reportingUserId, gameId, reason) {
    // Check if the reporting user has exceeded the report threshold
    const hasExceededThreshold = await checkReportThreshold(reportingUserId);
  
    // Check if this player has already been reported by the reporting user for this game
    const existingReport = await Report.findOne({
      reportedUser: reportedUserId,
      reportingUser: reportingUserId,
      game: gameId
    });
  
    if (existingReport) {
      throw new Error('You have already reported this player for this game');
    }
  
    // Validate reportedUserId and gameId
    const reportedUser = await User.findById(reportedUserId);
    const game = await Game.findById(gameId);
  
    if (!reportedUser || !game) {
      throw new Error('Invalid reportedUserId or gameId');
    }
  
    const newReport = new Report({
      reportedUser: reportedUserId,
      reportingUser: reportingUserId,
      game: gameId,
      reason,
      weight: hasExceededThreshold ? 0.5 : 1 // Reduce weight if threshold exceeded
    });
    await newReport.save();
  
    const reportsCount = await Report.aggregate([
      { $match: { reportedUser: mongoose.Types.ObjectId(reportedUserId), game: mongoose.Types.ObjectId(gameId) } },
      { $group: { _id: "$reason", totalWeight: { $sum: "$weight" } } }
    ]);
  
    const physicalFightReports = reportsCount.find(r => r._id === 'physical_fight');
    const physicalFightWeight = physicalFightReports ? physicalFightReports.totalWeight : 0;
  
    if (physicalFightWeight >= 6) {
      await progressBanStage(reportedUserId, true); // Permanent ban for 6+ physical fight reports
      console.log(`User ${reportedUserId} permanently banned due to ${physicalFightWeight} physical fight reports in game ${gameId}`);
    } else {
      const totalWeight = reportsCount.reduce((sum, report) => sum + report.totalWeight, 0);
      if (totalWeight >= 3) {
        await progressBanStage(reportedUserId, false);
        console.log(`User ${reportedUserId} ban stage progressed due to ${totalWeight} weighted reports in game ${gameId}`);
      }
    }
  }
  async function createAdminUser() {
    const adminEmail = process.env.ADMIN_EMAIL || 'Reuven5771@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Remember4';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const adminUser = new User({
        name: 'Admin User',
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true,
        phone: '1234567890',
        sex: 'other',
        position: 'admin',
        skillLevel: 'pro',
        dateOfBirth: new Date('1990-01-01'),
        cityTown: 'Admin City',
      });
      await adminUser.save();
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }
  }
  
  async function progressBanStage(userId, isPhysicalFight = false) {
    let ban = await Ban.findOne({ user: userId });
    if (!ban) {
      ban = new Ban({ user: userId });
    }
  
    if (isPhysicalFight) {
      ban.stage = 4; // Permanent ban
    } else {
      ban.stage = Math.min(ban.stage + 1, 4);
    }
  
    ban.lastProgressedAt = new Date();
  
    switch (ban.stage) {
      case 1:
        ban.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week for warning
        break;
      case 2:
        ban.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day ban
        break;
      case 3:
        ban.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 day ban
        break;
      case 4:
        ban.expiresAt = null; // Permanent ban
        break;
    }
  
    await ban.save();

    // Call notifyUserAboutBan after saving the ban
    await notifyUserAboutBan(userId, ban.stage, ban.expiresAt);
    console.log(`User ${userId} banned at stage ${ban.stage} until ${ban.expiresAt}`);
  }

  async function notifyUserAboutBan(userId, banStage, expiresAt) {
    // Implement the notification logic here
    // This could involve sending an email, push notification, or updating a user's notification list
    console.log(`Notifying user ${userId} about ban stage ${banStage} expiring at ${expiresAt}`);
    // For now, we'll just log the notification. You can expand this function later to actually send notifications.
  }

  async function checkAndResetBanStage() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await Ban.updateMany(
      { lastProgressedAt: { $lt: oneWeekAgo }, stage: { $lt: 4 } },
      { $set: { stage: 0, expiresAt: null } }
    );
  }

  async function checkUserPenalty(userId) {
    const penalty = await Penalty.findOne({ userId });
    if (penalty && penalty.penaltyEndTime && new Date() < penalty.penaltyEndTime) {
      return penalty.penaltyEndTime;
    }
    return null;
  }
  
  // Add a new function to create real fields (you'll need to implement this)
  async function initializeFields() {
    const fieldsCount = await Field.countDocuments();
    console.log(`Current field count: ${fieldsCount}`);
    if (fieldsCount === 0) {
      console.log('No fields found. Fields will be created when a match is found.');
    } else {
      console.log(`${fieldsCount} fields exist in the database.`);
    }
  }

  // Call initializeFields
  await initializeFields();

  app.post('/api/register', upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'idPicture', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const { name, email, password, phone, sex, position, secondaryPosition, skillLevel, dateOfBirth, cityTown } = req.body; // Add cityTown here
      
      // Log received data for debugging
      console.log('Received registration data:', { name, email, phone, sex, position,secondaryPosition, skillLevel, dateOfBirth, cityTown });
      console.log('Files:', req.files);

      // Check if user is over 16
      const dob = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      if (age < 16) {
        return res.status(400).json({ error: 'You must be 16 years or older to register.' });
      }

      // Check if all required fields are present
      if (!name || !email || !password || !phone || !sex || !position || !skillLevel || !dateOfBirth || !cityTown) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const mmr = getMMRFromSkillLevel(skillLevel);
      const user = new User({
        name,
        email,
        password: hashedPassword,
        phone,
        sex,
        position,
        secondaryPosition,
        skillLevel,
        mmr5v5: mmr,
        mmr11v11: mmr,
        dateOfBirth: dob,
        cityTown: Array.isArray(cityTown) ? cityTown[0] : cityTown, // Ensure cityTown is a string
        profilePicturePath: req.files.profilePicture ? req.files.profilePicture[0].filename : null,
        idPicture: req.files.idPicture ? req.files.idPicture[0].filename : null,
      });

      await user.save();
      const token = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '1d' }
      );
      res.status(201).json({ token });
    } catch (error) {
      console.error('Detailed registration error:', error);
      res.status(500).json({ error: 'Registration failed', details: error.message, stack: error.stack });
    }
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // limit each IP to 5 login requests per windowMs
  });

  app.post('/api/login', loginLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '1d' }
      );
      res.json({ token });
    } catch (error) {
      res.status(400).json({ error: 'Login failed' });
    }
  });

  const adminMiddleware = async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin rights required.' });
      }
      next();
    } catch (error) {
      res.status(500).json({ error: 'Error checking admin status' });
    }
  };

  const authMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      req.userId = decoded.userId;
      console.log('User ID set in authMiddleware:', req.userId);
      // Check if user is banned
      const ban = await Ban.findOne({ user: req.userId });
      if (ban && ban.expiresAt && ban.expiresAt > new Date()) {
        return res.status(403).json({ error: 'User is banned', banExpiresAt: ban.expiresAt });
      }
  
      next();
    } catch (error) {
      console.error('Error in authMiddleware:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  };
  app.post('/api/subscribe', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const subscription = req.body;
  
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      user.pushSubscription = subscription;
      await user.save();
  
      res.status(200).json({ message: 'Subscription saved successfully' });
    } catch (error) {
      console.error('Error saving subscription:', error);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  });
  app.post('/api/user/update-location', authMiddleware, async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      user.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
      await user.save();
      res.json({ message: 'Location updated successfully' });
    } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({ error: 'Failed to update location' });
    }
  });
  app.get('/api/user-profile', authMiddleware, async (req, res) => {
    try {
      const user = await User.findById(req.userId).select('-password');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        sex: user.sex,
        position: user.position || '',
        secondaryPosition: user.secondaryPosition || '',
        skillLevel: user.skillLevel,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicturePath ? `/uploads/${user.profilePicturePath}` : null,
        mmr5v5: user.mmr5v5,
        mmr11v11: user.mmr11v11,
        bio: user.bio,
        cityTown: user.cityTown,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
    }
  });

  // Input validation middleware
  const validateInput = (schema) => {
    return (req, res, next) => {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      next();
    };
  };

  // Example schema for ban input
  const banSchema = Joi.object({
    userId: Joi.string().required(),
    banStage: Joi.number().min(0).max(4).required(),
    reason: Joi.string().required()
  });

  app.post('/api/report', authMiddleware, async (req, res) => {
    try {
      const { reportedUserId, gameId, reason } = req.body;
      
      console.log('Received report data:', { reportedUserId, gameId, reason, reportingUserId: req.userId });
      
      // Validate input
      if (!reportedUserId) {
        console.error('Missing reportedUserId');
        return res.status(400).json({ error: 'Missing reportedUserId' });
      }
      if (!gameId) {
        console.error('Missing gameId');
        return res.status(400).json({ error: 'Missing gameId' });
      }
      if (!reason) {
        console.error('Missing reason');
        return res.status(400).json({ error: 'Missing reason' });
      }
  
      // Check if the reported user exists
      const reportedUser = await User.findById(reportedUserId);
      if (!reportedUser) {
        console.error(`Reported user not found: ${reportedUserId}`);
        return res.status(404).json({ error: 'Reported user not found' });
      }
  
      // Check if the game exists
      console.log('Searching for game with ID:', gameId);
      const game = await Game.findById(gameId);
      if (!game) {
        console.error(`Game not found: ${gameId}`);
        // Log all games in the database for debugging
        const allGames = await Game.find({}).select('_id gameMode status startTime');
        console.log('All games in database:', allGames);
        return res.status(404).json({ error: 'Game not found' });
      }
  
      console.log('Game found:', game);
  
      await handleReport(reportedUserId, req.userId, gameId, reason);
      console.log('Report submitted successfully');
      res.status(200).json({ message: 'Report submitted successfully' });
    } catch (error) {
      console.error('Error submitting report:', error);
      res.status(500).json({ error: 'Failed to submit report', details: error.message });
    }
  });

  app.post('/api/admin/ban', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { userId, banStage, reason } = req.body;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let ban = await Ban.findOne({ user: userId });
      if (!ban) {
        ban = new Ban({ user: userId });
      }

      ban.stage = banStage;
      ban.reason = reason;
      ban.expiresAt = calculateBanExpiration(banStage);
      await ban.save();

      console.log(`Admin manually banned user ${userId} to stage ${banStage}. Reason: ${reason}`);
      res.status(200).json({ message: 'User banned successfully' });
    } catch (error) {
      console.error('Error in admin ban:', error);
      res.status(500).json({ error: 'Failed to ban user', details: error.message });
    }
  });

  // Helper function to calculate ban expiration
  function calculateBanExpiration(banStage) {
    const now = new Date();
    switch (banStage) {
      case 0: return now; // Warning, no actual ban
      case 1: return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
      case 2: return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      case 3: return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      case 4: return null; // Permanent ban
      default: return now;
    }
  }

  // Add this endpoint for fetching and handling ban appeals
  app.get('/api/admin/ban-appeals', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const banAppeals = await BanAppeal.find().populate('user', 'name');
      res.json(banAppeals);
    } catch (error) {
      console.error('Error fetching ban appeals:', error);
      res.status(500).json({ error: 'Failed to fetch ban appeals' });
    }
  });

  // Add this endpoint for handling ban appeal actions (approve/reject)
  app.post('/api/admin/ban-appeal/:appealId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { appealId } = req.params;
      const { action } = req.body;
      
      if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject".' });
      }

      const appeal = await BanAppeal.findById(appealId);
      if (!appeal) {
        return res.status(404).json({ error: 'Ban appeal not found' });
      }

      appeal.status = action === 'approve' ? 'approved' : 'rejected';
      await appeal.save();

      if (action === 'approve') {
        await Ban.findOneAndUpdate({ user: appeal.user }, { stage: 0, expiresAt: null });
        console.log(`Admin approved ban appeal for user ${appeal.user}`);
      } else {
        console.log(`Admin rejected ban appeal for user ${appeal.user}`);
      }

      res.status(200).json({ message: 'Ban appeal processed successfully' });
    } catch (error) {
      console.error('Error handling ban appeal:', error);
      res.status(500).json({ error: 'Failed to process ban appeal', details: error.message });
    }
  });

  // Add this new endpoint for fetching admin users
  app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await User.find({}, 'name email isAdmin');
      const usersWithBanStatus = await Promise.all(users.map(async (user) => {
        const ban = await Ban.findOne({ user: user._id });
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin || false,
          isBanned: !!ban
        };
      }));
      res.json(usersWithBanStatus);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // New endpoint for unbanning a user
  app.post('/api/admin/unban', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { userId } = req.body;
      await Ban.findOneAndDelete({ user: userId });
      console.log(`Admin unbanned user ${userId}`);
      res.status(200).json({ message: 'User unbanned successfully' });
    } catch (error) {
      console.error('Error in admin unban:', error);
      res.status(500).json({ error: 'Failed to unban user', details: error.message });
    }
  });

  // New endpoint for promoting a user to admin
  app.post('/api/admin/promote', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { userId } = req.body;
      await User.findByIdAndUpdate(userId, { isAdmin: true });
      console.log(`Admin promoted user ${userId} to admin`);
      res.status(200).json({ message: 'User promoted to admin successfully' });
    } catch (error) {
      console.error('Error in admin promote:', error);
      res.status(500).json({ error: 'Failed to promote user', details: error.message });
    }
  });

  // Add a new endpoint to update the user's bio
  app.put('/api/user/bio', authMiddleware, async (req, res) => {
    try {
      const { bio } = req.body;
      const user = await User.findByIdAndUpdate(req.userId, { bio }, { new: true });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ message: 'Bio updated successfully', bio: user.bio });
    } catch (error) {
      console.error('Error updating bio:', error);
      res.status(500).json({ error: 'Failed to update bio', details: error.message });
    }
  });

  function getMMRFromSkillLevel(skillLevel) {
    switch (skillLevel) {
      case 'beginner': return 300;
      case 'average': return 600;
      case 'intermediate': return 1000;
      case 'advanced': return 1400;
      case 'pro': return 1800;
      default: return 300;
    }
  }

  app.get('/api/users/search', authMiddleware, async (req, res) => {
    try {
      const { query } = req.query;
      console.log('Search query:', query);
      const users = await User.find({ 
        name: { $regex: query, $options: 'i' },
        _id: { $ne: req.userId }
      }).select('name _id profilePicturePath');
      
      const formattedUsers = users.map(user => ({
        id: user._id,
        name: user.name,
        profilePicture: user.profilePicturePath ? `/uploads/${user.profilePicturePath}` : null
      }));
      
      console.log('Search results:', formattedUsers);
      res.json(formattedUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  app.post('/api/friends/add', authMiddleware, async (req, res) => {
    try {
      const { friendId } = req.body;
      
      // Check if friendship already exists
      const existingFriendship = await Friend.findOne({
        $or: [
          { user: req.userId, friend: friendId },
          { user: friendId, friend: req.userId }
        ]
      });

      if (existingFriendship) {
        return res.status(400).json({ error: 'Friendship already exists or pending' });
      }

      const newFriend = new Friend({
        user: req.userId,
        friend: friendId,
        status: 'pending'
      });
      await newFriend.save();

      res.status(201).json({ message: 'Friend request sent successfully' });
    } catch (error) {
      console.error('Error adding friend:', error);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  });

  app.post('/api/friends/accept', authMiddleware, async (req, res) => {
    try {
      const { friendId } = req.body;
      
      const friendRequest = await Friend.findOne({
        user: friendId,
        friend: req.userId,
        status: 'pending'
      });

      if (!friendRequest) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      friendRequest.status = 'accepted';
      await friendRequest.save();

      // Create reverse friendship
      const reverseFriend = new Friend({
        user: req.userId,
        friend: friendId,
        status: 'accepted'
      });
      await reverseFriend.save();

      res.json({ message: 'Friend request accepted' });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(500).json({ error: 'Failed to accept friend request' });
    }
  });

  app.delete('/api/friends/:friendId', authMiddleware, async (req, res) => {
    try {
      const { friendId } = req.params;
      console.log('Removing friend:', friendId, 'for user:', req.userId);
      
      const result = await Friend.deleteMany({
        $or: [
          { user: req.userId, friend: friendId },
          { user: friendId, friend: req.userId }
        ]
      });

      if (result.deletedCount > 0) {
        console.log('Friend removed successfully');
        res.json({ message: 'Friend removed successfully' });
      } else {
        console.log('Friendship not found');
        res.status(404).json({ error: 'Friendship not found' });
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      res.status(500).json({ error: 'Failed to remove friend', details: error.message });
    }
  });

  app.get('/api/friends', authMiddleware, async (req, res) => {
    try {
      console.log('Fetching friends for user:', req.userId);
      const friends = await Friend.find({ 
        $or: [
          { user: req.userId, status: 'accepted' },
          { friend: req.userId, status: 'accepted' }
        ]
      }).populate('user friend', 'name profilePicturePath');
      
      const pendingRequests = await Friend.find({
        friend: req.userId,
        status: 'pending'
      }).populate('user', 'name profilePicturePath');

      const formattedFriends = friends.map(f => ({
        id: f.user._id.toString() === req.userId ? f.friend._id : f.user._id,
        name: f.user._id.toString() === req.userId ? f.friend.name : f.user.name,
        profilePicture: f.user._id.toString() === req.userId ? 
          (f.friend.profilePicturePath ? `/uploads/${f.friend.profilePicturePath}` : null) :
          (f.user.profilePicturePath ? `/uploads/${f.user.profilePicturePath}` : null)
      }));

      const formattedPendingRequests = pendingRequests.map(r => ({
        id: r.user._id,
        name: r.user.name,
        profilePicture: r.user.profilePicturePath ? `/uploads/${r.user.profilePicturePath}` : null
      }));

      console.log('Fetched friends:', formattedFriends);
      console.log('Fetched pending requests:', formattedPendingRequests);
      res.json({ friends: formattedFriends, pendingRequests: formattedPendingRequests });
    } catch (error) {
      console.error('Error fetching friends:', error);
      res.status(500).json({ error: 'Failed to fetch friends' });
    }
  });
  
  app.get('/api/penalty/status', authMiddleware, async (req, res) => {
    try {
      const penalty = await Penalty.findOne({ userId: req.userId });
      if (penalty && penalty.penaltyEndTime && new Date() < penalty.penaltyEndTime) {
        res.json({ isPenalized: true, penaltyEndTime: penalty.penaltyEndTime });
      } else {
        res.json({ isPenalized: false });
      }
    } catch (error) {
      console.error('Error checking penalty status:', error);
      res.status(500).json({ error: 'Failed to check penalty status' });
    }
  });

const MATCH_CHECK_INTERVAL = 5000; // Check for potential matches every 5 seconds
const MAX_MMR_DIFFERENCE = 400;
const PREFERRED_MMR_RANGE = 200;

const POSITIONS_5V5 = ['goalkeeper', 'non-goalkeeper', 'non-goalkeeper', 'non-goalkeeper', 'non-goalkeeper'];
const POSITIONS_11V11 = [
  'goalkeeper',
  'fullback', 'fullback',
  'centerback', 'centerback',
  'winger', 'winger',
  'midfielder', 'midfielder', 'midfielder',
  'striker'
];
async function checkForMatches(gameMode) {
  console.log(`Checking for ${gameMode} matches`);
  const modeField = gameMode === '5v5' ? 'mmr5v5' : 'mmr11v11';
  const playerCount = gameMode === '5v5' ? 10 : 22;
  let requiredPositions;
  
  if (gameMode === '5v5') {
    requiredPositions = POSITIONS_5V5.concat(POSITIONS_5V5);
  } else {
    requiredPositions = [
      ...POSITIONS_11V11.map(pos => ({ position: pos, team: 'blue' })),
      ...POSITIONS_11V11.map(pos => ({ position: pos, team: 'red' }))
    ];
  }

  const queueSize = await Queue.countDocuments({ gameMode });
  console.log(`Current queue size for ${gameMode}: ${queueSize}`);

  if (queueSize < playerCount) {
    console.log(`Not enough players in ${gameMode} queue to create a match`);
    return;
  }

  const matchCreated = await tryCreateMatch(gameMode, modeField, playerCount, requiredPositions);
  if (matchCreated) {
    console.log(`Match created for ${gameMode}:`, matchCreated);
  } else {
    console.log(`Failed to create ${gameMode} match`);
  }
}
async function updateFieldAvailability(fieldId, startTime, endTime) {
  try {
    const field = await Field.findById(fieldId);
    if (!field) {
      console.log('Field not found');
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    let availabilityUpdated = false;
    for (let i = 0; i < field.availability.length; i++) {
      const availabilityDate = new Date(field.availability[i].date);
      if (availabilityDate.toDateString() === startDate.toDateString()) {
        for (let j = 0; j < field.availability[i].slots.length; j++) {
          const slotStart = new Date(field.availability[i].slots[j].startTime);
          const slotEnd = new Date(field.availability[i].slots[j].endTime);
          if (slotStart >= startDate && slotEnd <= endDate) {
            field.availability[i].slots[j].isAvailable = false;
            availabilityUpdated = true;
          }
        }
        break;
      }
    }

    if (availabilityUpdated) {
      await field.save();
      console.log('Field availability updated successfully');
    } else {
      console.log('No matching availability slots found for update');
    }
  } catch (error) {
    console.error('Error updating field availability:', error);
  }
}
async function startMatchmakingProcess() {
  console.log('Starting continuous matchmaking process');
  while (true) {
    try {
      await logQueueState();
      await checkForMatches('5v5');
      await checkForMatches('11v11');
    } catch (error) {
      console.error('Error in matchmaking process:', error);
    }
    await new Promise(resolve => setTimeout(resolve, MATCH_CHECK_INTERVAL));
  }
}
async function notifyMatchedPlayers(players, matchResult) {
  console.log('Notifying matched players:', players.map(p => p.userId._id));
  
  for (const player of players) {
    if (!player || !player.userId) {
      console.log('Invalid player object:', player);
      continue;
    }

    try {
      const user = await User.findById(player.userId._id);
      if (user && user.pushSubscription) {
        const payload = JSON.stringify({
          title: 'Match Found!',
          body: `A ${matchResult.gameMode} match has been found. Get ready to play!`,
          data: {
            gameId: matchResult.gameId.toString(),
            url: '/game'
          }
        });

        try {
          await webpush.sendNotification(user.pushSubscription, payload);
          console.log(`Push notification sent to player ${player.userId._id}`);
        } catch (error) {
          console.error(`Failed to send push notification to player ${player.userId._id}:`, error);
        }
      } else {
        console.log(`No valid push subscription found for player ${player.userId._id}`);
      }

      const ws = activeConnections.get(player.userId._id.toString());
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'matchFound',
          matchDetails: matchResult
        }));
        console.log(`WebSocket notification sent to player ${player.userId._id}`);
      } else {
        console.log(`WebSocket not found or not open for player ${player.userId._id}`);
      }
    } catch (error) {
      console.error(`Error notifying player ${player.userId._id}:`, error);
    }
  }
}
async function tryCreateMatch(gameMode, modeField, playerCount, requiredPositions) {
  console.log(`Attempting to create match for ${gameMode}`);
  let matchPlayers = [];
  let maxMMRDifference = 400;

  const queuedPlayers = await Queue.find({ gameMode }).populate('userId');
  console.log(`Found ${queuedPlayers.length} total players in queue for ${gameMode}`);

  const realPlayersInQueue = queuedPlayers.filter(qp => !qp.userId.email.startsWith('dummy'));
  if (realPlayersInQueue.length === 0) {
    console.log('No real players in the queue. Aborting match creation.');
    return null;
  }

  queuedPlayers.sort((a, b) => b.userId[modeField] - a.userId[modeField]);

  const oldestQueueTime = Math.min(...queuedPlayers.map(qp => new Date() - qp.joinedAt));
  if (oldestQueueTime > 5 * 60 * 1000) {
    maxMMRDifference = Math.min(800, 400 + Math.floor((oldestQueueTime - 5 * 60 * 1000) / (60 * 1000)) * 40);
    console.log(`Increased max MMR difference to ${maxMMRDifference} due to long queue time`);
  }

  let blueTeam = [];
  let redTeam = [];
  let lowestMMR = Infinity;
  let highestMMR = -Infinity;

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findPlayersWithinRadius = (centerPlayer, radius) => {
    return queuedPlayers.filter(qp => 
      !matchPlayers.some(m => m.userId._id.equals(qp.userId._id)) &&
      calculateDistance(
        centerPlayer.userId.location?.coordinates[1], centerPlayer.userId.location?.coordinates[0],
        qp.userId.location?.coordinates[1], qp.userId.location?.coordinates[0]
      ) <= radius
    );
  };

  let availablePlayers = [...queuedPlayers];

  while (matchPlayers.length < playerCount && maxMMRDifference <= 800) {
    for (const position of requiredPositions) {
      if (matchPlayers.length >= playerCount) break;

      const bluePlayer = findPlayerForPosition(position, 'blue', availablePlayers, matchPlayers, lowestMMR, highestMMR, maxMMRDifference);
      if (bluePlayer) {
        matchPlayers.push(bluePlayer);
        blueTeam.push(bluePlayer);
        availablePlayers = availablePlayers.filter(p => p.userId._id.toString() !== bluePlayer.userId._id.toString());
        updateMMRRange(bluePlayer.userId[modeField]);
      }

      if (matchPlayers.length >= playerCount) break;

      const redPlayer = findPlayerForPosition(position, 'red', availablePlayers, matchPlayers, lowestMMR, highestMMR, maxMMRDifference);
      if (redPlayer) {
        matchPlayers.push(redPlayer);
        redTeam.push(redPlayer);
        availablePlayers = availablePlayers.filter(p => p.userId._id.toString() !== redPlayer.userId._id.toString());
        updateMMRRange(redPlayer.userId[modeField]);
      }
    }

    if (matchPlayers.length < playerCount) {
      maxMMRDifference += 100;
      console.log(`Increasing MMR difference to ${maxMMRDifference}`);
    }
  }

  function updateMMRRange(mmr) {
    lowestMMR = Math.min(lowestMMR, mmr);
    highestMMR = Math.max(highestMMR, mmr);
  }

  function findPlayerForPosition(position, team, availablePlayers, matchPlayers, lowestMMR, highestMMR, maxMMRDifference) {
    let player = availablePlayers.find(qp => 
      (gameMode === '5v5' ? 
        (position === 'goalkeeper' ? 
          (qp.userId.position === 'goalkeeper' || qp.userId.secondaryPosition === 'goalkeeper') :
          (qp.userId.position !== 'goalkeeper' && qp.userId.secondaryPosition !== 'goalkeeper')) :
        (qp.userId.position === position || qp.userId.secondaryPosition === position)) &&
      (matchPlayers.length === 0 || 
       (qp.userId[modeField] >= lowestMMR - maxMMRDifference && 
        qp.userId[modeField] <= highestMMR + maxMMRDifference))
    );
    
    if (!player && position !== 'goalkeeper') {
      player = availablePlayers.find(qp => 
        qp.userId.position !== 'goalkeeper' &&
        qp.userId.secondaryPosition !== 'goalkeeper' &&
        (matchPlayers.length === 0 || 
         (qp.userId[modeField] >= lowestMMR - maxMMRDifference && 
          qp.userId[modeField] <= highestMMR + maxMMRDifference))
      );
    }

    if (player) {
      return { 
        userId: player.userId, 
        position: gameMode === '5v5' && position !== 'goalkeeper' ? 'non-goalkeeper' : position,
        team: team
      };
    }
    return null;
  }

  if (matchPlayers.length < playerCount) {
    console.log(`Not enough players found. Players found: ${matchPlayers.length}`);
    return null;
  }

  function swapPlayers(teamA, teamB, indexA, indexB) {
    [teamA[indexA], teamB[indexB]] = [teamB[indexB], teamA[indexA]];
    teamA[indexA].team = 'blue';
    teamB[indexB].team = 'red';
  }

  function calculateTeamStrength(team) {
    return team.reduce((sum, player) => sum + player.userId[modeField], 0);
  }

  function calculateCenterPoint(coordinates) {
    const totalLat = coordinates.reduce((sum, coord) => sum + coord[1], 0);
    const totalLon = coordinates.reduce((sum, coord) => sum + coord[0], 0);
    const count = coordinates.length;
  
    return {
      latitude: totalLat / count,
      longitude: totalLon / count
    };
  }

  function balanceTeams() {
    const maxIterations = 100;
    for (let i = 0; i < maxIterations; i++) {
      const blueStrength = calculateTeamStrength(blueTeam);
      const redStrength = calculateTeamStrength(redTeam);
      if (Math.abs(blueStrength - redStrength) < 100) break;

      const [sourceTeam, targetTeam] = blueStrength > redStrength ? [blueTeam, redTeam] : [redTeam, blueTeam];

      let bestSwap = null;
      let bestDifference = Math.abs(blueStrength - redStrength);

      for (let j = 0; j < sourceTeam.length; j++) {
        for (let k = 0; k < targetTeam.length; k++) {
          if (sourceTeam[j].position === targetTeam[k].position) {
            swapPlayers(sourceTeam, targetTeam, j, k);
            const newDifference = Math.abs(calculateTeamStrength(blueTeam) - calculateTeamStrength(redTeam));

            if (newDifference < bestDifference) {
              bestSwap = { sourceIndex: j, targetIndex: k };
              bestDifference = newDifference;
            }

            swapPlayers(sourceTeam, targetTeam, j, k);
          }
        }
      }

      if (bestSwap) {
        swapPlayers(sourceTeam, targetTeam, bestSwap.sourceIndex, bestSwap.targetIndex);
      } else {
        break;
      }
    }
  }

  balanceTeams();

  console.log('Final team compositions:');
  console.log('Blue Team:', blueTeam.map(p => ({ position: p.position, mmr: p.userId[modeField] })));
  console.log('Red Team:', redTeam.map(p => ({ position: p.position, mmr: p.userId[modeField] })));

  matchPlayers = [...blueTeam, ...redTeam];

  if (matchPlayers.length === playerCount) {
    console.log(`Successfully created match with ${matchPlayers.length} players, including at least one real player`);
  
    try {
      const centerPoint = calculateCenterPoint(matchPlayers.map(p => p.userId.location.coordinates));
      await createRealFields(centerPoint.latitude, centerPoint.longitude);

      const fieldSchedule = await findAndScheduleField(matchPlayers.map(p => p.userId), gameMode);
      if (!fieldSchedule) {
        console.log('No suitable field or time slot found');
        await returnPlayersToQueue(matchPlayers, gameMode);
        return null;
      }

      console.log('Field schedule:', JSON.stringify(fieldSchedule, null, 2));

      const newGame = new Game({
        players: matchPlayers.map(p => p.userId._id),
        gameMode,
        status: 'lobby',
        startTime: fieldSchedule.startTime,
        endTime: fieldSchedule.endTime,
        field: fieldSchedule.field._id
      });

      await newGame.save();

      const matchResult = {
        gameId: newGame._id,
        team1: matchPlayers.filter(p => p.team === 'blue').map(p => ({
          id: p.userId._id,
          name: p.userId.name,
          mmr: p.userId[modeField],
          position: p.position,
          primaryPosition: p.userId.position,
          secondaryPosition: p.userId.secondaryPosition,
          profilePicture: p.userId.profilePicturePath,
          isReal: !p.userId.email.startsWith('dummy'),
          team: 'blue'
        })),
        team2: matchPlayers.filter(p => p.team === 'red').map(p => ({
          id: p.userId._id,
          name: p.userId.name,
          mmr: p.userId[modeField],
          position: p.position,
          primaryPosition: p.userId.position,
          secondaryPosition: p.userId.secondaryPosition,
          profilePicture: p.userId.profilePicturePath,
          isReal: !p.userId.email.startsWith('dummy'),
          team: 'red'
        })),
        fieldName: fieldSchedule.field.name,
        fieldLocation: fieldSchedule.field.location,
        startTime: fieldSchedule.startTime,
        endTime: fieldSchedule.endTime,
        imageUrl: fieldSchedule.field.imageUrl,
        gameMode
      };

      console.log(`Match created for ${gameMode}:`, matchResult);

      await notifyMatchedPlayers(matchPlayers, matchResult);

      if (fieldSchedule.availabilityIndex !== undefined && fieldSchedule.slotIndex !== undefined) {
        await updateFieldAvailability(fieldSchedule.field._id, fieldSchedule.startTime, fieldSchedule.endTime);
      }

      // Remove matched players from the queue
      for (const player of matchPlayers) {
        await Queue.deleteOne({ userId: player.userId._id, gameMode });
      }

      return matchResult;
    } catch (error) {
      console.error('Error creating game:', error);
      await returnPlayersToQueue(matchPlayers, gameMode);
      return null;
    }
  }

  console.log(`Match creation failed. Players found: ${matchPlayers.length}`);
  await returnPlayersToQueue(matchPlayers, gameMode);
  return null;
}
function isPlayerSuitableForPosition(player, position) {
  if (position === 'goalkeeper') {
    return player.position === 'goalkeeper' || player.secondaryPosition === 'goalkeeper';
  } else {
    return player.position !== 'goalkeeper' || player.secondaryPosition !== 'goalkeeper';
  }
}

function selectBestPlayer(players, position) {
  const priorityPlayers = players.filter(p => 
    p.userId.position === position || p.userId.secondaryPosition === position
  );
  if (priorityPlayers.length > 0) {
    return priorityPlayers[Math.floor(Math.random() * priorityPlayers.length)].userId;
  }
  // If no priority players, select a random player
  return players[Math.floor(Math.random() * players.length)].userId;
}

async function returnPlayersToQueue(match, gameMode) {
  for (const matchedPlayer of match) {
    await Queue.create({ userId: matchedPlayer.userId._id, gameMode, joinedAt: new Date() });
  }
}
function formatTeamData(team, modeField) {
  return team.map(p => ({ 
    id: p.userId._id, 
    name: p.userId.name || 'Unknown',
    mmr: p.userId[modeField],
    position: p.position,
    primaryPosition: p.userId.position,
    secondaryPosition: p.userId.secondaryPosition,
    profilePicture: p.userId.profilePicturePath ? `/uploads/${p.userId.profilePicturePath}` : null,
    isReal: !p.userId.email.startsWith('dummy'),
    team: p.team
  }));
}

async function resetOrLowerPenaltyCount(penalty) {
  const now = new Date();
  const hoursSinceLastPenalty = (now - penalty.lastLeavePenaltyDate) / (1000 * 60 * 60);

  if (hoursSinceLastPenalty >= 24) {
    // Reset penalty count to 0 if it's been 24 hours or more since the last penalty
    penalty.leaveCount = 0;
    penalty.penaltyEndTime = null;
  } else {
    // Lower penalty count by 1 for every 12 hours passed, but not below 0
    const reductionCount = Math.floor(hoursSinceLastPenalty / 12);
    penalty.leaveCount = Math.max(0, penalty.leaveCount - reductionCount);
    
    // If penaltyEndTime is in the past, remove it
    if (penalty.penaltyEndTime && penalty.penaltyEndTime <= now) {
      penalty.penaltyEndTime = null;
    }
  }

  return penalty;
}

app.post('/api/queue/join', authMiddleware, async (req, res) => {
  try {
    const { gameMode } = req.body;
    console.log(`User ${req.userId} attempting to join ${gameMode} queue`);

    const penaltyEndTime = await checkUserPenalty(req.userId);
    if (penaltyEndTime) {
      console.log(`User ${req.userId} is penalized until ${penaltyEndTime}`);
      return res.status(403).json({ 
        error: 'You are currently penalized and cannot join games',
        penaltyEndTime
      });
    }

    // Remove user from any existing queues and games
    await Queue.deleteMany({ userId: req.userId });
    await Game.updateMany(
      { players: req.userId, status: { $in: ['lobby', 'inProgress'] } },
      { $pull: { players: req.userId } }
    );
    console.log(`Removed user ${req.userId} from existing queues and games`);

    const user = await User.findById(req.userId);
    if (!user) {
      console.log(`User ${req.userId} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Add the player to the queue
    await Queue.create({ userId: user._id, gameMode, joinedAt: new Date() });
    console.log(`User ${req.userId} added to ${gameMode} queue`);

    // Try to find a match immediately
    const match = await tryCreateMatch(gameMode, gameMode === '5v5' ? 'mmr5v5' : 'mmr11v11', gameMode === '5v5' ? 10 : 22, gameMode === '5v5' ? POSITIONS_5V5 : POSITIONS_11V11);
    
    if (match) {
      console.log(`Match found immediately for user ${req.userId}:`, match);
      res.json({ message: 'Match found', match });
    } else {
      console.log(`No immediate match found for user ${req.userId}. Waiting in queue.`);
      res.status(200).json({ message: 'Joined queue successfully' });
    }
  } catch (error) {
    console.error('Detailed error in joining queue:', error);
    res.status(500).json({ error: 'Failed to join queue', details: error.message });
  }
});

  app.post('/api/queue/leave', authMiddleware, async (req, res) => {
    try {
      const { gameMode } = req.body;
      await Queue.deleteOne({ userId: req.userId, gameMode });
      res.json({ message: 'Left queue successfully' });
    } catch (error) {
      console.error('Error leaving queue:', error);
      res.status(500).json({ error: 'Failed to leave queue' });
    }
  });

  app.get('/api/user/match-history', authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;
      console.log(`Fetching match history for user ${req.userId}, limit: ${limit}`);
      
      const matches = await GameResult.find({ players: req.userId })
        .sort({ endTime: -1 })
        .limit(limit)
        .populate('players', 'name profilePicturePath');
  
      const formattedMatches = matches.map(match => ({
        id: match._id,
        mode: match.mode,
        blueScore: match.blueScore,
        redScore: match.redScore,
        location: match.location,
        endTime: match.endTime,
        players: match.players.map(player => ({
          id: player._id,
          name: player.name,
          profilePicture: player.profilePicturePath ? `/uploads/${player.profilePicturePath}` : null
        })),
        mmrChange: match.mmrChanges.find(change => change.userId.toString() === req.userId.toString())?.change || 0
      }));
  
      console.log('Sending match history:', formattedMatches);
      res.json(formattedMatches);
    } catch (error) {
      console.error('Error fetching match history:', error);
      res.status(500).json({ error: 'Failed to fetch match history', details: error.message });
    }
  });
  // Update the /api/user/:id endpoint
  app.get('/api/user/:id', authMiddleware, async (req, res) => {
    try {
      console.log('Fetching user data for ID:', req.params.id);
      const userId = req.params.id;
      if (!userId || userId === 'undefined') {
        return res.status(400).json({ error: 'Invalid User ID' });
      }
  
      const user = await User.findById(userId);
      
      if (!user) {
        console.log('User not found for ID:', userId);
        return res.status(404).json({ error: 'User not found' });
      }
  
      const userData = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        sex: user.sex,
        position: user.position,
        secondaryPosition: user.secondaryPosition,
        skillLevel: user.skillLevel,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicturePath ? `/uploads/${user.profilePicturePath}` : null,
        isCurrentUser: req.userId === userId,
        mmr5v5: user.mmr5v5,
        mmr11v11: user.mmr11v11,
        bio: user.bio,
        cityTown: user.cityTown,
      };
  
      console.log('Sending user data:', userData);
      res.json(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });
 
  app.get('/api/field/:gameId', authMiddleware, async (req, res) => {
    try {
      const game = await Game.findById(req.params.gameId).populate('field');
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
  
      const field = game.field;
      if (!field) {
        return res.status(404).json({ error: 'Field not found for this game' });
      }
  
      // Generate a Mapbox link using the coordinates
      const gpsLink = `https://www.mapbox.com/maps/streets/?q=${field.location.coordinates[1]},${field.location.coordinates[0]}`;
  
      // Ensure the image URL is correct
      let imageUrl = field.imageUrl;
      if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
        imageUrl = `/uploads/fields/${imageUrl}`;
      }
      // Remove the API_BASE_URL concatenation here
      // imageUrl = `${API_BASE_URL}${imageUrl}`;
  
      console.log('Field data:', {
        name: field.name,
        gpsLink: gpsLink,
        imageUrl: imageUrl,
        latitude: field.location.coordinates[1],
        longitude: field.location.coordinates[0]
      });
  
      res.json({
        name: field.name,
        gpsLink: gpsLink,
        imageUrl: imageUrl,
        latitude: field.location.coordinates[1],
        longitude: field.location.coordinates[0]
      });
    } catch (error) {
      console.error('Error fetching field info:', error);
      res.status(500).json({ error: 'Failed to fetch field information' });
    }
  });
  // Update profile picture
  app.post('/api/user/profile-picture', authMiddleware, upload.single('profilePicture'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update the user's profile picture
      user.profilePicturePath = req.file.filename;
      await user.save();

      res.json({ message: 'Profile picture updated successfully', profilePicture: `/uploads/${req.file.filename}` });
    } catch (error) {
      console.error('Error updating profile picture:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/api/game/leave', authMiddleware, async (req, res) => {
    try {
      const { lobbyTime, gameStartTime } = req.body;
      const now = new Date();

      // Find the active game for this user
      const activeGame = await Game.findOne({ 
        players: req.userId,
        status: { $in: ['lobby', 'inProgress'] }
      });

      if (!activeGame) {
        return res.status(404).json({ error: 'No active game found for this user' });
      }

      const gameStartTimeFromDB = activeGame.startTime || now;
      const gameMode = activeGame.gameMode;
      const lobbyTimeMinutes = lobbyTime / 60; // Convert seconds to minutes
      const timeDifference = (gameStartTimeFromDB.getTime() - now.getTime()) / (1000 * 60); // difference in minutes

      console.log('Leave game request:', { 
        lobbyTimeMinutes, 
        gameStartTime: gameStartTimeFromDB.toISOString(), 
        timeDifference, 
        gameMode,
        currentTime: now.toISOString()
      });

      // Return other players to queue
      for (const playerId of activeGame.players) {
        if (playerId.toString() !== req.userId.toString()) {
          await Queue.create({ userId: playerId, gameMode: activeGame.gameMode, joinedAt: new Date() });
        }
      }

      activeGame.status = 'ended';
      await activeGame.save();

      // Remove the user from any active queues
      await Queue.deleteMany({ userId: req.userId });

      let penalty = await Penalty.findOne({ userId: req.userId });
      if (!penalty) {
        penalty = new Penalty({ userId: req.userId });
      } else {
        penalty = await resetOrLowerPenaltyCount(penalty);
      }

      const isFirstLeave = penalty.leaveCount === 0;
      penalty.leaveCount += 1;
      penalty.lastLeavePenaltyDate = now;

      let mmrReduction = 0;
      let queueRestriction = false;

      // Updated conditions for penalties
      if ((lobbyTimeMinutes >= 60 && timeDifference > 0 && timeDifference <= 60) ||
          (lobbyTimeMinutes >= 30 && timeDifference > 0 && timeDifference <= 30) ||
          now >= gameStartTimeFromDB ||
          penalty.leaveCount >= 3) {
        penalty.penaltyEndTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        queueRestriction = true;
        mmrReduction = 10; // Apply MMR reduction even for first leave if it's a severe case
      } else if (!isFirstLeave) {
        mmrReduction = 10; // Apply MMR reduction for subsequent leaves
      }

      // Add this log to see the exact values being compared
      console.log('Penalty check:', {
        lobbyTimeMinutes,
        timeDifference,
        nowVsGameStart: now >= gameStartTimeFromDB,
        leaveCount: penalty.leaveCount,
        penaltyApplied: queueRestriction
      });

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (mmrReduction > 0) {
        if (gameMode === '5v5') {
          user.mmr5v5 = Math.max(0, user.mmr5v5 - mmrReduction);
        } else if (gameMode === '11v11') {
          user.mmr11v11 = Math.max(0, user.mmr11v11 - mmrReduction);
        } else {
          // If gameMode is somehow undefined, reduce both MMRs
          user.mmr5v5 = Math.max(0, user.mmr5v5 - mmrReduction);
          user.mmr11v11 = Math.max(0, user.mmr11v11 - mmrReduction);
        }
        await user.save();
      }

      await penalty.save();

      console.log('Updated penalty:', penalty);
      console.log('MMR reduction:', mmrReduction);
      console.log('Queue restriction:', queueRestriction);
      console.log('Updated user MMR:', {
        userId: user._id,
        mmr5v5: user.mmr5v5,
        mmr11v11: user.mmr11v11
      });

      res.json({ 
        message: 'Game left successfully', 
        penalized: queueRestriction,
        penaltyEndTime: penalty.penaltyEndTime,
        mmrReduction: mmrReduction,
        gameMode: gameMode,
        updatedMMR: {
          mmr5v5: user.mmr5v5,
          mmr11v11: user.mmr11v11
        }
      });
    } catch (error) {
      console.error('Detailed error in /api/game/leave:', error);
      res.status(500).json({ error: 'Failed to process game leave', details: error.message });
    }
  });

  const GameResultSchema = new mongoose.Schema({
    mode: String,
    blueScore: Number,
    redScore: Number,
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    endTime: Date,
    location: String,
    coordinates: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }
    },
    mmrChanges: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      change: Number
    }]
  });
  
  GameResultSchema.index({ coordinates: '2dsphere' });
  
  const GameResult = mongoose.model('GameResult', GameResultSchema);
  
  app.post('/api/game/result', authMiddleware, async (req, res) => {
    try {
      const { mode, blueScore, redScore, players, endTime, location, coordinates, mmrChanges } = req.body;
      const gameResult = new GameResult({
        mode,
        blueScore,
        redScore,
        players,
        endTime: new Date(endTime),
        location,
        coordinates: coordinates ? {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude]
        } : undefined,
        mmrChanges
      });
      await gameResult.save();
      console.log('Game result saved:', gameResult);
      res.status(201).json({ message: 'Game result saved successfully' });
    } catch (error) {
      console.error('Error saving game result:', error);
      res.status(500).json({ error: 'Failed to save game result' });
    }
  });
  
  app.get('/api/games/recent', authMiddleware, async (req, res) => {
    try {
      const { latitude, longitude } = req.query;
      const userLocation = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
      console.log('Fetching recent games near:', userLocation);
  
      const recentGames = await GameResult.find({
        coordinates: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [userLocation.longitude, userLocation.latitude]
            },
            $maxDistance: 80467 // 50 miles in meters
          }
        }
      })
        .sort({ endTime: -1 })
        .limit(10)
        .populate('players', 'name profilePicturePath');
  
      const formattedGames = recentGames.map(game => {
        const distance = calculateDistance(userLocation, game.coordinates.coordinates);
        return {
          id: game._id,
          mode: game.mode,
          blueScore: game.blueScore,
          redScore: game.redScore,
          location: game.location,
          endTime: game.endTime,
          distance: Math.round(distance / 1609.34), // Convert meters to miles and round
          players: game.players.map(player => ({
            id: player._id,
            name: player.name,
            profilePicture: player.profilePicturePath ? `/uploads/${player.profilePicturePath}` : null
          })),
          averageMMR: calculateAverageMMR(game)
        };
      });
  
      console.log('Sending recent games:', formattedGames);
      res.json(formattedGames);
    } catch (error) {
      console.error('Error fetching recent games:', error);
      res.status(500).json({ error: 'Failed to fetch recent games' });
    }
  });
  
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }
  
  function calculateAverageMMR(game) {
    // Implement average MMR calculation logic here
  }
  // Add this new route for leaderboard data
  app.get('/api/leaderboard', authMiddleware, async (req, res) => {
    try {
      const { mode, gender, page = 1, limit = 50, search = '' } = req.query;
      const modeField = mode === '5v5' ? 'mmr5v5' : 'mmr11v11';
      const skip = (page - 1) * limit;

      // First, get the total count of players matching the gender criteria
      const totalPlayers = await User.countDocuments({ sex: gender });

      // Then, get the players for the current page
      const players = await User.find({
        sex: gender,
        name: { $regex: search, $options: 'i' }
      })
        .sort({ [modeField]: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('name profilePicturePath mmr5v5 mmr11v11');

      // Calculate the rank for each player
      const leaderboardData = await Promise.all(players.map(async (player) => {
        const rank = await User.countDocuments({
          sex: gender,
          [modeField]: { $gt: player[modeField] }
        }) + 1;

        return {
          id: player._id,
          name: player.name,
          profilePicture: player.profilePicturePath ? `/uploads/${player.profilePicturePath}` : null,
          mmr: player[modeField],
          rank
        };
      }));

      res.json({
        players: leaderboardData,
        totalPlayers
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // Update the error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  // Add this just before your app.listen() call
  app.use((req, res, next) => {
    console.log(`404 - Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).send("Sorry, that route doesn't exist.");
  });

  // Add this function to create sample users
  async function createSampleUsers() {
    const sampleUsers = [
      { name: 'Alice', email: 'alice@example.com', password: 'password123', phone: '1234567890', sex: 'female', position: 'midfielder', skillLevel: 'intermediate', dateOfBirth: '1995-05-15' },
      { name: 'Bob', email: 'bob@example.com', password: 'password123', phone: '2345678901', sex: 'male', position: 'striker', skillLevel: 'advanced', dateOfBirth: '1993-08-22' },
      { name: 'Charlie', email: 'charlie@example.com', password: 'password123', phone: '3456789012', sex: 'male', position: 'goalkeeper', skillLevel: 'beginner', dateOfBirth: '1998-11-30' },
    ];

    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const mmr = getMMRFromSkillLevel(userData.skillLevel);
        const user = new User({
          ...userData,
          password: hashedPassword,
          mmr5v5: mmr,
          mmr11v11: mmr,
          dateOfBirth: new Date(userData.dateOfBirth)
        });
        await user.save();
        console.log(`Created sample user: ${userData.name}`);
      }
    }
  }
  function getRandomLocationWithin50Miles(baseLat, baseLon) {
    const radiusInMeters = 80467; // 50 miles in meters
    const bearing = Math.random() * 360; // Random bearing in degrees
    const distance = Math.random() * radiusInMeters; // Random distance within the radius
  
    const destination = computeDestinationPoint(
      { latitude: baseLat, longitude: baseLon },
      distance,
      bearing
    );
  
    return [destination.longitude, destination.latitude];
  }
  // Add this function to create dummy players
  async function createDummyPlayers() {
    const positions = ['goalkeeper', 'center back', 'midfielder', 'striker', 'full back', 'winger'];
    const skillLevels = ['beginner', 'average', 'intermediate', 'advanced', 'pro'];
  
    // Assuming your location is stored in an environment variable or config file
    const YOUR_LATITUDE = parseFloat(process.env.YOUR_LATITUDE) || 40.7128;
    const YOUR_LONGITUDE = parseFloat(process.env.YOUR_LONGITUDE) || -74.0060;
  
    for (let i = 0; i < 300; i++) {
      const name = `Dummy${i + 1}`;
      const email = `dummy${i + 1}@example.com`;
      const sex = i % 2 === 0 ? 'male' : 'female';
      const position = positions[i % positions.length];
      const secondaryPosition = positions[(i + 1) % positions.length];
      const skillLevel = skillLevels[Math.floor(i / 22)];
      const dateOfBirth = new Date(1990, 0, 1);
  
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash('dummypassword', 10);
        const mmr = getMMRFromSkillLevel(skillLevel);
        const [longitude, latitude] = getRandomLocationWithin50Miles(YOUR_LATITUDE, YOUR_LONGITUDE);
        const user = new User({
          name,
          email,
          password: hashedPassword,
          phone: `123456789${i}`,
          sex,
          position,
          secondaryPosition,
          skillLevel,
          mmr5v5: mmr,
          mmr11v11: mmr,
          dateOfBirth,
          location: {
            type: 'Point',
            coordinates: [longitude, latitude]
          }
        });
        await user.save();
        console.log(`Created dummy player: ${name} (${position}) at [${longitude}, ${latitude}]`);
      }
    }
  }
  
  async function addDummyPlayersToQueue() {
    try {
      const dummyPlayers = await User.find({ email: /^dummy/ });
      const gameModes = ['5v5', '11v11'];
  
      for (const player of dummyPlayers) {
        const randomGameMode = gameModes[Math.floor(Math.random() * gameModes.length)];
        await Queue.create({ 
          userId: player._id, 
          gameMode: randomGameMode, 
          joinedAt: new Date() 
        });
        console.log(`Added dummy player ${player.name} to ${randomGameMode} queue`);
      }
    } catch (error) {
      console.error('Error adding dummy players to queue:', error);
    }
  }
  async function logQueueState() {
    const queue5v5 = await Queue.find({ gameMode: '5v5' }).populate('userId');
    const queue11v11 = await Queue.find({ gameMode: '11v11' }).populate('userId');
  
    console.log('Current 5v5 queue:');
    queue5v5.forEach(q => console.log(`${q.userId.name} (${q.userId.position}/${q.userId.secondaryPosition})`));
  
    console.log('Current 11v11 queue:');
    queue11v11.forEach(q => console.log(`${q.userId.name} (${q.userId.position}/${q.userId.secondaryPosition})`));
  }
  // Call these functions after connecting to the database
  await createSampleUsers();
  await createDummyPlayers();
  await createAdminUser();
  await addDummyPlayersToQueue();

  app.get('/api/user/match-history', authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;
      console.log(`Fetching match history for user ${req.userId}, limit: ${limit}`);
      
      // Change this line
      const matches = await GameResult.find({ players: req.userId })
        .sort({ endTime: -1 })
        .limit(limit)
        .populate('players', 'name profilePicturePath');
  
      const formattedMatches = matches.map(match => ({
        id: match._id,
        mode: match.mode,
        blueScore: match.blueScore,
        redScore: match.redScore,
        location: match.location,
        endTime: match.endTime,
        players: match.players.map(player => ({
          id: player._id,
          name: player.name,
          profilePicture: player.profilePicturePath ? `/uploads/${player.profilePicturePath}` : null
        })),
        mmrChange: match.mmrChanges.find(change => change.userId.toString() === req.userId.toString())?.change || 0
      }));
  
      console.log('Sending match history:', formattedMatches);
      res.json(formattedMatches);
    } catch (error) {
      console.error('Error fetching match history:', error);
      res.status(500).json({ error: 'Failed to fetch match history', details: error.message });
    }
  });

  const PORT = process.env.PORT || 3002;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  setInterval(checkAndResetBanStage, 24 * 60 * 60 * 1000); // Run once a day

  startMatchmakingProcess().catch(error => {
    console.error('Error starting matchmaking process:', error);
  });
}

startServer().catch(error => console.error('Failed to start server:', error));