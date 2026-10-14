-- =====================================================================
-- Online Quiz System - database schema
-- =====================================================================
-- Creates the five tables used by server.js:
--   users, quizzes, questions, quiz_results, quiz_attempt_answers
--
-- Safe to run more than once: every table uses CREATE TABLE IF NOT EXISTS.
-- Nothing is dropped, truncated or overwritten.
--
-- Compatible with MySQL 8 (Aiven for MySQL). Aiven requires every table
-- to have a primary key, which all tables below do.
--
-- Run it against the database named in DB_NAME (on Aiven: defaultdb).
-- No starter account is created here. Create the first teacher with:
--   node scripts/create-teacher.js
-- which hashes the password the same way the login code does.
-- =====================================================================


-- ---------------------------------------------------------------------
-- users
-- Teachers and students. Login looks up (email, role) and checks the
-- password hash. Passwords are stored as "scrypt$<salt>$<hash>"
-- (about 170 characters), never as plain text.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('teacher', 'student') NOT NULL DEFAULT 'student',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_email_role (email, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- quizzes
-- duration is in SECONDS (the teacher form asks for seconds; the quiz
-- timer counts down from it).
-- start_time / end_time are stored in UTC and are optional; the server
-- compares them with UTC_TIMESTAMP() to mark a quiz open/upcoming/closed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
    id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title              VARCHAR(200) NOT NULL,
    description        TEXT NULL,
    duration           INT UNSIGNED NOT NULL,
    is_active          TINYINT(1) NOT NULL DEFAULT 1,
    created_by         INT UNSIGNED NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shuffle_questions  TINYINT(1) NOT NULL DEFAULT 0,
    shuffle_options    TINYINT(1) NOT NULL DEFAULT 0,
    show_answers       TINYINT(1) NOT NULL DEFAULT 1,
    pass_percentage    INT NOT NULL DEFAULT 40,
    start_time         DATETIME NULL,
    end_time           DATETIME NULL,

    PRIMARY KEY (id),
    KEY idx_quizzes_created_by (created_by),

    CONSTRAINT fk_quizzes_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON DELETE SET NULL,

    CONSTRAINT chk_quizzes_duration
        CHECK (duration > 0),
    CONSTRAINT chk_quizzes_pass_percentage
        CHECK (pass_percentage BETWEEN 0 AND 100),
    CONSTRAINT chk_quizzes_schedule
        CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- questions
-- Four options per question. correct_answer may be the option text,
-- an option number (1-4) or a letter (A-D); the app accepts all three.
-- Deleting a quiz deletes its questions.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    quiz_id         INT UNSIGNED NOT NULL,
    question        TEXT NOT NULL,
    option1         VARCHAR(500) NOT NULL,
    option2         VARCHAR(500) NOT NULL,
    option3         VARCHAR(500) NOT NULL,
    option4         VARCHAR(500) NOT NULL,
    correct_answer  VARCHAR(500) NOT NULL,

    PRIMARY KEY (id),
    KEY idx_questions_quiz (quiz_id, id),

    CONSTRAINT fk_questions_quiz
        FOREIGN KEY (quiz_id) REFERENCES quizzes (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- quiz_results
-- One row per submitted attempt. Used by history, analytics,
-- leaderboard, class results and export.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_results (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_id        INT UNSIGNED NOT NULL,
    quiz_id           INT UNSIGNED NOT NULL,
    score             INT UNSIGNED NOT NULL DEFAULT 0,
    total_questions   INT UNSIGNED NOT NULL,
    duration_seconds  INT UNSIGNED NOT NULL DEFAULT 0,
    submitted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_results_student (student_id, submitted_at),
    KEY idx_results_quiz (quiz_id, submitted_at),

    CONSTRAINT fk_results_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_results_quiz
        FOREIGN KEY (quiz_id) REFERENCES quizzes (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_results_total
        CHECK (total_questions > 0),
    CONSTRAINT chk_results_score
        CHECK (score <= total_questions)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- quiz_attempt_answers
-- The answer chosen for each question in an attempt. Powers the
-- review page and the per-question difficulty stats.
-- selected_answer is NULL when a question was skipped.
-- If a teacher deletes a question, its saved answers are removed too
-- (the attempt's overall score in quiz_results is kept).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    result_id        INT UNSIGNED NOT NULL,
    question_id      INT UNSIGNED NOT NULL,
    selected_answer  VARCHAR(500) NULL,
    is_correct       TINYINT(1) NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_attempt_question (result_id, question_id),
    KEY idx_answers_question (question_id),

    CONSTRAINT fk_answers_result
        FOREIGN KEY (result_id) REFERENCES quiz_results (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_answers_question
        FOREIGN KEY (question_id) REFERENCES questions (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
