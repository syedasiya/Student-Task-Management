const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'offline' });
});
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));

const publicDirectory = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(publicDirectory));
app.get('*path', (req, res) => res.sendFile(path.join(publicDirectory, 'index.html')));
app.use(errorHandler);

module.exports = app;