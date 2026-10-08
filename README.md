# Sunrise Tuition Centre — School Manager

A mobile-ready school management app for maintaining classes, teachers, and students. The repository contains a static frontend, a REST API, PostgreSQL schema and seed data, and deployment-readiness checks.

> The Render API and GitHub Pages frontend are deployed. Health, database connectivity, and API CORS have been verified; full live CRUD and mobile validation remain.

## 1. Team

| Name | Role | GitHub |
|---|---|---|
| TODO | Frontend / API / DB | TODO |

## 2. Live links

| Component | Platform | URL | Status |
|---|---|---|---|
| Frontend | GitHub Pages | https://khuzairieflex.github.io/TuitionSchoolManagement/ | Live; final UI checks pending |
| API | Render | https://sunrise-tuition-api-4h8c.onrender.com/api/health | Live; health returns `{"status":"ok"}` |
| Database | Neon PostgreSQL | Tuition School Management (`production`) | Schema + seed loaded; Render DB check verified |

## 3. What this app does

- Manage classes, teachers, and students with create, view, update, and delete flows.
- Search records; filter students by class.
- View class details, assigned teacher, schedule, and enrolled students.
- Suggest sequential student codes based on their selected class.
- Block deletion of classes that still have students, and unassign teachers when deleted.
- Show dashboard totals, mobile layouts, API loading state, and connection/error feedback.

## 4. Architecture

```text
[Browser / Mobile] ──HTTPS──> [GitHub Pages: static HTML/CSS/JS]
                                     │ JSON requests
                                     ▼
                              [Render: Node.js + Express API]
                                     │ pg / TLS
                                     ▼
                              [Neon: PostgreSQL]
```

| Layer | Choice |
|---|---|
| Frontend | Plain HTML, CSS, and JavaScript |
| API | Node.js 20+, Express, CORS middleware |
| Database | Neon PostgreSQL, `pg` |
| Deployment | GitHub Actions to GitHub Pages; Render blueprint in `render.yaml` |

```text
frontend/       Static website
api/            REST API
db/             PostgreSQL schema and seed data
prep/           Environment readiness check scripts
```

## 5. Features achieved

Implemented in source. Cloud deployments are live; run the remaining end-to-end acceptance checks before marking all requirements complete.

- [x] Classes, teachers, and students CRUD flows
- [x] Student code suggestion using class code and next available sequence
- [x] Class deletion blocked while students remain enrolled
- [x] Teacher deletion unassigns classes
- [x] Class details with teacher and students
- [x] Search and student class filtering
- [x] Dashboard counts
- [x] Responsive mobile cards and desktop tables
- [x] Loading, connection, and error states
- [x] Workbook seed records represented in `db/seed.sql`
- [x] Seed data loaded into Neon (6 classes, 6 teachers, 25 students, 10 schedules)

## 6. API reference

Base URL: `https://sunrise-tuition-api-4h8c.onrender.com`. For local development only, use `http://localhost:3000`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/db-check` | Database connection check |
| GET / POST | `/api/classes` | List / create |
| GET / PUT / DELETE | `/api/classes/:id` | Read / update / delete |
| GET / POST | `/api/teachers` | List / create |
| GET / PUT / DELETE | `/api/teachers/:id` | Read / update / delete |
| GET | `/api/students/next-code?class_id=` | Suggest a student code |
| GET / POST | `/api/students?class_id=` | List (optionally filtered) / create |
| GET / PUT / DELETE | `/api/students/:id` | Read / update / delete |

Errors use JSON such as `{ "error": "message" }`. Duplicate codes return `409`; invalid input returns `400`; missing records return `404`.

## 7. Database schema

See [`db/schema.sql`](db/schema.sql) and [`db/seed.sql`](db/seed.sql). Teacher-to-class assignment is stored on `classes.teacher_id`; the API derives a teacher's `class_id` from its class assignment.

The workbook assigns teacher T001 to both Primary 1 and Primary 6, despite describing a one-class-per-teacher relationship. The seed preserves the workbook as provided; app operations support displaying that initial data.

The Neon `production` branch now has the schema and workbook seed applied. Verified row counts are 6 classes, 6 teachers, 25 students, and 10 schedules. `neon deploy` applies the `neon.ts` resource policy; it does not execute these SQL files.

## 8. Screenshots

Not captured yet. Add mobile (375px) and desktop screenshots after running and deploying the app.

## 9. Demo

Not recorded yet. Record a 3–5 minute mobile demo after cloud setup and live validation.

## 10. Setup & deployment notes

### Environment variables (Render)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection URL; configure only in Render environment settings |
| `CORS_ORIGIN` | Comma-separated GitHub Pages origins |
| `PORT` | Optional; supplied by Render |

### Local development

1. Create a Neon project and run `db/schema.sql`, then `db/seed.sql`, in its SQL Editor. These were applied to the current `production` branch.
2. In `api`, copy `.env.example` to `.env`, set `DATABASE_URL`, and run `npm install` then `npm start`.
3. Set `window.TUITION_API_URL` in `frontend/config.js` to the API URL and serve the `frontend` directory with any static file server.
4. In Render, create a Blueprint from `render.yaml`; set `DATABASE_URL` and `CORS_ORIGIN` in the service environment. The production CORS origin is `https://khuzairieflex.github.io`.
5. In the GitHub repository, add the Actions variable `TUITION_API_URL` with the HTTPS Render API base URL (`https://sunrise-tuition-api-4h8c.onrender.com`). Enable GitHub Pages with GitHub Actions, then push to `main` to publish `frontend/`. The workflow substitutes this URL for the local development URL and cache-busts the config script on each deployment.

Local services are for development only. The final demo must use the deployed HTTPS URLs.

## 11. Preparation & collaboration

**Who helped / topics discussed:** TODO

**Offline HTML draft:** `frontend/`

**Environment readiness checks:** See [`prep/README.md`](prep/README.md). Neon SQL, Render health + DB checks, and Pages-to-API CORS are verified. Final data-operation and device checks remain.

## 12. Vibe-coding log

- Reviewed the assignment and workbook before implementing the app.
- Chose a static frontend to keep GitHub Pages deployment straightforward.
- Added API, schema, seed data, and readiness scripts as separate layers.
- Linked Neon CLI to the `production` branch, initialized an empty `neon.ts` policy, and confirmed `neon deploy` had no policy changes to apply.
- Applied the schema and seed SQL in Neon SQL Editor and verified the expected table counts.
- Deployed the API to Render and verified `/api/health`, `/api/db-check`, and the GitHub Pages CORS preflight.
- Published the frontend to GitHub Pages using the workflow API URL variable.
- Full live CRUD/mobile checks and screenshots/demo recording remain.

## 13. Self-assessment

| Criterion | Status |
|---|---|
| GitHub Pages frontend live | Done; final browser/API verification pending |
| Render API live with CORS | Done; health and preflight verified |
| Neon schema and seed data loaded | Done; table counts verified |
| API persists data through Neon | DB connection endpoint verified; CRUD persistence test pending |
| CRUD implemented for all entities | Implemented; needs live test |
| Class deletion protection | Implemented; needs live test |
| Student code suggestion | Implemented; needs live test |
| 375px layout | Responsive styles implemented; needs device/browser verification |
| No committed secrets | `.env` files ignored; verify before publishing |
| README and setup notes | Live URLs and deployment notes updated; final evidence pending |
| Preparation spikes | Added; Neon, Render health/DB, and CORS checks verified |
| Submitted by assignment deadline | The deadline in the supplied brief has passed |

## 14. Known issues / next steps

- Rotate the Neon database password because the connection string was shared in chat, then update Render's `DATABASE_URL`.
- Confirm the deployed Pages build has loaded the current Render API URL; complete live CRUD, 375px, and accessibility checks.
- Capture screenshots and record the 3–5 minute mobile demo; fill in the team and collaboration fields.
