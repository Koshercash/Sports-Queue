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
  });

  const User = mongoose.model('User', UserSchema);

  const FriendSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'blocked'] }
  });


  const Friend = mongoose.model('Friend', FriendSchema);

  const QueueSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gameMode: String,
    timestamp: { type: Date, default: Date.now }
  });

  const Queue = mongoose.model('Queue', QueueSchema);

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
        mmr11v11: user.mmr11v11
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
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
        return res.status(400).json({ error: 'Friendship already exists' });
      }

      const newFriend = new Friend({
        user: req.userId,
        friend: friendId,
        status: 'accepted'
      });
      await newFriend.save();

      // Add reverse friendship
      const reverseFriend = new Friend({
        user: friendId,
        friend: req.userId,
        status: 'accepted'
      });
      await reverseFriend.save();

      res.status(201).json({ message: 'Friend added successfully' });
    } catch (error) {
      console.error('Error adding friend:', error);
      res.status(500).json({ error: 'Failed to add friend' });
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
      const friends = await Friend.find({ user: req.userId }).populate('friend', 'name');
      const formattedFriends = friends.map(f => ({ id: f.friend._id, name: f.friend.name }));
      console.log('Fetched friends:', formattedFriends);
      res.json(formattedFriends);
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
      
      const match = await createMatch(gameMode, user);
      if (match) {
        res.json({ message: 'Match found', match });
      } else {
        res.json({ message: 'Joined queue' });
      }
    } catch (error) {
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
    
    const players = await Queue.find({ gameMode })
      .populate('userId')
      .sort('timestamp')
      .limit(playerCount);

    if (players.length < playerCount) return null;

    const matchedPlayers = players.filter(p => p.userId.sex === user.sex);
    if (matchedPlayers.length < playerCount) return null;

    matchedPlayers.sort((a, b) => Math.abs(a.userId[mmrField] - user[mmrField]) - Math.abs(b.userId[mmrField] - user[mmrField]));

    const team1 = [];
    const team2 = [];

    function addToTeam(player, team) {
      team.push({
        id: player.userId._id,
        name: player.userId.name,
        position: player.userId.position,
        mmr: player.userId[mmrField]
      });
    }

    function isTeamValid(team, gameMode) {
      if (gameMode === '5v5') {
        const goalie = team.filter(p => p.position === 'goalkeeper').length;
        const attackers = team.filter(p => ['winger', 'forward', 'midfielder'].includes(p.position)).length;
        const defenders = team.filter(p => ['fullback', 'centerback'].includes(p.position)).length;
        return goalie === 1 && attackers >= 2 && attackers <= 3 && defenders >= 1 && defenders <= 2;
      } else {
        const goalie = team.filter(p => p.position === 'goalkeeper').length;
        const wingers = team.filter(p => p.position === 'winger').length;
        const forwards = team.filter(p => p.position === 'forward').length;
        const midfielders = team.filter(p => p.position === 'midfielder').length;
        const fullbacks = team.filter(p => p.position === 'fullback').length;
        const centerbacks = team.filter(p => p.position === 'centerback').length;
        return goalie === 1 && wingers === 2 && forwards >= 1 && forwards <= 2 &&
               midfielders >= 2 && midfielders <= 3 && fullbacks === 2 &&
               centerbacks >= 1 && centerbacks <= 2 && team.length === 11;
      }
    }

    for (const player of matchedPlayers) {
      if (team1.length < playerCount / 2 && !isTeamValid(team1, gameMode)) {
        addToTeam(player, team1);
      } else if (team2.length < playerCount / 2 && !isTeamValid(team2, gameMode)) {
        addToTeam(player, team2);
      }

      if (isTeamValid(team1, gameMode) && isTeamValid(team2, gameMode)) {
        await Queue.deleteMany({ userId: { $in: [...team1, ...team2].map(p => p.id) } });
        return { team1, team2 };
      }
    }

    return null;
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
        mmr11v11: user.mmr11v11
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

  // Call this function after connecting to the database
  await createSampleUsers();

  // Add this endpoint to send a dummy friend request
  app.post('/api/friends/send-dummy-request', authMiddleware, async (req, res) => {
    try {
      const currentUser = await User.findById(req.userId);
      const dummyFriend = await User.findOne({ name: 'Alice' });

      if (!dummyFriend) {
        return res.status(404).json({ error: 'Dummy friend not found' });
      }

      const existingFriendship = await Friend.findOne({
        $or: [
          { user: currentUser._id, friend: dummyFriend._id },
          { user: dummyFriend._id, friend: currentUser._id }
        ]
      });

      if (existingFriendship) {
        return res.status(400).json({ error: 'Friendship already exists' });
      }

      const newFriend = new Friend({
        user: currentUser._id,
        friend: dummyFriend._id,
        status: 'accepted'
      });
      await newFriend.save();

      const reverseFriend = new Friend({
        user: dummyFriend._id,
        friend: currentUser._id,
        status: 'accepted'
      });
      await reverseFriend.save();

      res.status(201).json({ message: 'Dummy friend request sent and accepted' });
    } catch (error) {
      console.error('Error sending dummy friend request:', error);
      res.status(500).json({ error: 'Failed to send dummy friend request' });
    }
  });

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(error => console.error('Failed to start server:', error));