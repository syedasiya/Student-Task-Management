const TASK_STATUSES = ['todo', 'in-progress', 'completed'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

function isValidEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && /^\S+@\S+\.\S+$/.test(value.trim());
}

function validateTaskInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Request body must be an object.' };
  }

  const values = {};
  const has = (key) => Object.hasOwn(input, key);
  const text = (key, maxLength, required = false) => {
    if (!has(key)) {
      if (partial) return null;
      if (!required) {
        values[key] = '';
        return null;
      }
    }
    const value = input[key];
    if (typeof value !== 'string') return `${key} must be text.`;
    const trimmed = value.trim();
    if (!trimmed && required) return `${key} is required.`;
    if (trimmed.length > maxLength) return `${key} must be ${maxLength} characters or fewer.`;
    values[key] = trimmed;
    return null;
  };

  let error = text('title', 140, !partial);
  if (error) return { error };
  error = text('description', 500);
  if (error) return { error };
  error = text('subject', 60, !partial);
  if (error) return { error };

  if (has('dueDate') || !partial) {
    if (typeof input.dueDate !== 'string' || Number.isNaN(Date.parse(input.dueDate))) {
      return { error: 'dueDate must be a valid date.' };
    }
    values.dueDate = new Date(input.dueDate);
  }

  if (has('priority') || !partial) {
    const priority = input.priority || 'medium';
    if (!TASK_PRIORITIES.includes(priority)) return { error: 'priority must be low, medium, or high.' };
    values.priority = priority;
  }

  if (has('status') || !partial) {
    const status = input.status || 'todo';
    if (!TASK_STATUSES.includes(status)) return { error: 'status must be todo, in-progress, or completed.' };
    values.status = status;
    values.completed = status === 'completed';
  } else if (has('completed')) {
    if (typeof input.completed !== 'boolean') return { error: 'completed must be a boolean.' };
    values.completed = input.completed;
    values.status = input.completed ? 'completed' : 'todo';
  }

  if (partial && Object.keys(values).length === 0) return { error: 'Provide at least one valid task field to update.' };
  return { values };
}

module.exports = { isValidEmail, validateTaskInput };