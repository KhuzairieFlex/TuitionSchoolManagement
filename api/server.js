"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.CORS_ORIGIN || "*").split(",").map((origin) => origin.trim()).filter(Boolean);
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
}) : null;

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("This origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "1mb" }));

const classFields = ["class_code", "class_name", "subjects", "schedule_days", "schedule_time", "room", "teacher_id", "status"];
const teacherFields = ["teacher_code", "full_name", "email", "phone", "subject_specialty", "join_date", "status"];
const studentFields = ["student_code", "full_name", "gender", "age", "class_id", "guardian_name", "guardian_phone", "guardian_email", "enrolment_date", "status"];
const statusSets = {
  classes: new Set(["Active", "Inactive"]),
  teachers: new Set(["Active", "On Leave", "Inactive"]),
  students: new Set(["Active", "Withdrawn"])
};

function apiError(status, message) 
{
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireDatabase(req, res, next) 
{
  if (!pool) return next(apiError(503, "Database is not configured. Set DATABASE_URL in the service environment."));
  return next();
}

function text(value) 
{
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function emailIsValid(value) 
{
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function dateIsValid(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return false;
  const [year, month, day] = text(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validate(payload, entity, fields) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw apiError(400, "Send a JSON object with the record fields.");
  const result = {};
  for (const field of fields) result[field] = payload[field] === undefined ? null : payload[field];
  const required = {
    classes: ["class_code", "class_name", "subjects", "status"],
    teachers: ["teacher_code", "full_name", "email", "subject_specialty", "status"],
    students: ["full_name", "gender", "age", "class_id", "guardian_name", "guardian_phone", "enrolment_date", "status"]
  }[entity];
  for (const field of required) {
    result[field] = text(result[field]);
    if (!result[field]) throw apiError(400, `${field.replaceAll("_", " ")} is required.`);
  }
  for (const field of fields) {
    if (result[field] !== null && typeof result[field] === "string") result[field] = result[field].trim();
  }
  if (!statusSets[entity].has(result.status)) {
    const label = { classes: "class", teachers: "teacher", students: "student" }[entity];
    throw apiError(400, `Invalid ${label} status.`);
  }
  if (entity === "teachers" && !emailIsValid(result.email)) throw apiError(400, "Enter a valid teacher email address.");
  if (entity === "students") {
    const age = Number(result.age);
    if (!Number.isInteger(age) || age < 3 || age > 20) throw apiError(400, "Age must be a whole number between 3 and 20.");
    result.age = age;
    if (result.gender && !["M", "F", "Other"].includes(result.gender)) throw apiError(400, "Gender must be M, F, or Other.");
    if (result.guardian_email && !emailIsValid(result.guardian_email)) throw apiError(400, "Enter a valid guardian email address.");
    if (!dateIsValid(result.enrolment_date)) throw apiError(400, "Enrolment date must be a valid date.");
    result.enrolment_date = text(result.enrolment_date);
    if (result.student_code && !/^[a-z0-9]+-student\d{2,}$/i.test(result.student_code)) {
      throw apiError(400, "Student code must follow <class_code>-studentNN.");
    }
  }
  if (entity === "teachers" && result.join_date && !dateIsValid(result.join_date)) throw apiError(400, "Join date must be a valid date.");
  if (entity === "students" && !result.class_id) throw apiError(400, "A student must be assigned to a class.");
  return result;
}

function handleDatabaseError(error, entityLabel) {
  if (error.code === "23505") return apiError(409, `${entityLabel} code is already in use.`);
  if (error.code === "23503" && entityLabel === "Class") return apiError(409, "This class still has students. Reassign or remove them before deleting the class.");
  if (error.code === "23503") return apiError(409, "The selected related record does not exist or is still in use.");
  if (error.code === "23514") return apiError(400, "One or more fields contain an unsupported value.");
  return error;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function listRouter({ path, table, idColumn, fields, entity, label, selectSql }) {
  app.get(path, requireDatabase, asyncRoute(async (req, res) => {
    const query = entity === "students" && req.query.class_id
      ? await pool.query(`${selectSql} WHERE item.class_id = $1`, [req.query.class_id])
      : await pool.query(selectSql);
    const { rows } = query;
    return res.json(rows);
  }));
  app.get(`${path}/:id`, requireDatabase, asyncRoute(async (req, res) => {
    const { rows } = await pool.query(`${selectSql} WHERE item.${idColumn} = $1`, [req.params.id]);
    if (!rows[0]) throw apiError(404, `${label} not found.`);
    return res.json(rows[0]);
  }));
  app.post(path, requireDatabase, asyncRoute(async (req, res) => {
    const data = validate(req.body, entity, fields);
    if (entity === "students" && !data.student_code) data.student_code = await generateStudentCode(data.class_id);
    if (entity === "students") await validateStudentCode(data.class_id, data.student_code);
    if (entity === "teachers") {
      const classId = text(req.body.class_id) || null;
      const client = await pool.connect();
      let teacherId;
      try {
        await client.query("BEGIN");
        if (classId) {
          const target = await client.query("SELECT teacher_id FROM classes WHERE class_id = $1 FOR UPDATE", [classId]);
          if (!target.rowCount) throw apiError(400, "The selected class does not exist.");
          if (target.rows[0].teacher_id) throw apiError(409, "This class already has an assigned teacher.");
        }
        const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");
        const values = fields.map((field) => data[field] === "" ? null : data[field]);
        const result = await client.query(
          `INSERT INTO ${table} (${fields.join(", ")}) VALUES (${placeholders}) RETURNING ${idColumn}`,
          values
        );
        teacherId = result.rows[0][idColumn];
        if (classId) await client.query("UPDATE classes SET teacher_id = $1 WHERE class_id = $2", [teacherId, classId]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw handleDatabaseError(error, label);
      } finally {
        client.release();
      }
      return res.status(201).json(await selectOne(entity, idColumn, teacherId));
    }
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");
    const values = fields.map((field) => data[field] === "" ? null : data[field]);
    try {
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      const row = await selectOne(entity, idColumn, rows[0][idColumn]);
      return res.status(201).json(row);
    } catch (error) {
      throw handleDatabaseError(error, label);
    }
  }));
  app.put(`${path}/:id`, requireDatabase, asyncRoute(async (req, res) => {
    const data = validate(req.body, entity, fields);
    if (entity === "students") await validateStudentCode(data.class_id, data.student_code);
    if (entity === "teachers") {
      const classId = Object.prototype.hasOwnProperty.call(req.body, "class_id") ? text(req.body.class_id) || null : undefined;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query("SELECT class_id FROM classes WHERE teacher_id = $1 ORDER BY class_id FOR UPDATE", [req.params.id]);
        const currentClassId = current.rows[0]?.class_id || null;
        if (!current.rowCount) {
          const exists = await client.query("SELECT 1 FROM teachers WHERE teacher_id = $1", [req.params.id]);
          if (!exists.rowCount) throw apiError(404, `${label} not found.`);
        }
        if (classId !== undefined && classId !== currentClassId && classId) {
          const target = await client.query("SELECT teacher_id FROM classes WHERE class_id = $1 FOR UPDATE", [classId]);
          if (!target.rowCount) throw apiError(400, "The selected class does not exist.");
          if (target.rows[0].teacher_id && target.rows[0].teacher_id !== req.params.id) {
            throw apiError(409, "This class already has an assigned teacher.");
          }
        }
        const values = fields.map((field) => data[field] === "" ? null : data[field]);
        values.push(req.params.id);
        const result = await client.query(
          `UPDATE ${table} SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(", ")} WHERE ${idColumn} = $${fields.length + 1} RETURNING ${idColumn}`,
          values
        );
        if (!result.rowCount) throw apiError(404, `${label} not found.`);
        if (classId !== undefined && classId !== currentClassId) {
          await client.query("UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1", [req.params.id]);
          if (classId) await client.query("UPDATE classes SET teacher_id = $1 WHERE class_id = $2", [req.params.id, classId]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw handleDatabaseError(error, label);
      } finally {
        client.release();
      }
      return res.json(await selectOne(entity, idColumn, req.params.id));
    }
    const values = fields.map((field) => data[field] === "" ? null : data[field]);
    values.push(req.params.id);
    try {
      const result = await pool.query(
        `UPDATE ${table} SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(", ")} WHERE ${idColumn} = $${fields.length + 1} RETURNING ${idColumn}`,
        values
      );
      if (!result.rowCount) throw apiError(404, `${label} not found.`);
      return res.json(await selectOne(entity, idColumn, req.params.id));
    } catch (error) {
      throw handleDatabaseError(error, label);
    }
  }));
  app.delete(`${path}/:id`, requireDatabase, asyncRoute(async (req, res) => {
    if (entity === "classes") {
      const count = await pool.query("SELECT COUNT(*)::int AS count FROM students WHERE class_id = $1", [req.params.id]);
      if (count.rows[0].count > 0) throw apiError(409, "This class still has students. Reassign or remove them before deleting the class.");
    }
    try {
      const result = await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = $1 RETURNING ${idColumn}`, [req.params.id]);
      if (!result.rowCount) throw apiError(404, `${label} not found.`);
      return res.status(204).end();
    } catch (error) {
      throw handleDatabaseError(error, label);
    }
  }));
}

async function selectOne(entity, idColumn, id) {
  const select = {
    classes: "SELECT item.* FROM classes item",
    teachers: "SELECT item.*, assigned.class_id FROM teachers item LEFT JOIN LATERAL (SELECT class_id FROM classes WHERE teacher_id = item.teacher_id ORDER BY class_id LIMIT 1) assigned ON TRUE",
    students: "SELECT item.* FROM students item"
  }[entity];
  const { rows } = await pool.query(`${select} WHERE item.${idColumn} = $1`, [id]);
  return rows[0];
}

async function generateStudentCode(classId) {
  if (!classId) throw apiError(400, "Select a class before generating a student code.");
  const { rows } = await pool.query("SELECT class_code FROM classes WHERE class_id = $1", [classId]);
  if (!rows[0]) throw apiError(400, "The selected class does not exist.");
  const prefix = `${rows[0].class_code}-student`;
  const codes = await pool.query("SELECT student_code FROM students WHERE student_code LIKE $1", [`${prefix}%`]);
  let max = 0;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const row of codes.rows) {
    const match = new RegExp(`^${escapedPrefix}(\\d+)$`).exec(row.student_code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

async function validateStudentCode(classId, studentCode) {
  const { rows } = await pool.query("SELECT class_code FROM classes WHERE class_id = $1", [classId]);
  if (!rows[0]) throw apiError(400, "The selected class does not exist.");
  const escapedClassCode = rows[0].class_code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^${escapedClassCode}-student\\d{2,}$`, "i").test(text(studentCode))) {
    throw apiError(400, `Student code must start with ${rows[0].class_code}-student and end in a number.`);
  }
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/db-check", requireDatabase, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query("SELECT NOW() AS database_time");
  return res.json({ status: "ok", database_time: rows[0].database_time });
}));

app.get("/api/students/next-code", requireDatabase, asyncRoute(async (req, res) => {
  return res.json({ student_code: await generateStudentCode(text(req.query.class_id)) });
}));

listRouter({
  path: "/api/classes", table: "classes", idColumn: "class_id", fields: classFields, entity: "classes", label: "Class",
  selectSql: "SELECT item.* FROM classes item"
});
listRouter({
  path: "/api/teachers", table: "teachers", idColumn: "teacher_id", fields: teacherFields, entity: "teachers", label: "Teacher",
  selectSql: "SELECT item.*, assigned.class_id FROM teachers item LEFT JOIN LATERAL (SELECT class_id FROM classes WHERE teacher_id = item.teacher_id ORDER BY class_id LIMIT 1) assigned ON TRUE"
});
listRouter({
  path: "/api/students", table: "students", idColumn: "student_id", fields: studentFields, entity: "students", label: "Student",
  selectSql: "SELECT item.* FROM students item"
});

app.use((error, _req, res, _next) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must contain valid JSON." });
  if (error.message === "This origin is not allowed by CORS.") return res.status(403).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

if (require.main === module) {
  app.listen(port, () => console.log(`Tuition school API listening on port ${port}`));
}

module.exports = { app, validate, generateStudentCode };
