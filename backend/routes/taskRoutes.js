const express = require('express');
const Task = require('../models/Task');
const { requireAuth, requireDatabase } = require('../middleware/auth');
const { validateTaskInput } = require('../utils/validation');

const router = express.Router();
router.use(requireDatabase, requireAuth);

router.get('/', async (req, res) => {
  const { status, priority, subject, q, sort } = req.query;
  if (status && !['todo', 'in-progress', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status filter.' });
  }
  if (priority && !['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority filter.' });
  }
  if (q && (typeof q !== 'string' || q.length > 120)) {
    return res.status(400).json({ message: 'Search query must be 120 characters or fewer.' });
  }

  const filter = { userId: req.userId };
  const conditions = [];
  if (status === 'completed') conditions.push({ $or: [{ status: 'completed' }, { completed: true }] });
  if (status === 'todo') conditions.push({ $or: [{ status: 'todo' }, { status: { $exists: false }, completed: { $ne: true } }] });
  if (status === 'in-progress') filter.status = status;
  if (priority) filter.priority = priority;
  if (subject) filter.subject = String(subject).trim();
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'i');
    conditions.push({ $or: [{ title: expression }, { subject: expression }, { description: expression }] });
  }
  if (conditions.length) filter.$and = conditions;

  const sortBy = sort === 'createdAt' ? { createdAt: -1 } : { dueDate: 1, createdAt: -1 };
  const tasks = await Task.find(filter).sort(sortBy);
  res.json({ tasks });
});

router.post('/', async (req, res) => {
  const { values, error } = validateTaskInput(req.body);
  if (error) return res.status(400).json({ message: error });
  if (values.status === 'completed') values.completedAt = new Date();
  const task = await Task.create({ userId: req.userId, ...values });
  res.status(201).json({ task });
});

router.patch('/:id', async (req, res) => {
  const { values, error } = validateTaskInput(req.body, { partial: true });
  if (error) return res.status(400).json({ message: error });
  if (values.status) values.completedAt = values.status === 'completed' ? new Date() : null;
  const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, values, { new: true, runValidators: true });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  res.json({ task });
});

router.patch('/:id/status', async (req, res) => {
  const { values, error } = validateTaskInput({ status: req.body?.status }, { partial: true });
  if (error) return res.status(400).json({ message: error });
  values.completedAt = values.status === 'completed' ? new Date() : null;
  const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, values, { new: true, runValidators: true });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  res.json({ task });
});

router.delete('/:id', async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  res.status(204).end();
});

module.exports = router;