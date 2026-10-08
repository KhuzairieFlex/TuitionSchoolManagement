BEGIN;

CREATE TABLE IF NOT EXISTS teachers (
  teacher_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  teacher_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject_specialty TEXT NOT NULL,
  join_date DATE,
  status TEXT NOT NULL CHECK (status IN ('Active', 'On Leave', 'Inactive'))
);

CREATE TABLE IF NOT EXISTS classes (
  class_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_code TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  subjects TEXT NOT NULL,
  schedule_days TEXT,
  schedule_time TEXT,
  room TEXT,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('M', 'F', 'Other')),
  age INTEGER NOT NULL CHECK (age BETWEEN 3 AND 20),
  class_id TEXT NOT NULL REFERENCES classes(class_id) ON DELETE RESTRICT,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  guardian_email TEXT,
  enrolment_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Withdrawn'))
);

CREATE TABLE IF NOT EXISTS schedules (
  schedule_id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT NOT NULL,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS students_class_id_idx ON students(class_id);
CREATE INDEX IF NOT EXISTS classes_teacher_id_idx ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS schedules_class_id_idx ON schedules(class_id);

COMMIT;
