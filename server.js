require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const programRoutes = require('./routes/program');
const workoutRoutes = require('./routes/workouts');
const activityRoutes = require('./routes/activities');
const foodRoutes = require('./routes/food');
const sleepRoutes = require('./routes/sleep');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/program', programRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/sleep', sleepRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'BQ Fitness API' }));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => {
  console.log(`BQ Fitness server berjalan di http://localhost:${PORT}`);
});
