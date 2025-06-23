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

// اتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// نموذج المستخدم
const userSchema = new mongoose.Schema({
  roro: { type: String, required: true } // تغيير اسم الحقل إلى roro
});

const User = mongoose.model('User', userSchema);

// نموذج التمارين
const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

// الراوت الرئيسي
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// إنشاء مستخدم جديد
app.post('/api/users', async (req, res) => {
  const { roro } = req.body;
  try {
    if (!roro) return res.status(400).json({ error: 'roro is required' });

    const user = new User({ roro });
    const savedUser = await user.save();

    res.json({
      roro: savedUser.roro,
      _id: savedUser._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// جلب كل المستخدمين
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '_id roro');
    const formattedUsers = users.map(u => ({
      roro: u.roro,
      _id: u._id.toString()
    }));
    res.json(formattedUsers);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// إضافة تمرين لمستخدم
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  try {
    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const exerciseDate = date ? new Date(date) : new Date();

    const exercise = new Exercise({
      userId,
      description,
      duration: Number(duration),
      date: exerciseDate
    });

    const savedExercise = await exercise.save();

    res.json({
      roro: user.roro,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(),
      _id: user._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// جلب سجل التمارين
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let query = { userId };

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    let exercisesQuery = Exercise.find(query).select('description duration date');
    if (limit) exercisesQuery = exercisesQuery.limit(Number(limit));

    const exercises = await exercisesQuery;

    res.json({
      roro: user.roro,
      count: exercises.length,
      _id: user._id.toString(),
      log: exercises.map(ex => ({
        description: ex.description,
        duration: ex.duration,
        date: ex.date.toDateString()
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// تشغيل السيرفر
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
