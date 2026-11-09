# Tandem

A responsive student task planner built with plain HTML, CSS, and JavaScript, backed by Express, MongoDB Atlas, JWT, and bcrypt.

## Run locally

Requires Node.js 20 or later.

```powershell
npm install
npm run dev
```

Open http://localhost:3000. The dashboard starts in demo mode and saves tasks in this browser, so it works without cloud credentials.

## Enable accounts and cloud storage

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to your MongoDB Atlas connection string and `JWT_SECRET` to a long, random value.
3. Run `npm start`; registration and login are available from the account button.

The API includes `POST /api/auth/register`, `POST /api/auth/login`, `GET` and `PATCH /api/auth/me`, and `PATCH /api/auth/me/password`. Tasks support `GET`, `POST`, `PATCH /:id`, `PATCH /:id/status`, and `DELETE /:id` under `/api/tasks`. The task list accepts `status`, `priority`, `subject`, `q`, and `sort` query parameters. `GET /api/health` reports whether MongoDB is connected. Passwords are hashed with bcrypt, every task query is scoped by `userId`, and status changes maintain `completedAt` for productivity reporting.

The app includes a month calendar, selected-day deadlines, editable profile details, password-change form, priority filtering, and a confirmation step before task deletion. Run `npm test` for backend input-validation tests. Registration, profile updates, and task CRUD require a working MongoDB connection; cloud endpoints return HTTP 503 while the database is offline.

## Project structure

```text
backend/
	app.js
	server.js
	config/database.js
	middleware/auth.js
	middleware/errorHandler.js
	models/User.js
	models/Task.js
	routes/authRoutes.js
	routes/taskRoutes.js
	utils/validation.js
	tests/validation.test.js
frontend/
	public/
		assets/
		index.html
		styles.css
		app.js
.env.example
package.json
render.yaml
server.js
```

The root `server.js` remains as a compatibility entry point; npm and Render start `backend/server.js` directly. Mongoose uses the `StudentTaskDB` database by default; set `MONGODB_DB` only when overriding that name.

## Deploy to Render

Push the project to GitHub and create a Render Web Service from the repository. The included `render.yaml` configures the Node service. Add `MONGODB_URI` in Render's environment settings; Render generates `JWT_SECRET` from the blueprint. Add the Render deployment's origin to MongoDB Atlas Network Access. Keep `.env` out of source control.