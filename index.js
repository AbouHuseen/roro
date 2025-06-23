const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Exercise Schema
const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Home route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// POST /api/users — Create new user
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  try {
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const user = new User({ username });
    const savedUser = await user.save();

    res.json({
      username: savedUser.username,
      _id: savedUser._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users — Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '_id username').lean();
    // Lean() returns plain JS objects instead of Mongoose docs, useful for mapping

    res.json(users.map(user => ({
      username: user.username,
      _id: user._id.toString()
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:_id/exercises — Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  try {
    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Use provided date or current date if missing
    let exerciseDate = date ? new Date(date) : new Date();
    // If date is invalid, fallback to current date
    if (exerciseDate.toString() === 'Invalid Date') exerciseDate = new Date();

    const exercise = new Exercise({
      userId,
      description,
      duration: Number(duration),
      date: exerciseDate
    });

    const savedExercise = await exercise.save();

    res.json({
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(), // string format
      _id: user._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:_id/logs — Get exercise logs with optional filters
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let query = { userId };

    // Date filtering
    if (from || to) {
      query.date = {};
      if (from) {
        const fromDate = new Date(from);
        if (fromDate.toString() !== 'Invalid Date') query.date.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (toDate.toString() !== 'Invalid Date') query.date.$lte = toDate;
      }
    }

    let exercisesQuery = Exercise.find(query).select('description duration date');
    if (limit) exercisesQuery = exercisesQuery.limit(Number(limit));

    const exercises = await exercisesQuery.exec();

    res.json({
      username: user.username,
      count: exercises.length,
      _id: user._id.toString(),
      log: exercises.map(ex => ({
        description: ex.description,
        duration: ex.duration,
        date: ex.date.toDateString()
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
