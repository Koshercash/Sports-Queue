require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoMemoryServer } = require('mongodb-memory-server');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const path = require('path');
const moment = require('moment');

const app = express();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // make sure this matches your frontend URL
  credentials: true
}));

// Add this line after your other app.use() statements
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

async function startServer() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  console.log('Connected to in-memory MongoDB');

  const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    sex: String,
    position: String,
    skillLevel: String,
    mmr5v5: Number,
    mmr11v11: Number,
    idPicture: String,
    dateOfBirth: Date,
    profilePicturePath: String,
    bio: { type: String, default: '' }, // Add this line
  });

  const User = mongoose.model('User', UserSchema);

  const FriendSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'] }
  });


  const Friend = mongoose.model('Friend', FriendSchema);

  const QueueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gameMode: String,
    timestamp: { type: Date, default: Date.now }
  });

  const Queue = mongoose.model('Queue', QueueSchema);

  const PenaltySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    leaverTally: { type: Number, default: 0 },
    lastPenaltyDate: { type: Date },
    penaltyEndTime: { type: Date }
  });

  const Penalty = mongoose.model('Penalty', PenaltySchema);

  app.post('/api/register', upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'idPicture', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const { name, email, password, phone, sex, position, skillLevel, dateOfBirth } = req.body;
      
      // Log received data for debugging
      console.log('Received registration data:', { name, email, phone, sex, position, skillLevel, dateOfBirth });
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
      if (!name || !email || !password || !phone || !sex || !position || !skillLevel || !dateOfBirth) {
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
        skillLevel,
        mmr5v5: mmr,
        mmr11v11: mmr,
        dateOfBirth: dob,
        profilePicturePath: req.files.profilePicture ? req.files.profilePicture[0].filename : null,
        idPicture: req.files.idPicture ? req.files.idPicture[0].filename : null
      });

      await user.save();
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.status(201).json({ token });
    } catch (error) {
      console.error('Detailed registration error:', error);
      res.status(500).json({ error: 'Registration failed', details: error.message, stack: error.stack });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
      res.json({ token });
    } catch (error) {
      res.status(400).json({ error: 'Login failed' });
    }
  });

  const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
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
        position: user.position,
        skillLevel: user.skillLevel,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicturePath ? `/uploads/${user.profilePicturePath}` : null,
        mmr5v5: user.mmr5v5,
        mmr11v11: user.mmr11v11,
        bio: user.bio, // Add this line
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
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

  app.post('/api/queue/join', authMiddleware, async (req, res) => {
    try {
      const { gameMode } = req.body;
      const user = await User.findById(req.userId);
      const newQueueEntry = new Queue({
        userId: req.userId,
        gameMode
      });
      await newQueueEntry.save();
      
      // Always create a match
      const match = await createMatch(gameMode, user);
      if (match) {
        res.json({ message: 'Match found', match });
      } else {
        res.status(500).json({ error: 'Failed to create match' });
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      res.status(500).json({ error: 'Failed to join queue' });
    }
  });

  app.post('/api/queue/leave', authMiddleware, async (req, res) => {
    try {
      const { gameMode } = req.body;
      console.log(`User ${req.userId} attempting to leave ${gameMode} queue`);
      const result = await Queue.findOneAndDelete({ userId: req.userId, gameMode });
      if (result) {
        console.log(`User ${req.userId} successfully left ${gameMode} queue`);
        res.json({ message: 'Left queue successfully' });
      } else {
        console.log(`No queue entry found for user ${req.userId} in ${gameMode} queue`);
        res.status(404).json({ message: 'No queue entry found' });
      }
    } catch (error) {
      console.error('Error leaving queue:', error);
      res.status(500).json({ error: 'Failed to leave queue' });
    }
  });

  async function createMatch(gameMode, user) {
    const mmrField = gameMode === '5v5' ? 'mmr5v5' : 'mmr11v11';
    const playerCount = gameMode === '5v5' ? 10 : 22;
    
    let players = await Queue.find({ gameMode })
      .populate('userId')
      .sort('timestamp')
      .limit(playerCount);

    // If not enough players in queue, add dummy players
    if (players.length < playerCount) {
      const dummyCount = playerCount - players.length;
      const dummyPlayers = await User.aggregate([
        { $match: { email: { $regex: /^dummy/ }, sex: user.sex } },
        { $sample: { size: dummyCount } }
      ]);

      players = [
        ...players,
        ...dummyPlayers.map(dp => ({ userId: dp }))
      ];
    }

    // Ensure we have enough players
    if (players.length < playerCount) {
      console.log('Not enough players found, including dummies');
      return null;
    }

    // Sort players by MMR difference from the user
    players.sort((a, b) => 
      Math.abs((a.userId[mmrField] || 1000) - user[mmrField]) - 
      Math.abs((b.userId[mmrField] || 1000) - user[mmrField])
    );

    const team1 = [];
    const team2 = [];

    // Distribute players to teams
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const team = i % 2 === 0 ? team1 : team2;
      team.push({
        id: player.userId._id,
        name: player.userId.name,
        position: player.userId.position,
        profilePicture: player.userId.profilePicturePath ? `/uploads/${player.userId.profilePicturePath}` : null,
        mmr: player.userId[mmrField] || 1000
      });
    }

    // Remove matched players from the queue
    await Queue.deleteMany({ userId: { $in: players.map(p => p.userId._id) } });

    return { team1, team2 };
  }

  // Update the /api/user/:id endpoint
  app.get('/api/user/:id', authMiddleware, async (req, res) => {
    try {
      console.log('Fetching user data for ID:', req.params.id);
      const userId = req.params.id;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
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
        skillLevel: user.skillLevel,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicturePath ? `/uploads/${user.profilePicturePath}` : null,
        isCurrentUser: isCurrentUser,
        mmr5v5: user.mmr5v5,
        mmr11v11: user.mmr11v11,
        bio: user.bio, // Add this line
      };

      console.log('Sending user data:', userData);
      res.json(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
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
          dateOfBirth: new Date(userData.dateOfBirth),
        });
        await user.save();
        console.log(`Created sample user: ${userData.name}`);
      }
    }
  }

  // Add this function to create dummy players
  async function createDummyPlayers() {
    const positions = ['goalkeeper', 'defender', 'midfielder', 'striker'];
    const skillLevels = ['beginner', 'average', 'intermediate', 'advanced', 'pro'];

    for (let i = 0; i < 100; i++) {
      const name = `Dummy${i + 1}`;
      const email = `dummy${i + 1}@example.com`;
      const sex = i % 2 === 0 ? 'male' : 'female';
      const position = positions[i % positions.length];
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
          skillLevel,
          mmr5v5: mmr,
          mmr11v11: mmr,
          dateOfBirth,
        });
        await user.save();
        console.log(`Created dummy player: ${name}`);
      }
    }
  }

  // Call this function after connecting to the database
  await createSampleUsers();
  await createDummyPlayers();

  // Add this endpoint to send a dummy friend request
  app.post('/api/penalty/leave', authMiddleware, async (req, res) => {
    try {
      const { gameStartTime } = req.body;
      const now = moment();
      const gameStart = moment(gameStartTime);

      // Check if the user is leaving within 20 minutes before the game or after the game has started
      const shouldApplyPenalty = now.isSameOrAfter(gameStart.subtract(20, 'minutes'));

      if (shouldApplyPenalty) {
        let penalty = await Penalty.findOne({ userId: req.userId });
        if (!penalty) {
          penalty = new Penalty({ userId: req.userId });
        }

        penalty.leaverTally += 1;
        
        if (penalty.leaverTally >= 3) {
          penalty.penaltyEndTime = moment().add(24, 'hours').toDate();
        }

        penalty.lastPenaltyDate = new Date();
        await penalty.save();

        res.json({ message: 'Penalty applied', leaverTally: penalty.leaverTally });
      } else {
        res.json({ message: 'No penalty applied' });
      }
    } catch (error) {
      console.error('Error applying penalty:', error);
      res.status(500).json({ error: 'Failed to apply penalty' });
    }
  });
  
  app.get('/api/penalty/status', authMiddleware, async (req, res) => {
    try {
      let penalty = await Penalty.findOne({ userId: req.userId });
      if (!penalty) {
        penalty = new Penalty({ userId: req.userId });
      }
  
      const now = moment();
      if (penalty.lastPenaltyDate) {
        const daysSinceLastPenalty = now.diff(moment(penalty.lastPenaltyDate), 'days');
        penalty.leaverTally = Math.max(0, penalty.leaverTally - daysSinceLastPenalty);
      }
      
      if (penalty.leaverTally > 0) {
        penalty.lastPenaltyDate = now.toDate();
      }
  
      const isPenalized = penalty.penaltyEndTime && now.isBefore(penalty.penaltyEndTime);
  
      if (!isPenalized && penalty.penaltyEndTime) {
        penalty.penaltyEndTime = null;
      }
  
      await penalty.save();
  
      res.json({
        isPenalized,
        penaltyEndTime: penalty.penaltyEndTime,
        leaverTally: penalty.leaverTally
      });
    } catch (error) {
      console.error('Error checking penalty status:', error);
      res.status(500).json({ error: 'Failed to check penalty status' });
    }
  });
  

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(error => console.error('Failed to start server:', error));