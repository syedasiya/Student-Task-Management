const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is not set. The dashboard will run in demo mode.');
    return false;
  }

  try {
    await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'StudentTaskDB' });
    console.log(`Connected to MongoDB database ${mongoose.connection.name}`);
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    return false;
  }
}

module.exports = { connectDatabase };