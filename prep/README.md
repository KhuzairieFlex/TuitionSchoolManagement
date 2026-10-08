# Readiness checks

These files are small deployment checks to run before applying the full application schema.
Do not commit a real database URL or service secret.

| Check | Evidence | State |
|---|---|---|
| Neon schema and seed | Applied `db/schema.sql` and `db/seed.sql` in the Neon SQL Editor; verified row counts | Done (6 classes, 6 teachers, 25 students, 10 schedules) |
| Database connection | `node prep/db-test.js` after setting `DATABASE_URL` | Script ready; not run |
| Render API | Deploy `/api/health` from the `api` directory | Not deployed |
| API-to-database | Deploy `/api/db-check` with the Render environment variable | Not deployed |
| Pages-to-API / CORS | Set the deployed API URL in `frontend/config.js` and publish the frontend | Not deployed |
| Secrets | Keep `DATABASE_URL` in the hosting environment; `.env` files are ignored | Repository ready |

The live-cloud steps require project accounts and credentials; no cloud deployment is represented as complete.
