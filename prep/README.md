# Readiness checks

These files are small deployment checks to run before applying the full application schema.
Do not commit a real database URL or service secret.

| Check | Evidence | State |
|---|---|---|
| Neon schema and seed | Applied `db/schema.sql` and `db/seed.sql` in the Neon SQL Editor; verified row counts | Done (6 classes, 6 teachers, 25 students, 10 schedules) |
| Database connection | `node prep/db-test.js` after setting `DATABASE_URL` | Script ready; not run |
| Render API | `https://sunrise-tuition-api-4h8c.onrender.com/api/health` | Done (`{"status":"ok"}`) |
| API-to-database | `https://sunrise-tuition-api-4h8c.onrender.com/api/db-check` | Done (database time returned) |
| Pages-to-API / CORS | `https://khuzairieflex.github.io/TuitionSchoolManagement/` to Render API | CORS preflight verified; current frontend config cache refresh pending |
| Secrets | Keep `DATABASE_URL` in the hosting environment; `.env` files are ignored | Repository ready |

The production Neon connection string must remain only in Render environment settings. Rotate its password if it has been shared outside Render.
