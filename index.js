// jobloom-backend/index.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const Redis = require('ioredis');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIALS)),
});

// Initialize Redis cache
const redis = new Redis();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error(err));

// User Authentication Middleware
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Job Application Schema & Model
const jobSchema = new mongoose.Schema({
  userId: String,
  company: String,
  position: String,
  status: String,
  appliedDate: Date,
  followUpDate: Date
});
const Job = mongoose.model('Job', jobSchema);

// CRUD APIs for Job Applications
app.post('/jobs', authenticateUser, async (req, res) => {
  try {
    const job = new Job({ ...req.body, userId: req.user.uid });
    await job.save();
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/jobs', authenticateUser, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.uid });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/jobs/:id', authenticateUser, async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      req.body,
      { new: true }
    );
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/jobs/:id', authenticateUser, async (req, res) => {
  try {
    await Job.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Resume Analysis API
app.post('/analyze-resume', authenticateUser, async (req, res) => {
  try {
    const { resumeText } = req.body;
    const openaiResponse = await axios.post('https://api.openai.com/v1/completions', {
      model: 'gpt-4',
      prompt: `Analyze the following resume and provide strengths, weaknesses, and suggestions: \n\n ${resumeText}`,
      max_tokens: 300,
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    res.json(openaiResponse.data);
  } catch (error) {
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// AI-Powered Interview Preparation API
app.post('/mock-interview', authenticateUser, async (req, res) => {
  try {
    const { jobRole } = req.body;
    const openaiResponse = await axios.post('https://api.openai.com/v1/completions', {
      model: 'gpt-4',
      prompt: `Generate a set of mock interview questions for a ${jobRole} position, along with AI feedback on answers.`,
      max_tokens: 500,
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    res.json(openaiResponse.data);
  } catch (error) {
    res.status(500).json({ error: 'AI mock interview generation failed' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

