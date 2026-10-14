
const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const XLSX = require("xlsx");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// Middleware
// =====================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// Database configuration — old online_quiz database
// =====================================================

console.log("=================================");
console.log("DATABASE CONFIGURATION");
console.log("=================================");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_PASSWORD: [HIDDEN]");
console.log("=================================");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "online_quiz",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000
});

// Check database and tables at startup.
db.getConnection((err, connection) => {
    if (err) {
        console.error("MYSQL CONNECTION ERROR:", err.message);
        return;
    }

    console.log("MySQL connection established successfully.");

    connection.query(
        "SELECT DATABASE() AS current_database",
        (dbErr, results) => {
            if (dbErr) {
                console.error("DATABASE CHECK ERROR:", dbErr.message);
            } else {
                console.log("CURRENT DATABASE:", results[0].current_database);
            }

            connection.query("SHOW TABLES", (tablesErr, tables) => {
                if (tablesErr) {
                    console.error("SHOW TABLES ERROR:", tablesErr.message);
                } else {
                    console.log("TABLES AVAILABLE IN DATABASE:", tables);
                }

                connection.release();
            });
        }
    );
});

// =====================================================
// Helpers
// =====================================================

function sendDbError(res, label, err, message = "Database operation failed.") {
    console.error(`${label}:`, err.message);
    return res.status(500).json({ message });
}

function parsePositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

// =====================================================
// Home page
// =====================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================================================
// Teacher login — compatible with old plain-text passwords
// =====================================================

app.post("/api/teacher/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    const sql = `
        SELECT id, name, email, role
        FROM users
        WHERE email = ?
          AND password = ?
          AND role = 'teacher'
    `;

    db.query(sql, [email, password], (err, results) => {
        if (err) return sendDbError(res, "Teacher login error", err, "Server error.");

        if (results.length === 0) {
            return res.status(401).json({
                message: "Invalid teacher email or password."
            });
        }

        return res.json({ success: true, teacher: results[0] });
    });
});

// =====================================================
// Student login — compatible with old plain-text passwords
// =====================================================

app.post("/api/student/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    const sql = `
        SELECT id, name, email, role
        FROM users
        WHERE email = ?
          AND password = ?
          AND role = 'student'
    `;

    db.query(sql, [email, password], (err, results) => {
        if (err) return sendDbError(res, "Student login error", err, "Server error.");

        if (results.length === 0) {
            return res.status(401).json({
                message: "Invalid student email or password."
            });
        }

        return res.json({ success: true, student: results[0] });
    });
});

// =====================================================
// Get questions
// =====================================================

app.get("/api/questions", (req, res) => {
    const quizId = req.query.quiz_id;

    let sql = `
        SELECT id, question, option1, option2, option3, option4,
               correct_answer, quiz_id
        FROM questions
    `;
    const values = [];

    if (quizId) {
        sql += " WHERE quiz_id = ?";
        values.push(quizId);
    }

    sql += " ORDER BY id ASC";

    db.query(sql, values, (err, results) => {
        if (err) return sendDbError(res, "Get questions error", err, "Failed to fetch questions.");

        const formatted = results.map(item => ({
            id: item.id,
            question: item.question,
            options: [item.option1, item.option2, item.option3, item.option4],
            answer: item.correct_answer,
            quiz_id: item.quiz_id
        }));

        return res.json(formatted);
    });
});

// =====================================================
// Get all quizzes
// =====================================================

app.get("/api/quizzes", (req, res) => {
    const sql = `
        SELECT id, title, description, duration, is_active, created_by,
               created_at, exam_mode, pass_percentage, shuffle_questions
        FROM quizzes
        ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) return sendDbError(res, "Get quizzes error", err, "Failed to fetch quizzes.");
        return res.json(results);
    });
});

// =====================================================
// Create quiz
// =====================================================

app.post("/api/quizzes", (req, res) => {
    const {
        title,
        description,
        duration,
        created_by,
        exam_mode = false,
        pass_percentage = 40,
        shuffle_questions = false
    } = req.body;

    if (!title || !Number.isFinite(Number(duration)) || Number(duration) <= 0) {
        return res.status(400).json({
            message: "Quiz title and a valid duration are required."
        });
    }

    const pass = Number(pass_percentage);
    if (!Number.isInteger(pass) || pass < 0 || pass > 100) {
        return res.status(400).json({
            message: "Pass percentage must be between 0 and 100."
        });
    }

    const sql = `
        INSERT INTO quizzes
            (title, description, duration, created_by,
             exam_mode, pass_percentage, shuffle_questions)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title,
            description || "",
            Number(duration),
            created_by || null,
            Boolean(exam_mode),
            pass,
            Boolean(shuffle_questions)
        ],
        (err, result) => {
            if (err) return sendDbError(res, "Create quiz error", err, "Failed to create quiz.");

            return res.json({
                success: true,
                message: "Quiz created successfully.",
                quizId: result.insertId
            });
        }
    );
});

// =====================================================
// Update quiz settings
// =====================================================

app.put("/api/quizzes/:id", (req, res) => {
    const quizId = parsePositiveInteger(req.params.id);
    if (!quizId) {
        return res.status(400).json({ message: "Invalid quiz ID." });
    }

    const {
        title,
        description,
        duration,
        is_active,
        exam_mode,
        pass_percentage,
        shuffle_questions
    } = req.body;

    const fields = [];
    const values = [];

    if (title !== undefined) {
        fields.push("title = ?");
        values.push(title);
    }
    if (description !== undefined) {
        fields.push("description = ?");
        values.push(description);
    }
    if (duration !== undefined) {
        if (!Number.isFinite(Number(duration)) || Number(duration) <= 0) {
            return res.status(400).json({ message: "Duration must be positive." });
        }
        fields.push("duration = ?");
        values.push(Number(duration));
    }
    if (is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(Boolean(is_active));
    }
    if (exam_mode !== undefined) {
        fields.push("exam_mode = ?");
        values.push(Boolean(exam_mode));
    }
    if (pass_percentage !== undefined) {
        const pass = Number(pass_percentage);
        if (!Number.isInteger(pass) || pass < 0 || pass > 100) {
            return res.status(400).json({ message: "Pass percentage must be between 0 and 100." });
        }
        fields.push("pass_percentage = ?");
        values.push(pass);
    }
    if (shuffle_questions !== undefined) {
        fields.push("shuffle_questions = ?");
        values.push(Boolean(shuffle_questions));
    }

    if (fields.length === 0) {
        return res.status(400).json({ message: "No quiz fields provided." });
    }

    values.push(quizId);

    db.query(
        `UPDATE quizzes SET ${fields.join(", ")} WHERE id = ?`,
        values,
        (err, result) => {
            if (err) return sendDbError(res, "Update quiz error", err, "Failed to update quiz.");
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Quiz not found." });
            }
            return res.json({ success: true, message: "Quiz updated successfully." });
        }
    );
});

// =====================================================
// Delete quiz
// =====================================================

app.delete("/api/quizzes/:id", (req, res) => {
    const quizId = parsePositiveInteger(req.params.id);
    if (!quizId) {
        return res.status(400).json({ message: "Invalid quiz ID." });
    }

    db.query("DELETE FROM quizzes WHERE id = ?", [quizId], (err, result) => {
        if (err) return sendDbError(res, "Delete quiz error", err, "Failed to delete quiz.");
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Quiz not found." });
        }
        return res.json({ success: true, message: "Quiz deleted successfully." });
    });
});

// =====================================================
// Multer / Excel question upload
// =====================================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.post("/api/questions/upload-test", (req, res) => {
    return res.json({
        success: true,
        message: "Upload route is working"
    });
});

app.post("/api/questions/upload", upload.single("excel"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "Please upload an Excel file." });
    }

    const quizId = parsePositiveInteger(req.body.quiz_id);
    if (!quizId) {
        return res.status(400).json({ message: "A valid quiz ID is required." });
    }

    let rows;

    try {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
            return res.status(400).json({ message: "Excel file contains no worksheet." });
        }

        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            defval: ""
        });
    } catch (error) {
        console.error("Excel processing error:", error.message);
        return res.status(400).json({ message: "Could not read the Excel file." });
    }

    if (!rows.length) {
        return res.status(400).json({ message: "Excel file is empty." });
    }

    const getValue = (row, ...keys) => {
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
                return String(row[key]).trim();
            }
        }
        return "";
    };

    const validRows = [];
    let skipped = 0;

    for (const row of rows) {
        const question = getValue(row, "question", "Question");
        const option1 = getValue(row, "option1", "Option1", "option 1", "Option 1");
        const option2 = getValue(row, "option2", "Option2", "option 2", "Option 2");
        const option3 = getValue(row, "option3", "Option3", "option 3", "Option 3");
        const option4 = getValue(row, "option4", "Option4", "option 4", "Option 4");
        const correctAnswer = getValue(
            row,
            "correct_answer",
            "Correct_answer",
            "correctAnswer",
            "CorrectAnswer",
            "answer",
            "Answer"
        );

        if (!question || !option1 || !option2 || !option3 || !option4 || !correctAnswer) {
            skipped++;
            continue;
        }

        validRows.push([
            question, option1, option2, option3, option4, correctAnswer, quizId
        ]);
    }

    if (!validRows.length) {
        return res.status(400).json({
            message: "No valid questions found. Check the Excel column names."
        });
    }

    db.query(
        "SELECT id FROM quizzes WHERE id = ?",
        [quizId],
        (quizErr, quizRows) => {
            if (quizErr) return sendDbError(res, "Quiz lookup error", quizErr);
            if (!quizRows.length) {
                return res.status(404).json({ message: "Quiz not found." });
            }

            db.query(
                `INSERT INTO questions
                    (question, option1, option2, option3, option4, correct_answer, quiz_id)
                 VALUES ?`,
                [validRows],
                (insertErr, result) => {
                    if (insertErr) {
                        return sendDbError(res, "Insert questions error", insertErr, "Failed to insert questions.");
                    }

                    return res.json({
                        success: true,
                        message: "Questions uploaded successfully.",
                        inserted: result.affectedRows,
                        skipped
                    });
                }
            );
        }
    );
});

// =====================================================
// Update question
// =====================================================

app.put("/api/questions/:id", (req, res) => {
    const questionId = parsePositiveInteger(req.params.id);
    const {
        question,
        option1,
        option2,
        option3,
        option4,
        correct_answer
    } = req.body;

    if (!questionId) {
        return res.status(400).json({ message: "Invalid question ID." });
    }

    if (!question || !option1 || !option2 || !option3 || !option4 || !correct_answer) {
        return res.status(400).json({ message: "All question fields are required." });
    }

    const sql = `
        UPDATE questions
        SET question = ?, option1 = ?, option2 = ?, option3 = ?,
            option4 = ?, correct_answer = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [question, option1, option2, option3, option4, correct_answer, questionId],
        (err, result) => {
            if (err) return sendDbError(res, "Update question error", err, "Failed to update question.");
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Question not found." });
            }
            return res.json({ success: true, message: "Question updated successfully." });
        }
    );
});

// =====================================================
// Delete question
// =====================================================

app.delete("/api/questions/:id", (req, res) => {
    const questionId = parsePositiveInteger(req.params.id);
    if (!questionId) {
        return res.status(400).json({ message: "Invalid question ID." });
    }

    db.query("DELETE FROM questions WHERE id = ?", [questionId], (err, result) => {
        if (err) return sendDbError(res, "Delete question error", err, "Failed to delete question.");
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Question not found." });
        }
        return res.json({ success: true, message: "Question deleted successfully." });
    });
});

// =====================================================
// Save quiz result and individual answers
// =====================================================

app.post("/api/results", (req, res) => {
    const {
        student_id,
        quiz_id,
        score,
        total_questions,
        duration_seconds = 0,
        answers
    } = req.body;

    const studentId = parsePositiveInteger(student_id);
    const quizId = parsePositiveInteger(quiz_id);

    if (!studentId || !quizId) {
        return res.status(400).json({
            message: "Valid student ID and quiz ID are required."
        });
    }

    const seconds = Number(duration_seconds);
    if (!Number.isFinite(seconds) || seconds < 0) {
        return res.status(400).json({
            message: "Duration must be a non-negative number."
        });
    }

    db.query(
        "SELECT id, correct_answer FROM questions WHERE quiz_id = ? ORDER BY id",
        [quizId],
        (questionErr, questions) => {
            if (questionErr) {
                return sendDbError(res, "Question lookup error", questionErr, "Failed to validate quiz answers.");
            }

            if (!questions.length) {
                return res.status(400).json({ message: "This quiz has no questions." });
            }

            const hasAnswers = Array.isArray(answers);
            let finalScore;
            let finalTotal;
            let answerRecords = [];

            if (hasAnswers) {
                const correctMap = new Map(
                    questions.map(q => [String(q.id), String(q.correct_answer).trim()])
                );
                const seen = new Set();

                for (const item of answers) {
                    if (!item || item.question_id == null) continue;

                    const questionId = String(item.question_id);
                    if (!correctMap.has(questionId) || seen.has(questionId)) continue;

                    seen.add(questionId);

                    const selected = item.selected_answer == null
                        ? null
                        : String(item.selected_answer).trim();

                    answerRecords.push({
                        question_id: Number(questionId),
                        selected_answer: selected,
                        is_correct: selected !== null && selected === correctMap.get(questionId)
                    });
                }

                finalScore = answerRecords.filter(item => item.is_correct).length;
                finalTotal = questions.length;
            } else {
                if (
                    score === undefined ||
                    total_questions === undefined ||
                    !Number.isFinite(Number(score)) ||
                    !Number.isFinite(Number(total_questions)) ||
                    Number(score) < 0 ||
                    Number(total_questions) <= 0 ||
                    Number(score) > Number(total_questions)
                ) {
                    return res.status(400).json({
                        message: "Valid score and total questions are required."
                    });
                }

                finalScore = Number(score);
                finalTotal = Number(total_questions);
            }

            db.getConnection((connectionErr, connection) => {
                if (connectionErr) {
                    return sendDbError(res, "DB connection error", connectionErr, "Could not save quiz result.");
                }

                connection.beginTransaction(transactionErr => {
                    if (transactionErr) {
                        connection.release();
                        return sendDbError(res, "Transaction error", transactionErr, "Could not start result transaction.");
                    }

                    const rollback = message => {
                        connection.rollback(() => {
                            connection.release();
                            return res.status(500).json({ message });
                        });
                    };

                    connection.query(
                        `INSERT INTO quiz_results
                            (student_id, quiz_id, score, total_questions, duration_seconds)
                         VALUES (?, ?, ?, ?, ?)`,
                        [studentId, quizId, finalScore, finalTotal, Math.floor(seconds)],
                        (resultErr, result) => {
                            if (resultErr) {
                                console.error("Save result error:", resultErr.message);
                                return rollback("Failed to save quiz result.");
                            }

                            const resultId = result.insertId;

                            const saveNextAnswer = index => {
                                if (index >= answerRecords.length) {
                                    return connection.commit(commitErr => {
                                        if (commitErr) {
                                            console.error("Commit error:", commitErr.message);
                                            return rollback("Failed to finish saving quiz attempt.");
                                        }

                                        connection.release();

                                        return res.json({
                                            success: true,
                                            message: "Quiz result saved successfully.",
                                            resultId,
                                            score: finalScore,
                                            total_questions: finalTotal,
                                            percentage: Number(((finalScore / finalTotal) * 100).toFixed(2))
                                        });
                                    });
                                }

                                const item = answerRecords[index];

                                connection.query(
                                    `INSERT INTO quiz_attempt_answers
                                        (result_id, question_id, selected_answer, is_correct)
                                     VALUES (?, ?, ?, ?)`,
                                    [
                                        resultId,
                                        item.question_id,
                                        item.selected_answer,
                                        item.is_correct
                                    ],
                                    answerErr => {
                                        if (answerErr) {
                                            console.error("Save answer error:", answerErr.message);
                                            return rollback("Failed to save individual answers.");
                                        }
                                        saveNextAnswer(index + 1);
                                    }
                                );
                            };

                            saveNextAnswer(0);
                        }
                    );
                });
            });
        }
    );
});

// =====================================================
// Student quiz history
// =====================================================

app.get("/api/history/:studentId", (req, res) => {
    const studentId = parsePositiveInteger(req.params.studentId);
    if (!studentId) {
        return res.status(400).json({ message: "Invalid student ID." });
    }

    const sql = `
        SELECT
            r.id AS result_id,
            r.quiz_id,
            q.title AS quiz_title,
            r.score,
            r.total_questions,
            ROUND(r.score * 100.0 / NULLIF(r.total_questions, 0), 2) AS percentage,
            r.duration_seconds,
            r.submitted_at
        FROM quiz_results r
        JOIN quizzes q ON q.id = r.quiz_id
        WHERE r.student_id = ?
        ORDER BY r.submitted_at DESC
    `;

    db.query(sql, [studentId], (err, results) => {
        if (err) return sendDbError(res, "Quiz history error", err, "Failed to fetch quiz history.");
        return res.json(results);
    });
});

// =====================================================
// Student performance analytics
// =====================================================

app.get("/api/analytics/:studentId", (req, res) => {
    const studentId = parsePositiveInteger(req.params.studentId);
    if (!studentId) {
        return res.status(400).json({ message: "Invalid student ID." });
    }

    const sql = `
        SELECT
            COUNT(*) AS attempts,
            COALESCE(SUM(score), 0) AS total_correct,
            COALESCE(SUM(total_questions), 0) AS total_questions,
            ROUND(
                COALESCE(SUM(score), 0) * 100.0 /
                NULLIF(SUM(total_questions), 0), 2
            ) AS overall_percentage,
            ROUND(AVG(score * 100.0 / NULLIF(total_questions, 0)), 2)
                AS average_attempt_percentage,
            COALESCE(MAX(duration_seconds), 0) AS longest_attempt_seconds
        FROM quiz_results
        WHERE student_id = ?
    `;

    db.query(sql, [studentId], (err, results) => {
        if (err) return sendDbError(res, "Analytics error", err, "Failed to fetch analytics.");
        return res.json(results[0]);
    });
});

// =====================================================
// Quiz leaderboard
// =====================================================

app.get("/api/leaderboard/:quizId", (req, res) => {
    const quizId = parsePositiveInteger(req.params.quizId);
    if (!quizId) {
        return res.status(400).json({ message: "Invalid quiz ID." });
    }

    const sql = `
        SELECT
            u.id AS student_id,
            u.name AS student_name,
            MAX(r.score) AS best_score,
            MAX(r.total_questions) AS total_questions,
            ROUND(MAX(r.score * 100.0 / NULLIF(r.total_questions, 0)), 2) AS percentage
        FROM quiz_results r
        JOIN users u ON u.id = r.student_id
        WHERE r.quiz_id = ?
        GROUP BY u.id, u.name
        ORDER BY best_score DESC, percentage DESC, u.name ASC
        LIMIT 100
    `;

    db.query(sql, [quizId], (err, results) => {
        if (err) return sendDbError(res, "Leaderboard error", err, "Failed to fetch leaderboard.");
        return res.json(results);
    });
});

// =====================================================
// Start server
// =====================================================

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
