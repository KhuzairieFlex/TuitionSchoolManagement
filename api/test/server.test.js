"use strict";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { app, validate } = require("../server");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health endpoint does not require the database", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("database endpoints report missing configuration explicitly", async () => {
  const response = await fetch(`${baseUrl}/api/classes`);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /DATABASE_URL/);
});

test("record validation rejects invalid teacher emails", () => {
  assert.throws(() => validate({
    teacher_code: "teacher07", full_name: "Test Teacher", email: "not-an-email",
    subject_specialty: "English", status: "Active"
  }, "teachers", ["teacher_code", "full_name", "email", "subject_specialty", "join_date", "status"]), {
    status: 400,
    message: "Enter a valid teacher email address."
  });
});

test("student code may be generated after other required fields validate", () => {
  const student = validate({
    full_name: "Test Student", gender: "F", age: "8", class_id: "C001",
    guardian_name: "Guardian", guardian_phone: "123", enrolment_date: "2025-01-01", status: "Active"
  }, "students", ["student_code", "full_name", "gender", "age", "class_id", "guardian_name", "guardian_phone", "guardian_email", "enrolment_date", "status"]);
  assert.equal(student.student_code, null);
  assert.equal(student.age, 8);
});

test("student dates are calendar-valid, not only correctly formatted", () => {
  assert.throws(() => validate({
    full_name: "Test Student", gender: "M", age: 9, class_id: "C001",
    guardian_name: "Guardian", guardian_phone: "123", enrolment_date: "2025-02-30", status: "Active"
  }, "students", ["student_code", "full_name", "gender", "age", "class_id", "guardian_name", "guardian_phone", "guardian_email", "enrolment_date", "status"]), {
    status: 400,
    message: "Enrolment date must be a valid date."
  });
});
