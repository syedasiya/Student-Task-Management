const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidEmail, validateTaskInput } = require('../utils/validation');

test('validates and normalizes registration emails', () => {
  assert.equal(isValidEmail('student@example.edu'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('x'.repeat(250) + '@example.edu'), false);
});

test('applies task defaults and trims text', () => {
  const result = validateTaskInput({ title: '  Read chapter  ', subject: ' Biology ', dueDate: '2026-11-18' });
  assert.equal(result.error, undefined);
  assert.equal(result.values.title, 'Read chapter');
  assert.equal(result.values.subject, 'Biology');
  assert.equal(result.values.priority, 'medium');
  assert.equal(result.values.status, 'todo');
  assert.equal(result.values.completed, false);
});

test('rejects invalid task dates, priorities, and statuses', () => {
  const base = { title: 'Read chapter', subject: 'Biology', dueDate: '2026-11-18' };
  assert.match(validateTaskInput({ ...base, dueDate: 'tomorrow' }).error, /dueDate/);
  assert.match(validateTaskInput({ ...base, priority: 'urgent' }).error, /priority/);
  assert.match(validateTaskInput({ ...base, status: 'blocked' }).error, /status/);
});

test('keeps status and legacy completion fields in sync', () => {
  assert.deepEqual(validateTaskInput({ status: 'in-progress' }, { partial: true }).values, {
    status: 'in-progress', completed: false
  });
  assert.deepEqual(validateTaskInput({ completed: true }, { partial: true }).values, {
    completed: true, status: 'completed'
  });
});

test('rejects empty or malformed partial updates', () => {
  assert.match(validateTaskInput({}, { partial: true }).error, /at least one/);
  assert.match(validateTaskInput({ description: 4 }, { partial: true }).error, /description/);
});