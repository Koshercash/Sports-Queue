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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: 'uploads/' });

const app = express();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // make sure this matches your frontend URL
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

async function startServer() {
  
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  console.log('Connected to in-memory MongoDB');

  const UserSchema = new mongoose.Schema({
    isAdmin: { type: Boolean, default: false },
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    sex: String,
    position: String,
    secondaryPosition: String, // Add this line
    skillLevel: String,
    mmr5v5: Number,
    mmr11v11: Number,
    idPicture: String,
    dateOfBirth: Date,
    profilePicturePath: String,
    bio: { type: String, default: '' },
    cityTown: String, // Add this line
  });

  const User = mongoose.model('User', UserSchema);

  const FriendSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'] }
  });


  const Friend = mongoose.model('Friend', FriendSchema)
  
  const GameSchema = new mongoose.Schema({
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    gameMode: String,
    status: { type: String, enum: ['lobby', 'inProgress', 'ended'], default: 'lobby' },
    startTime: Date,
    endTime: Date
  });
  
  const Game = mongoose.model('Game', GameSchema);

  const QueueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gameMode: String,
    timestamp: { type: Date, default: Date.now }
  });

  const Queue = mongoose.model('Queue', QueueSchema);

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
  
  const Report = mongoose.model('Report', ReportSchema);

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
  
  const BanAppeal = mongoose.model('BanAppeal', BanAppealSchema);

  const Ban = mongoose.model('Ban', BanSchema);

  const Penalty = mongoose.model('Penalty', PenaltySchema);

  async function handleReport(reportedUserId, reportingUserId, gameId, reason) {
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
      reason
    });
    await newReport.save();
  
    const reportsCount = await Report.countDocuments({
      reportedUser: reportedUserId,
      game: gameId
    });
  
    if (reportsCount >= 3 || (reason === 'physical_fight' && reportsCount >= 6)) {
      await progressBanStage(reportedUserId, reason === 'physical_fight');
      console.log(`User ${reportedUserId} ban stage progressed due to ${reportsCount} reports in game ${gameId}`);
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
        idPicture: req.files.idPicture ? req.files.idPicture[0].filename : null
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
      res.status(401).json({ error: 'Invalid token' });
    }
  };

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
      
      // Validate input
      if (!reportedUserId || !gameId || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
  
      await handleReport(reportedUserId, req.userId, gameId, reason);
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
  const POSITIONS_5V5 = ['goalkeeper', 'defender', 'midfielder', 'forward'];
  const POSITIONS_11V11 = ['goalkeeper', 'fullback', 'centerback', 'winger', 'midfielder', 'striker'];
  
  async function startMatchmakingProcess() {
    setInterval(async () => {
      await findMatches('5v5');
      await findMatches('11v11');
    }, 10000); // Run every 10 seconds
  }
  
  async function findMatches(gameMode) {
    const queuedPlayers = await Queue.find({ gameMode }).populate('userId');
    
    if (queuedPlayers.length < (gameMode === '5v5' ? 10 : 22)) {
      return; // Not enough players to form a match
    }
  
    const match = await tryCreateMatch(gameMode, gameMode === '5v5' ? 'mmr5v5' : 'mmr11v11', gameMode === '5v5' ? 10 : 22, gameMode === '5v5' ? POSITIONS_5V5 : POSITIONS_11V11);
  
    if (match) {
      console.log(`Match found for ${gameMode}:`, match);
      await createGame(match, gameMode);
    }
  }
  
  async function tryCreateMatch(gameMode, mmrField, teamSize, positions) {
    const queuedPlayers = await Queue.find({ gameMode }).populate('userId');
    const sortedPlayers = queuedPlayers.sort((a, b) => a.userId[mmrField] - b.userId[mmrField]);
  
    for (let i = 0; i < sortedPlayers.length - teamSize + 1; i++) {
      const potentialMatch = sortedPlayers.slice(i, i + teamSize);
      const team1 = potentialMatch.slice(0, teamSize / 2);
      const team2 = potentialMatch.slice(teamSize / 2);
  
      if (isValidMatch(team1, team2, mmrField, positions)) {
        return { team1, team2 };
      }
    }
  
    return null;
  }
  
  function isValidMatch(team1, team2, mmrField, positions) {
    const team1MMR = team1.reduce((sum, player) => sum + player.userId[mmrField], 0);
    const team2MMR = team2.reduce((sum, player) => sum + player.userId[mmrField], 0);
  
    if (Math.abs(team1MMR - team2MMR) > 800) {
      return false;
    }
  
    return hasValidPositions(team1, positions) && hasValidPositions(team2, positions);
  }
  
  function hasValidPositions(team, positions) {
    const positionCounts = {};
    positions.forEach(pos => positionCounts[pos] = 0);
  
    team.forEach(player => {
      const primaryPos = player.userId.position;
      const secondaryPos = player.userId.secondaryPosition;
  
      if (positionCounts[primaryPos] < getRequiredCount(primaryPos, positions)) {
        positionCounts[primaryPos]++;
      } else if (positionCounts[secondaryPos] < getRequiredCount(secondaryPos, positions)) {
        positionCounts[secondaryPos]++;
      } else {
        // Assign to any available position
        for (const pos of positions) {
          if (positionCounts[pos] < getRequiredCount(pos, positions)) {
            positionCounts[pos]++;
            break;
          }
        }
      }
    });
  
    return positions.every(pos => positionCounts[pos] >= getRequiredCount(pos, positions));
  }
  
  function getRequiredCount(position, positions) {
    if (positions.length === 4) { // 5v5
      return position === 'goalkeeper' ? 1 : 0; // 1 goalkeeper, others flexible
    } else { // 11v11
      switch (position) {
        case 'goalkeeper': return 1;
        case 'fullback': return 2;
        case 'centerback': return 1;
        case 'winger': return 2;
        case 'midfielder': return 2;
        case 'striker': return 1;
        default: return 0;
      }
    }
  }
  
  async function createGame(match, gameMode) {
    const allPlayers = [...match.team1, ...match.team2];
    const playerIds = allPlayers.map(player => player.userId._id);
  
    const game = new Game({
      players: playerIds,
      gameMode: gameMode,
      status: 'lobby',
      startTime: new Date()
    });
  
    await game.save();
  
    // Remove players from queue
    await Queue.deleteMany({ userId: { $in: playerIds } });
  
    // Notify players (implement this based on your notification system)
    allPlayers.forEach(player => notifyPlayer(player.userId._id, game._id));
  }
  
  function notifyPlayer(playerId, gameId) {
    // Implement your notification logic here
    console.log(`Notifying player ${playerId} about game ${gameId}`);
  }
  
  // Helper function to find a match for a single player
  async function findMatchForPlayer(player, gameMode) {
    const mmrField = gameMode === '5v5' ? 'mmr5v5' : 'mmr11v11';
    const teamSize = gameMode === '5v5' ? 10 : 22;
    const positions = gameMode === '5v5' ? POSITIONS_5V5 : POSITIONS_11V11;
  
    // Check if player is already in queue
    const existingQueue = await Queue.findOne({ userId: player._id, gameMode });
    if (existingQueue) {
      console.log(`Player ${player.name} is already in ${gameMode} queue`);
      return;
    }
  
    // Add player to queue
    await Queue.create({ userId: player._id, gameMode });
  
    // Try to find a match
    const match = await tryCreateMatch(gameMode, mmrField, teamSize, positions);
    if (match) {
      await createGame(match, gameMode);
    }
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

  
  // Update the /api/user/:id endpoint
  app.get('/api/user/:id', authMiddleware, async (req, res) => {
    try {
      console.log('Fetching user data for ID:', req.params.id);
      const userId = req.params.id;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if the ID is 'match-history' and handle it separately
      if (userId === 'match-history') {
        return handleMatchHistory(req, res);
      }

      const user = await User.findById(userId);
      
      if (!user) {
        console.log('User not found for ID:', userId);
        return res.status(404).json({ error: 'User not found' });
      }

      const isCurrentUser = req.userId === userId;

      const userData = {
        id: user._id.toString(), // Convert ObjectId to string
        name: user.name,
        email: user.email,
        phone: user.phone,
        sex: user.sex,
        position: user.position,
        secondaryPosition: user.secondaryPosition,
        skillLevel: user.skillLevel,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicturePath ? `/uploads/${user.profilePicturePath}` : null,
        isCurrentUser: isCurrentUser,
        mmr5v5: user.mmr5v5,
        mmr11v11: user.mmr11v11,
        bio: user.bio,
        cityTown: user.cityTown, // Add this line
      };

      console.log('Sending user data:', userData);
      res.json(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });
  
  // Add this new route for match history
  app.get('/api/user/match-history', authMiddleware, handleMatchHistory);

  async function handleMatchHistory(req, res) {
    try {
      const userId = req.userId; // Use the authenticated user's ID
      const limit = parseInt(req.query.limit) || 5;
      console.log(`Fetching match history for user ${userId}, limit: ${limit}`);
      
      const matches = await GameResult.find({ players: userId })
        .sort({ endTime: -1 })
        .limit(limit)
        .populate('players', 'name profilePicturePath');
  
      const formattedMatches = matches.map(match => {
        const userMmrChange = match.mmrChanges.find(change => change.userId.toString() === userId.toString());
        return {
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
          mmrChange: userMmrChange ? userMmrChange.change : 0
        };
      });
  
      res.json(formattedMatches);
    } catch (error) {
      console.error('Error fetching match history:', error);
      res.status(500).json({ error: 'Failed to fetch match history' });
    }
  }

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
      const gameStart = gameStartTime ? new Date(gameStartTime) : now;
      const timeDifference = (now.getTime() - gameStart.getTime()) / (1000 * 60); // difference in minutes
  
      console.log('Leave game request:', { lobbyTime, gameStartTime, timeDifference });
  
      // Find and update the active game for this user
      const activeGame = await Game.findOne({ 
        players: req.userId,
        status: { $in: ['lobby', 'inProgress'] }
      });

      if (activeGame) {
        activeGame.status = 'ended';
        await activeGame.save();
      }

      // Remove the user from any active queues
      await Queue.deleteMany({ userId: req.userId });

      if (lobbyTime >= 8 && timeDifference <= 20) {
        let penalty = await Penalty.findOne({ userId: req.userId });
        if (!penalty) {
          penalty = new Penalty({ userId: req.userId });
        }
  
        penalty.leaveCount += 1;
        penalty.lastLeavePenaltyDate = now;
  
        console.log('Updated penalty:', penalty);
  
        if (penalty.leaveCount >= 3) {
          penalty.penaltyEndTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        }
  
        await penalty.save();
  
        console.log('Penalty saved:', penalty);
  
        res.json({ 
          message: 'Game left successfully', 
          penalized: penalty.leaveCount >= 3,
          penaltyEndTime: penalty.penaltyEndTime
        });
      } else {
        res.json({ message: 'Game left successfully', penalized: false });
      }
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
        .populate('players', 'name mmr5v5 mmr11v11');
  
      const gamesWithDistanceAndMMR = recentGames.map(game => {
        const distance = geolib.getDistance(
          userLocation,
          { latitude: game.coordinates.coordinates[1], longitude: game.coordinates.coordinates[0] }
        );

        // Calculate average MMR
        const totalMMR = game.players.reduce((sum, player) => {
          return sum + (game.mode === '5v5' ? player.mmr5v5 : player.mmr11v11);
        }, 0);
        const averageMMR = Math.round(totalMMR / game.players.length);

        return {
          ...game.toObject(),
          distance: Math.round(distance / 1609.34), // Convert meters to miles and round
          averageMMR
        };
      });
  
      res.json(gamesWithDistanceAndMMR);
    } catch (error) {
      console.error('Error fetching recent games:', error);
      res.status(500).json({ error: 'Failed to fetch recent games' });
    }
  });

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

  // Add this function to create dummy players
  async function createDummyPlayers() {
    const positions = ['goalkeeper', 'center back', 'midfielder', 'striker', 'full back', 'winger'];
    const skillLevels = ['beginner', 'average', 'intermediate', 'advanced', 'pro'];

    for (let i = 0; i < 110; i++) {
      const name = `Dummy${i + 1}`;
      const email = `dummy${i + 1}@example.com`;
      const sex = i % 2 === 0 ? 'male' : 'female';
      const position = positions[i % positions.length];
      const secondaryPosition = positions[Math.floor(i / 20)];
      const skillLevel = skillLevels[Math.floor(i / 20)];
      const dateOfBirth = new Date(1990, 0, 1);

      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash('dummypassword', 10);
        const mmr = getMMRFromSkillLevel(skillLevel);
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
        });
        await user.save();
        console.log(`Created dummy player: ${name} (${position})`);
      }
    }
  }
 
  async function addDummyPlayersToQueue() {
    try {
      const dummyPlayers = await User.find({ email: /^dummy/ });
      const gameModes = ['5v5', '11v11'];
  
      for (const player of dummyPlayers) {
        const randomGameMode = gameModes[Math.floor(Math.random() * gameModes.length)];
        await findMatchForPlayer(player, randomGameMode);
        console.log(`Added dummy player ${player.name} to ${randomGameMode} queue`);
      }
    } catch (error) {
      console.error('Error adding dummy players to queue:', error);
    }
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
      const matches = await GameResult.find({ players: req.userId })
        .sort({ endTime: -1 })
        .limit(limit)
        .populate('players', 'name');

      const formattedMatches = matches.map(match => ({
        id: match._id,
        mode: match.mode,
        blueScore: match.blueScore,
        redScore: match.redScore,
        location: match.location,
        endTime: match.endTime,
        players: match.players.map(player => ({ id: player._id, name: player.name }))
      }));

      res.json(formattedMatches);
    } catch (error) {
      console.error('Error fetching match history:', error);
      res.status(500).json({ error: 'Failed to fetch match history' });
    }
  });

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  setInterval(checkAndResetBanStage, 24 * 60 * 60 * 1000); // Run once a day

  return { startMatchmakingProcess, findMatchForPlayer };
}

startServer()
  .then(({ startMatchmakingProcess, findMatchForPlayer }) => {
    // You can now use startMatchmakingProcess and findMatchForPlayer here if needed
  })
  .catch(error => console.error('Failed to start server:', error));