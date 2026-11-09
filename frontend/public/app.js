const STORAGE_KEY = 'tandem.tasks.v1';
const TOKEN_KEY = 'tandem.token';
const USER_KEY = 'tandem.user';
const THEME_KEY = 'tandem.theme.v1';
const WORKSPACE_KEY = 'tandem.workspace-open';
const subjectColors = ['#d58b67', '#7185b4', '#78a080', '#b483ad', '#d2a44f', '#7b9f9e'];
const today = new Date();
today.setHours(0, 0, 0, 0);

const seedTasks = [
  { id: 'demo-1', title: 'Finish cell division study notes', description: 'Review lecture 8 and label the mitosis diagrams.', subject: 'Biology', dueDate: addDays(0), priority: 'high', status: 'in-progress', completed: false },
  { id: 'demo-2', title: 'Problem set 6: integrals', description: 'Work through questions 1–8 before the study group.', subject: 'Mathematics', dueDate: addDays(1), priority: 'medium', status: 'todo', completed: false },
  { id: 'demo-3', title: 'Read The Great Gatsby, chapters 4–5', description: 'Make a few notes on recurring imagery.', subject: 'Literature', dueDate: addDays(2), priority: 'low', status: 'todo', completed: false },
  { id: 'demo-4', title: 'Outline essay on the Industrial Revolution', description: 'Draft a thesis and three supporting sections.', subject: 'History', dueDate: addDays(3), priority: 'medium', status: 'todo', completed: false },
  { id: 'demo-5', title: 'Review lecture slides: inheritance', description: '', subject: 'Biology', dueDate: addDays(-1), priority: 'low', status: 'completed', completed: true, completedAt: `${addDays(-1)}T15:00:00` },
  { id: 'demo-6', title: 'Quiz prep: limits and continuity', description: '', subject: 'Mathematics', dueDate: addDays(-2), priority: 'medium', status: 'completed', completed: true, completedAt: `${addDays(-3)}T15:00:00` }
];

let state = {
  tasks: loadTasks(), filter: 'all', priorityFilter: 'all', query: '', sortDescending: false, editingId: null, taskView: 'list',
  token: localStorage.getItem(TOKEN_KEY), user: readUser(), isCloud: false,
  focusTimer: null, focusRemaining: 25 * 60, toastTimer: null, authMode: 'login',
  theme: localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light',
  calendarMonth: new Date(today.getFullYear(), today.getMonth(), 1), calendarSelected: addDays(0), deleteId: null
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const elements = { taskList: $('#task-list'), taskBoard: $('#task-board'), taskModal: $('#task-modal'), taskForm: $('#task-form'), authModal: $('#auth-modal'), authForm: $('#auth-form'), toast: $('#toast'), search: $('#search-input'), upNext: $('#up-next-list') };

function addDays(offset) {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : seedTasks;
  } catch { return seedTasks; }
}
function readUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) || { name: 'Sam Student', email: 'sam@student.demo' }; }
  catch { return { name: 'Sam Student', email: 'sam@student.demo' }; }
}
function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', options);
}
function dueLabel(value) {
  const days = Math.round((new Date(`${value}T00:00:00`) - today) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return formatDate(value);
}
function colorFor(subject) {
  let hash = 0;
  for (const character of subject) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return subjectColors[hash % subjectColors.length];
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function initial(name) { return (name || 'S').trim().charAt(0).toUpperCase(); }
function persist() { if (!state.isCloud) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks)); }

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...options.headers }
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
  return data;
}
function taskStatus(task) { return task.status || (task.completed ? 'completed' : 'todo'); }
function mapTask(task) {
  const status = taskStatus(task);
  return { ...task, id: task._id || task.id, dueDate: task.dueDate.slice(0, 10), status, completed: status === 'completed' };
}
async function syncCloud() {
  if (!state.token) return;
  try {
    const [{ user }, { tasks }] = await Promise.all([api('/auth/me'), api('/tasks')]);
    state.user = user;
    state.tasks = tasks.map(mapTask);
    state.isCloud = true;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setScreen('workspace');
    render();
  } catch {
    state.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }
}

function setScreen(screen, remember = true) {
  const inWorkspace = screen === 'workspace';
  $('#landing-page').hidden = inWorkspace;
  $('#workspace').hidden = !inWorkspace;
  if (remember) localStorage.setItem(WORKSPACE_KEY, String(inWorkspace));
}

function applyTheme() {
  document.body.dataset.theme = state.theme;
  const isDark = state.theme === 'dark';
  const themeButton = $('#theme-toggle');
  themeButton.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  themeButton.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
  themeButton.innerHTML = isDark
    ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>';
}

function render() {
  const pending = state.tasks.filter((task) => taskStatus(task) !== 'completed');
  const completed = state.tasks.filter((task) => taskStatus(task) === 'completed');
  const dueToday = pending.filter((task) => task.dueDate === addDays(0));
  const overdue = pending.filter((task) => task.dueDate < addDays(0));
  const completedThisWeek = completed.filter((task) => {
    const completionDate = task.completedAt ? dateKey(new Date(task.completedAt)) : task.dueDate;
    const daysAgo = Math.round((today - new Date(`${completionDate}T00:00:00`)) / 86400000);
    return daysAgo >= 0 && daysAgo < 7;
  }).length;
  const progress = Math.min(100, Math.round((completedThisWeek / Math.max(1, Math.min(state.tasks.length, 7))) * 100));
  $('#pending-count').textContent = pending.length;
  $('#total-count').textContent = state.tasks.length;
  $('#completed-count').textContent = completed.length;
  $('#overdue-count').textContent = overdue.length;
  $('#today-count').textContent = dueToday.length;
  $('#pending-caption').textContent = pending.length ? `${pending.length} on your list` : 'You’re all caught up';
  $('#nav-count').textContent = pending.length;
  $('#week-percent').textContent = `${progress}%`;
  $('#week-progress').style.width = `${progress}%`;
  $('#week-summary').textContent = completed.length ? `${completed.length} task${completed.length === 1 ? '' : 's'} checked off. Keep it going.` : 'A fresh start. Let’s make it count.';
  $('#current-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  $('#profile-name').textContent = state.user.name;
  $('#profile-avatar').textContent = initial(state.user.name);
  $('#top-avatar').textContent = initial(state.user.name);
  $('#profile-mode').textContent = state.isCloud ? 'Cloud workspace' : 'Demo workspace';
  $('#footer-mode').textContent = state.isCloud ? 'Cloud sync on · Your data is private' : 'Demo mode · Your tasks stay on this device';
  renderSubjects();
  renderInsights();
  renderTasks();
  renderUpcoming();
  if (!$('#calendar-page').hidden) renderCalendar();
  if (!$('#profile-page').hidden) renderProfile();
}
function renderSubjects() {
  const counts = new Map();
  for (const task of state.tasks.filter((item) => taskStatus(item) !== 'completed')) counts.set(task.subject, (counts.get(task.subject) || 0) + 1);
  $('#course-list').innerHTML = [...counts].slice(0, 5).map(([subject, count]) => `<div class="course-item"><span class="course-dot" style="background:${colorFor(subject)}"></span><span class="course-name">${escapeHtml(subject)}</span><span class="course-total">${count}</span></div>`).join('');
}
function renderInsights() {
  const completedDays = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(offset - 6);
    const count = state.tasks.filter((task) => task.completedAt && dateKey(new Date(task.completedAt)) === date).length;
    return { date, count };
  });
  const peak = Math.max(1, ...completedDays.map((day) => day.count));
  $('#weekly-chart').innerHTML = completedDays.map(({ date, count }) => {
    const height = count ? Math.max(14, Math.round((count / peak) * 100)) : 5;
    return `<div class="chart-day" aria-label="${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}: ${count} tasks completed"><div class="chart-bar-track"><span class="chart-bar ${count ? '' : 'is-empty'}" style="height:${height}%"></span><b>${count || ''}</b></div><small>${formatDate(date, { weekday: 'short' })}</small></div>`;
  }).join('');
  const completed = state.tasks.filter((task) => taskStatus(task) === 'completed').length;
  const completionRate = state.tasks.length ? Math.round((completed / state.tasks.length) * 100) : 0;
  $('#completion-rate').textContent = `${completionRate}%`;
  $('#completion-ring').style.setProperty('--completion', `${completionRate}%`);
}
function renderTasks() {
  let tasks = [...state.tasks];
  if (state.filter === 'pending') tasks = tasks.filter((task) => taskStatus(task) !== 'completed');
  if (state.filter === 'completed') tasks = tasks.filter((task) => taskStatus(task) === 'completed');
  if (state.priorityFilter !== 'all') tasks = tasks.filter((task) => task.priority === state.priorityFilter);
  if (state.query) tasks = tasks.filter((task) => `${task.title} ${task.description || ''} ${task.subject}`.toLowerCase().includes(state.query));
  tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate) * (state.sortDescending ? -1 : 1));
  const isOverview = $('#breadcrumb').textContent === 'Overview';
  if (isOverview && state.filter !== 'completed') tasks = tasks.filter((task) => taskStatus(task) !== 'completed').slice(0, 5);
  const showBoard = !isOverview && state.taskView === 'board';
  elements.taskList.hidden = showBoard;
  elements.taskBoard.hidden = !showBoard;
  elements.taskBoard.classList.toggle('is-visible', showBoard);
  if (showBoard) renderTaskBoard(tasks);
  if (!tasks.length) {
    const isSearch = Boolean(state.query);
    if (!showBoard) elements.taskList.innerHTML = `<div class="empty-state"><span class="empty-state-mark">${isSearch ? '⌕' : '✓'}</span><strong>${isSearch ? 'Nothing matches that search' : 'Nothing on your list'}</strong><p>${isSearch ? 'Try another title or subject.' : 'A good time to take a breather.'}</p></div>`;
  } else {
    elements.taskList.innerHTML = tasks.map((task, index) => {
      const days = Math.round((new Date(`${task.dueDate}T00:00:00`) - today) / 86400000);
      const dueClass = !task.completed && days < 0 ? 'is-late' : !task.completed && days <= 1 ? 'is-soon' : '';
      return `<article class="task-row ${task.completed ? 'is-complete' : ''}" style="animation-delay:${index * 35}ms">
        <input class="task-check" type="checkbox" data-toggle-task="${escapeHtml(task.id)}" ${task.completed ? 'checked' : ''} aria-label="Mark ${escapeHtml(task.title)} ${task.completed ? 'incomplete' : 'complete'}" />
        <div class="task-main"><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta"><span class="task-subject-dot" style="background:${colorFor(task.subject)}"></span><span>${escapeHtml(task.subject)}</span>${task.priority === 'high' ? '<span>·</span><span>High priority</span>' : ''}</div></div>
        <span class="task-due ${dueClass}">${dueLabel(task.dueDate)}</span>
        <span class="task-actions"><button class="task-action" data-edit-task="${escapeHtml(task.id)}" aria-label="Edit ${escapeHtml(task.title)}" title="Edit task"><svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></svg></button><button class="task-action" data-delete-task="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg></button></span>
      </article>`;
    }).join('');
  }
  const totalPending = state.tasks.filter((task) => taskStatus(task) !== 'completed').length;
  $('#list-footer').textContent = $('#breadcrumb').textContent === 'Overview' && totalPending > 5 ? `Showing 5 of ${totalPending} tasks` : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
}
function renderTaskBoard(tasks) {
  const columns = [
    { status: 'todo', title: 'To do', tone: 'todo' },
    { status: 'in-progress', title: 'In progress', tone: 'progress' },
    { status: 'completed', title: 'Completed', tone: 'complete' }
  ];
  elements.taskBoard.innerHTML = columns.map((column) => {
    const items = tasks.filter((task) => taskStatus(task) === column.status);
    return `<section class="board-column" data-board-lane="${column.status}"><header class="board-column-heading"><span class="lane-name"><i class="lane-dot ${column.tone}"></i>${column.title}<span class="lane-count">${items.length}</span></span><button class="lane-add" data-add-status="${column.status}" aria-label="Add ${column.title.toLowerCase()} task" title="Add task">+</button></header><div class="board-card-list">${items.length ? items.map((task) => `<article class="board-card" draggable="true" data-board-task="${escapeHtml(task.id)}"><div class="board-card-top"><span class="priority-tag priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority || 'medium')}</span><button class="task-action" data-delete-task="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg></button></div><button class="board-card-title" data-edit-task="${escapeHtml(task.id)}">${escapeHtml(task.title)}</button>${task.description ? `<p class="board-card-description">${escapeHtml(task.description)}</p>` : ''}<div class="board-card-meta"><span class="subject-pill"><i style="background:${colorFor(task.subject)}"></i>${escapeHtml(task.subject)}</span><span class="board-due ${!task.completed && task.dueDate < addDays(0) ? 'is-late' : ''}">${dueLabel(task.dueDate)}</span></div><label class="board-status-label"><span>Move to</span><select data-task-status="${escapeHtml(task.id)}" aria-label="Change ${escapeHtml(task.title)} status"><option value="todo" ${column.status === 'todo' ? 'selected' : ''}>To do</option><option value="in-progress" ${column.status === 'in-progress' ? 'selected' : ''}>In progress</option><option value="completed" ${column.status === 'completed' ? 'selected' : ''}>Completed</option></select></label></article>`).join('') : `<div class="board-empty">${state.query ? 'No matching tasks' : 'Nothing here yet'}</div>`}</div><button class="board-add" data-add-status="${column.status}">+ Add task</button></section>`;
  }).join('');
}
function renderUpcoming() {
  const upcoming = state.tasks.filter((task) => taskStatus(task) !== 'completed').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  elements.upNext.innerHTML = upcoming.length ? upcoming.map((task) => `<div class="up-next-item"><span class="date-tile"><small>${formatDate(task.dueDate, { month: 'short' }).toUpperCase()}</small><strong>${new Date(`${task.dueDate}T12:00:00`).getDate()}</strong></span><span class="up-next-copy"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.subject)} · ${dueLabel(task.dueDate)}</small></span></div>`).join('') : '<div class="up-next-empty">Your calendar is clear.</div>';
}
function renderCalendar() {
  const year = state.calendarMonth.getFullYear();
  const month = state.calendarMonth.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cellCount = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  $('#calendar-month-label').textContent = state.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  $('#calendar-grid').innerHTML = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, index - offset + 1);
    const key = dateKey(date);
    const tasks = state.tasks.filter((task) => task.dueDate === key);
    const pending = tasks.some((task) => taskStatus(task) !== 'completed');
    const classes = ['calendar-day', date.getMonth() !== month ? 'is-other-month' : '', key === state.calendarSelected ? 'is-selected' : '', key === addDays(0) ? 'is-today' : '', key < addDays(0) && pending ? 'has-overdue' : ''].filter(Boolean).join(' ');
    const dots = tasks.slice(0, 3).map((task) => `<i class="calendar-dot ${taskStatus(task) === 'completed' ? 'is-done' : ''}" style="--subject-color:${colorFor(task.subject)}"></i>`).join('');
    return `<button class="${classes}" data-calendar-date="${key}" aria-label="${formatDate(key, { weekday: 'long', month: 'long', day: 'numeric' })}, ${tasks.length} tasks"><span>${date.getDate()}</span><span class="calendar-day-dots">${dots}${tasks.length > 3 ? `<small>+${tasks.length - 3}</small>` : ''}</span></button>`;
  }).join('');
  const selected = new Date(`${state.calendarSelected}T12:00:00`);
  $('#calendar-selected-label').textContent = selected.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const tasks = state.tasks.filter((task) => task.dueDate === state.calendarSelected).sort((a, b) => a.priority.localeCompare(b.priority));
  $('#calendar-day-tasks').innerHTML = tasks.length ? tasks.map((task) => `<article class="calendar-task"><span class="priority-tag priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.subject)} · ${escapeHtml(task.status === 'in-progress' ? 'In progress' : task.completed ? 'Completed' : 'To do')}</small><span class="calendar-task-actions"><button class="text-button" data-calendar-edit="${escapeHtml(task.id)}">Edit</button><button class="text-button" data-delete-task="${escapeHtml(task.id)}">Delete</button></span></article>`).join('') : '<div class="calendar-empty"><span>✦</span><strong>No deadlines this day</strong><small>Enjoy the breathing room or add a task.</small></div>';
}
function renderProfile() {
  $('#profile-name-input').value = state.user.name || '';
  $('#profile-email-input').value = state.user.email || '';
  $('#profile-large-avatar').textContent = initial(state.user.name);
  $('#signout-button').hidden = !state.isCloud;
}
async function saveProfile(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData($('#profile-form')));
  try {
    const user = state.isCloud ? (await api('/auth/me', { method: 'PATCH', body: JSON.stringify(values) })).user : { ...state.user, ...values };
    state.user = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    render();
    showToast('Profile updated.');
  } catch (error) { showToast(error.message); }
}
async function changePassword(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData($('#password-form')));
  if (values.newPassword !== values.confirmPassword) return showToast('Your new passwords do not match.');
  if (!state.isCloud) return showToast('Sign in to a cloud account to change its password.');
  delete values.confirmPassword;
  try {
    const result = await api('/auth/me/password', { method: 'PATCH', body: JSON.stringify(values) });
    $('#password-form').reset();
    showToast(result.message);
  } catch (error) { showToast(error.message); }
}
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 2800);
}
function showTaskModal(task = null, status = 'todo') {
  state.editingId = task?.id || null;
  $('#modal-title').textContent = task ? 'Edit task' : 'Add a task';
  $('#save-task-button').innerHTML = task ? 'Save changes <span>→</span>' : 'Add task <span>→</span>';
  $('#task-title').value = task?.title || '';
  $('#task-description').value = task?.description || '';
  $('#task-subject').value = task?.subject || '';
  $('#task-date').value = task?.dueDate || (!$('#calendar-page').hidden ? state.calendarSelected : addDays(1));
  $('#task-priority').value = task?.priority || 'medium';
  $('#task-status').value = task ? taskStatus(task) : status;
  elements.taskModal.hidden = false;
  $('#task-title').focus();
}
function closeTaskModal() { elements.taskModal.hidden = true; state.editingId = null; }
async function saveTask(values) {
  values.status = values.status || 'todo';
  values.completed = values.status === 'completed';
  values.completedAt = values.completed ? (state.tasks.find((task) => task.id === state.editingId)?.completedAt || new Date().toISOString()) : null;
  if (state.isCloud) {
    const task = state.tasks.find((item) => item.id === state.editingId);
    if (task) await api(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(values) });
    else values.id = (await api('/tasks', { method: 'POST', body: JSON.stringify(values) })).task._id;
  }
  if (state.editingId) state.tasks = state.tasks.map((task) => task.id === state.editingId ? { ...task, ...values } : task);
  else state.tasks.push({ ...values, id: values.id || `local-${Date.now()}` });
  persist();
}
async function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const completed = !task.completed;
  if (state.isCloud) await api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: completed ? 'completed' : 'todo' }) });
  task.completed = completed;
  task.status = completed ? 'completed' : 'todo';
  task.completedAt = completed ? new Date().toISOString() : null;
  persist();
  render();
  showToast(completed ? 'One more thing off your plate.' : 'Task moved back to your list.');
}
async function updateTaskStatus(id, status) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || !['todo', 'in-progress', 'completed'].includes(status)) return;
  if (state.isCloud) await api(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  task.status = status;
  task.completed = status === 'completed';
  task.completedAt = task.completed ? new Date().toISOString() : null;
  persist();
  render();
  showToast('Task status updated.');
}
async function deleteTask(id) {
  if (state.isCloud) await api(`/tasks/${id}`, { method: 'DELETE' });
  state.tasks = state.tasks.filter((task) => task.id !== id);
  persist();
  render();
  showToast('Task removed.');
}
function requestDelete(id) {
  state.deleteId = id;
  $('#delete-modal').hidden = false;
  $('#confirm-delete').focus();
}
function closeDeleteModal() {
  $('#delete-modal').hidden = true;
  state.deleteId = null;
}
function setView(view) {
  const isDashboard = view === 'overview' || view === 'tasks';
  const isTasks = view === 'tasks';
  state.taskView = isTasks ? 'board' : 'list';
  $('#workspace-view').hidden = !isDashboard;
  $('#calendar-page').hidden = view !== 'calendar';
  $('#profile-page').hidden = view !== 'profile';
  $('#breadcrumb').textContent = view === 'overview' ? 'Overview' : view === 'tasks' ? 'My tasks' : view === 'calendar' ? 'Calendar' : 'Profile';
  $('#page-title').innerHTML = isTasks ? 'All your tasks<span>.</span>' : 'Your week, <span>in focus.</span>';
  $('#greeting-subtitle').textContent = isTasks ? 'Everything you’re working on, in one place.' : 'A little progress adds up. Let’s see what’s on your plate.';
  $('#list-title').textContent = isTasks ? 'All tasks' : 'Coming up';
  $('#list-description').textContent = isTasks ? 'Your academic to-do list.' : 'Your next steps, all in one place.';
  $('#view-all-button').hidden = isTasks;
  $$('[data-task-view]').forEach((button) => button.classList.toggle('is-selected', button.dataset.taskView === state.taskView));
  $$('.nav-link').forEach((link) => link.classList.toggle('is-active', link.dataset.view === view));
  $('#sidebar').classList.remove('is-open');
  if (isDashboard) renderTasks();
  if (view === 'calendar') renderCalendar();
  if (view === 'profile') renderProfile();
}
function signOut() {
  if (!state.isCloud) return;
  state.token = null;
  state.user = { name: 'Sam Student', email: 'sam@student.demo' };
  state.tasks = loadTasks();
  state.isCloud = false;
  state.query = '';
  elements.search.value = '';
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  setScreen('landing');
  render();
  showToast('Signed out successfully.');
}
function openAuth(mode = 'login') {
  if (state.isCloud) {
    signOut();
    return;
  }
  state.authMode = mode;
  $('#auth-error').textContent = '';
  elements.authForm.reset();
  updateAuthMode();
  elements.authModal.hidden = false;
  elements.authForm.elements.email.focus();
}
function updateAuthMode() {
  const isRegister = state.authMode === 'register';
  $('#auth-title').textContent = isRegister ? 'Create your account' : 'Welcome back';
  $('#auth-name-label').hidden = !isRegister;
  $('#auth-confirm-label').hidden = !isRegister;
  elements.authForm.elements.name.required = isRegister;
  elements.authForm.elements.confirmPassword.required = isRegister;
  elements.authForm.elements.password.autocomplete = isRegister ? 'new-password' : 'current-password';
  $('#auth-submit').innerHTML = isRegister ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  $$('.auth-tab').forEach((tab) => tab.classList.toggle('is-selected', tab.dataset.authMode === state.authMode));
}
async function submitAuth(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(elements.authForm));
  const endpoint = state.authMode === 'register' ? '/auth/register' : '/auth/login';
  $('#auth-error').textContent = '';
  if (state.authMode === 'register' && values.password !== values.confirmPassword) {
    $('#auth-error').textContent = 'Your passwords do not match.';
    return;
  }
  delete values.confirmPassword;
  try {
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify(values) });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem(TOKEN_KEY, state.token);
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    const { tasks } = await api('/tasks');
    state.tasks = tasks.map(mapTask);
    state.isCloud = true;
    elements.authModal.hidden = true;
    setScreen('workspace');
    render();
    showToast(state.authMode === 'register' ? 'Your study space is ready.' : 'Welcome back.');
  } catch (error) { $('#auth-error').textContent = error.message; }
}
function startFocus() {
  const button = $('#focus-button');
  if (state.focusTimer) {
    clearInterval(state.focusTimer); state.focusTimer = null; state.focusRemaining = 25 * 60;
    button.classList.remove('is-running');
    button.innerHTML = '<svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6z"/></svg>';
    button.title = 'Start a 25-minute focus session';
    showToast('Focus session paused. Take your time.');
    return;
  }
  button.classList.add('is-running');
  button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 6h3v12H8zM14 6h3v12h-3z"/></svg>';
  showToast('25 minutes, one thing at a time.');
  state.focusTimer = setInterval(() => {
    state.focusRemaining -= 1;
    const minutes = String(Math.floor(state.focusRemaining / 60)).padStart(2, '0');
    const seconds = String(state.focusRemaining % 60).padStart(2, '0');
    button.title = `${minutes}:${seconds} remaining · Click to stop`;
    if (state.focusRemaining <= 0) {
      clearInterval(state.focusTimer); state.focusTimer = null; state.focusRemaining = 25 * 60;
      button.classList.remove('is-running');
      button.innerHTML = '<svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6z"/></svg>';
      button.title = 'Start a 25-minute focus session';
      showToast('Focus session complete. Nice work.');
    }
  }, 1000);
}

elements.taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(elements.taskForm));
  const wasEditing = Boolean(state.editingId);
  try { await saveTask(values); closeTaskModal(); render(); showToast(wasEditing ? 'Task updated.' : 'Task added to your list.'); }
  catch (error) { showToast(error.message); }
});
elements.taskList.addEventListener('change', async (event) => {
  const id = event.target.dataset.toggleTask;
  if (id) try { await toggleTask(id); } catch (error) { showToast(error.message); render(); }
});
elements.taskList.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-task]');
  const remove = event.target.closest('[data-delete-task]');
  if (edit) showTaskModal(state.tasks.find((task) => task.id === edit.dataset.editTask));
  if (remove) requestDelete(remove.dataset.deleteTask);
});
elements.taskBoard.addEventListener('change', async (event) => {
  const id = event.target.dataset.taskStatus;
  const status = event.target.value;
  if (id) try { await updateTaskStatus(id, status); } catch (error) { showToast(error.message); render(); }
});
elements.taskBoard.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-task]');
  const remove = event.target.closest('[data-delete-task]');
  const add = event.target.closest('[data-add-status]');
  if (edit) showTaskModal(state.tasks.find((task) => task.id === edit.dataset.editTask));
  if (remove) requestDelete(remove.dataset.deleteTask);
  if (add) showTaskModal(null, add.dataset.addStatus);
});
elements.taskBoard.addEventListener('dragstart', (event) => {
  const card = event.target.closest('[data-board-task]');
  if (card) event.dataTransfer.setData('text/plain', card.dataset.boardTask);
});
elements.taskBoard.addEventListener('dragover', (event) => {
  if (event.target.closest('[data-board-lane]')) event.preventDefault();
});
elements.taskBoard.addEventListener('drop', async (event) => {
  const lane = event.target.closest('[data-board-lane]');
  const id = event.dataTransfer.getData('text/plain');
  if (!lane || !id) return;
  event.preventDefault();
  try { await updateTaskStatus(id, lane.dataset.boardLane); } catch (error) { showToast(error.message); }
});
$('#confirm-delete').addEventListener('click', async () => {
  const id = state.deleteId;
  if (!id) return;
  try { await deleteTask(id); closeDeleteModal(); } catch (error) { showToast(error.message); }
});
$('#cancel-delete').addEventListener('click', closeDeleteModal);
$('#delete-modal').addEventListener('click', (event) => { if (event.target === $('#delete-modal')) closeDeleteModal(); });
$('#calendar-grid').addEventListener('click', (event) => {
  const day = event.target.closest('[data-calendar-date]');
  if (!day) return;
  state.calendarSelected = day.dataset.calendarDate;
  const selected = new Date(`${state.calendarSelected}T12:00:00`);
  state.calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  renderCalendar();
});
$('#calendar-day-tasks').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-calendar-edit]');
  const remove = event.target.closest('[data-delete-task]');
  if (edit) showTaskModal(state.tasks.find((task) => task.id === edit.dataset.calendarEdit));
  if (remove) requestDelete(remove.dataset.deleteTask);
});
$('#calendar-previous').addEventListener('click', () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
  state.calendarSelected = dateKey(state.calendarMonth);
  renderCalendar();
});
$('#calendar-next').addEventListener('click', () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
  state.calendarSelected = dateKey(state.calendarMonth);
  renderCalendar();
});
$('#calendar-add-task').addEventListener('click', () => showTaskModal());
$('#profile-form').addEventListener('submit', saveProfile);
$('#password-form').addEventListener('submit', changePassword);
document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-password-toggle]');
  if (!toggle) return;
  const input = toggle.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  toggle.textContent = show ? 'Hide' : 'Show';
  toggle.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`);
});
$$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeTaskModal));
elements.taskModal.addEventListener('click', (event) => { if (event.target === elements.taskModal) closeTaskModal(); });
$$('[data-close-auth]').forEach((button) => button.addEventListener('click', () => { elements.authModal.hidden = true; }));
elements.authModal.addEventListener('click', (event) => { if (event.target === elements.authModal) elements.authModal.hidden = true; });
$$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => { state.authMode = tab.dataset.authMode; $('#auth-error').textContent = ''; updateAuthMode(); }));
elements.authForm.addEventListener('submit', submitAuth);
$('#new-task-button').addEventListener('click', () => showTaskModal());
$('#view-all-button').addEventListener('click', () => setView('tasks'));
$('#calendar-link').addEventListener('click', () => setView('calendar'));
$('#today-button').addEventListener('click', () => setView('calendar'));
$('#account-button').addEventListener('click', () => state.isCloud ? setView('profile') : openAuth());
$('#top-avatar').addEventListener('click', () => state.isCloud ? setView('profile') : openAuth());
$('#signout-button').addEventListener('click', signOut);
$('#focus-button').addEventListener('click', startFocus);
$('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('is-open'));
$('#add-course').addEventListener('click', () => { showTaskModal(); $('#task-subject').focus(); });
$('#landing-demo').addEventListener('click', () => setScreen('workspace'));
$('#landing-footer-demo').addEventListener('click', () => setScreen('workspace'));
$('#landing-signin').addEventListener('click', () => openAuth('login'));
$('#landing-register').addEventListener('click', () => openAuth('register'));
$('#landing-create').addEventListener('click', () => openAuth('register'));
$('.app-shell .brand').addEventListener('click', (event) => { event.preventDefault(); setScreen('landing'); });
$('#theme-toggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, state.theme);
  applyTheme();
});
$$('.nav-link').forEach((link) => link.addEventListener('click', () => setView(link.dataset.view)));
$$('.filter-tab').forEach((tab) => tab.addEventListener('click', () => {
  state.filter = tab.dataset.filter;
  $$('.filter-tab').forEach((item) => item.classList.toggle('is-selected', item === tab));
  renderTasks();
}));
elements.search.addEventListener('input', () => { state.query = elements.search.value.trim().toLowerCase(); renderTasks(); });
$('#search-toggle').addEventListener('click', () => {
  const searchBox = $('#search-box');
  if (window.matchMedia('(max-width: 600px)').matches) {
    const isOpen = searchBox.classList.toggle('is-open');
    if (isOpen) elements.search.focus();
    else elements.search.blur();
    return;
  }
  elements.search.focus();
});
$('#sort-button').addEventListener('click', () => { state.sortDescending = !state.sortDescending; renderTasks(); });
$('#priority-filter').addEventListener('change', (event) => { state.priorityFilter = event.target.value; renderTasks(); });
$$('[data-task-view]').forEach((button) => button.addEventListener('click', () => {
  state.taskView = button.dataset.taskView;
  $$('[data-task-view]').forEach((view) => view.classList.toggle('is-selected', view === button));
  renderTasks();
}));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeTaskModal(); closeDeleteModal(); elements.authModal.hidden = true; }
  if (event.key === 'Escape' && $('#search-box').classList.contains('is-open')) {
    $('#search-box').classList.remove('is-open');
    elements.search.blur();
  }
  if (event.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    $('#search-box').classList.add('is-open');
    elements.search.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); showTaskModal(); }
});

render();
applyTheme();
setScreen(localStorage.getItem(WORKSPACE_KEY) === 'true' || Boolean(state.token) ? 'workspace' : 'landing', false);
syncCloud();