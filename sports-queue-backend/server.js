require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = express();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // or whatever port your frontend is running on
  credentials: true
}));

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

  app.post('/api/register', async (req, res) => {
    try {
      const { name, email, password, phone, sex, position, skillLevel, dateOfBirth } = req.body;
      
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
      });
      await user.save();
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.status(201).json({ token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed', details: error.message });
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
    const token = req.header('Authorization')?.replace('Bearer ', '');
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
      res.json(user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
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
      const users = await User.find({ 
        name: { $regex: query, $options: 'i' },
        _id: { $ne: req.userId }
      }).select('name');
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  app.post('/api/friends/add', authMiddleware, async (req, res) => {
    try {
      const { friendId } = req.body;
      const newFriend = new Friend({
        user: req.userId,
        friend: friendId,
        status: 'pending'
      });
      await newFriend.save();
      res.status(201).json({ message: 'Friend request sent' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add friend' });
    }
  });

  app.delete('/api/friends/remove', authMiddleware, async (req, res) => {
    try {
      const { friendId } = req.body;
      await Friend.findOneAndDelete({
        $or: [
          { user: req.userId, friend: friendId },
          { user: friendId, friend: req.userId }
        ]
      });
      res.json({ message: 'Friend removed' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  });

  app.get('/api/friends', authMiddleware, async (req, res) => {
    try {
      const friends = await Friend.find({
        $or: [{ user: req.userId }, { friend: req.userId }],
        status: 'accepted'
      }).populate('user friend', 'name');
      res.json(friends);
    } catch (error) {
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

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer().catch(error => console.error('Failed to start server:', error));