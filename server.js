
const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const XLSX = require("xlsx");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;


// =========================
// Middleware
// =========================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =========================
// Database Configuration
// =========================

console.log("=================================");
console.log("DATABASE CONFIGURATION");
console.log("=================================");

console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_PASSWORD: [HIDDEN]");

console.log("=================================");


// =========================
// MySQL Connection Pool
// =========================

const db = mysql.createPool({

    host: process.env.DB_HOST,

    port: Number(process.env.DB_PORT),

    user: process.env.DB_USER,

    password: process.env.DB_PASSWORD,

    database: process.env.DB_NAME,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0,

    connectTimeout: 20000

});


// =========================
// Test Database Connection
// =========================

db.getConnection((err, connection) => {

    if (err) {

        console.error(
            "MYSQL CONNECTION ERROR:",
            err.message
        );

        return;
    }

    console.log(
        "MySQL connection established successfully."
    );


    // Check which database Render is actually using

    connection.query(
        "SELECT DATABASE() AS current_database",
        (err, results) => {

            if (err) {

                console.error(
                    "DATABASE CHECK ERROR:",
                    err.message
                );

            } else {

                console.log(
                    "CURRENT DATABASE:",
                    results[0].current_database
                );

            }


            // Check available tables

            connection.query(
                "SHOW TABLES",
                (err, results) => {

                    if (err) {

                        console.error(
                            "SHOW TABLES ERROR:",
                            err.message
                        );

                    } else {

                        console.log(
                            "TABLES AVAILABLE IN DATABASE:"
                        );

                        console.log(
                            results
                        );

                    }

                    connection.release();

                }
            );

        }
    );

});


// =========================
// Home Page
// =========================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// =========================
// Get Questions
// =========================

app.get(
    "/api/questions",
    (req, res) => {

        const quizId =
            req.query.quiz_id;


        let sql = `
            SELECT
                id,
                question,
                option1,
                option2,
                option3,
                option4,
                correct_answer,
                quiz_id
            FROM questions
        `;


        let values = [];


        if (quizId) {

            sql += `
                WHERE quiz_id = ?
            `;

            values.push(
                quizId
            );

        }


        sql += `
            ORDER BY id ASC
        `;


        db.query(
            sql,
            values,
            (err, results) => {

                if (err) {

                    console.error(
                        "Get questions error:",
                        err.message
                    );

                    return res.status(500).json({

                        message:
                            "Failed to fetch questions."

                    });

                }


                const formattedQuestions =
                    results.map(
                        function (item) {

                            return {

                                id:
                                    item.id,

                                question:
                                    item.question,

                                options: [

                                    item.option1,

                                    item.option2,

                                    item.option3,

                                    item.option4

                                ],

                                answer:
                                    item.correct_answer,

                                quiz_id:
                                    item.quiz_id

                            };

                        }
                    );


                res.json(
                    formattedQuestions
                );

            }
        );

    }
);


// =========================
// Teacher Login
// =========================

app.post(
    "/api/teacher/login",
    (req, res) => {

        const {
            email,
            password
        } = req.body;


        const sql = `
            SELECT
                id,
                name,
                email,
                role
            FROM users
            WHERE email = ?
            AND password = ?
            AND role = 'teacher'
        `;


        db.query(
            sql,
            [
                email,
                password
            ],
            (err, results) => {

                if (err) {

                    console.error(
                        "Teacher login error:",
                        err.message
                    );

                    return res.status(500).json({

                        message:
                            "Server error: " +
                            err.message

                    });

                }


                if (
                    results.length === 0
                ) {

                    return res.status(401).json({

                        message:
                            "Invalid teacher email or password."

                    });

                }


                res.json({

                    success: true,

                    teacher:
                        results[0]

                });

            }
        );

    }
);


// =========================
// Student Login
// =========================

app.post(
    "/api/student/login",
    (req, res) => {

        const {
            email,
            password
        } = req.body;


        const sql = `
            SELECT
                id,
                name,
                email,
                role
            FROM users
            WHERE email = ?
            AND password = ?
            AND role = 'student'
        `;


        db.query(
            sql,
            [
                email,
                password
            ],
            (err, results) => {

                if (err) {

                    console.error(
                        "Student login error:",
                        err.message
                    );

                    return res.status(500).json({

                        message:
                            "Server error: " +
                            err.message

                    });

                }


                if (
                    results.length === 0
                ) {

                    return res.status(401).json({

                        message:
                            "Invalid student email or password."

                    });

                }


                res.json({

                    success: true,

                    student:
                        results[0]

                });

            }
        );

    }
);


// =========================
// Get All Quizzes
// =========================

app.get(
    "/api/quizzes",
    (req, res) => {

        const sql = `
            SELECT
                id,
                title,
                description,
                duration,
                is_active,
                created_by,
                created_at
            FROM quizzes
            ORDER BY id DESC
        `;


        db.query(
            sql,
            (err, results) => {

                if (err) {

                    console.error(
                        "Get quizzes error:",
                        err.message
                    );

                    return res.status(500).json({

                        message:
                            "Failed to fetch quizzes."

                    });

                }


                res.json(
                    results
                );

            }
        );

    }
);


// =========================
// Create Quiz
// =========================

app.post(
    "/api/quizzes",
    (req, res) => {

        const {
            title,
            description,
            duration,
            created_by
        } = req.body;


        if (
            !title ||
            !duration
        ) {

            return res.status(400).json({

                message:
                    "Quiz title and duration are required."

            });

        }


        const sql = `
            INSERT INTO quizzes
            (
                title,
                description,
                duration,
                created_by
            )
            VALUES (?, ?, ?, ?)
        `;


        db.query(
            sql,
            [
                title,
                description || "",
                duration,
                created_by
            ],
            (err, result) => {

                if (err) {

                    console.error(
                        "Create quiz error:",
                        err.message
                    );

                    return res.status(500).json({

                        message:
                            "Failed to create quiz."

                    });

                }


                res.json({

                    success: true,

                    message:
                        "Quiz created successfully.",

                    quizId:
                        result.insertId

                });

            }
        );

    }
);


// =========================
// Multer Configuration
// =========================

const upload =
    multer({
        storage:
            multer.memoryStorage()
    });


// =========================
// Upload Test Route
// =========================

app.post(
    "/api/questions/upload-test",
    (req, res) => {

        console.log(
            "Upload test route reached"
        );


        res.json({

            success: true,

            message:
                "Upload route is working"

        });

    }
);


// =========================
// Upload Questions from Excel
// =========================

app.post(
    "/api/questions/upload",
    upload.single("excel"),
    (req, res) => {

        console.log(
            "Excel upload request received"
        );


        if (!req.file) {

            return res.status(400).json({

                message:
                    "Please upload an Excel file."

            });

        }


        const quizId =
            req.body.quiz_id;


        if (!quizId) {

            return res.status(400).json({

                message:
                    "Quiz ID is required."

            });

        }


        try {

            const workbook =
                XLSX.read(
                    req.file.buffer,
                    {
                        type: "buffer"
                    }
                );


            const sheetName =
                workbook.SheetNames[0];


            const worksheet =
                workbook.Sheets[
                    sheetName
                ];


            const rows =
                XLSX.utils.sheet_to_json(
                    worksheet
                );


            console.log(
                "Excel rows:",
                rows
            );


            if (
                rows.length === 0
            ) {

                return res.status(400).json({

                    message:
                        "Excel file is empty."

                });

            }


            let inserted = 0;


            const insertNext =
                (index) => {

                    if (
                        index >=
                        rows.length
                    ) {

                        return res.json({

                            success: true,

                            message:
                                "Questions uploaded successfully.",

                            inserted:
                                inserted

                        });

                    }


                    const row =
                        rows[index];


                    const question =
                        row.question ||
                        row.Question;


                    const option1 =
                        row.option1 ||
                        row.Option1;


                    const option2 =
                        row.option2 ||
                        row.Option2;


                    const option3 =
                        row.option3 ||
                        row.Option3;


                    const option4 =
                        row.option4 ||
                        row.Option4;


                    const correctAnswer =
                        row.correct_answer ||
                        row.Correct_answer ||
                        row.correctAnswer ||
                        row.CorrectAnswer;


                    if (
                        !question ||
                        !option1 ||
                        !option2 ||
                        !option3 ||
                        !option4 ||
                        !correctAnswer
                    ) {

                        console.log(
                            "Skipping invalid row:",
                            row
                        );


                        return insertNext(
                            index + 1
                        );

                    }


                    const sql = `
                        INSERT INTO questions
                        (
                            question,
                            option1,
                            option2,
                            option3,
                            option4,
                            correct_answer,
                            quiz_id
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;


                    db.query(
                        sql,
                        [

                            question,

                            option1,

                            option2,

                            option3,

                            option4,

                            correctAnswer,

                            quizId

                        ],
                        (err) => {

                            if (err) {

                                console.error(
                                    "Insert question error:",
                                    err.message
                                );


                                return res.status(500).json({

                                    message:
                                        "Failed to insert question."

                                });

                            }


                            inserted++;


                            insertNext(
                                index + 1
                            );

                        }
                    );

                };


            insertNext(0);

        } catch (error) {

            console.error(
                "Excel processing error:",
                error.message
            );


            res.status(500).json({

                message:
                    "Failed to process Excel file."

            });

        }

    }
);


// =========================
// Update Question
// =========================

app.put(
    "/api/questions/:id",
    (req, res) => {

        const questionId =
            req.params.id;


        const {
            question,
            option1,
            option2,
            option3,
            option4,
            correct_answer
        } = req.body;


        if (
            !question ||
            !option1 ||
            !option2 ||
            !option3 ||
            !option4 ||
            !correct_answer
        ) {

            return res.status(400).json({

                message:
                    "All question fields are required."

            });

        }


        const sql = `
            UPDATE questions
            SET
                question = ?,
                option1 = ?,
                option2 = ?,
                option3 = ?,
                option4 = ?,
                correct_answer = ?
            WHERE id = ?
        `;


        db.query(
            sql,
            [

                question,

                option1,

                option2,

                option3,

                option4,

                correct_answer,

                questionId

            ],
            (err, result) => {

                if (err) {

                    console.error(
                        "Update question error:",
                        err.message
                    );


                    return res.status(500).json({

                        message:
                            "Failed to update question."

                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.status(404).json({

                        message:
                            "Question not found."

                    });

                }


                res.json({

                    success: true,

                    message:
                        "Question updated successfully."

                });

            }
        );

    }
);


// =========================
// Delete Question
// =========================

app.delete(
    "/api/questions/:id",
    (req, res) => {

        const questionId =
            req.params.id;


        const sql = `
            DELETE FROM questions
            WHERE id = ?
        `;


        db.query(
            sql,
            [
                questionId
            ],
            (err, result) => {

                if (err) {

                    console.error(
                        "Delete question error:",
                        err.message
                    );


                    return res.status(500).json({

                        message:
                            "Failed to delete question."

                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.status(404).json({

                        message:
                            "Question not found."

                    });

                }


                res.json({

                    success: true,

                    message:
                        "Question deleted successfully."

                });

            }
        );

    }
);



 // =========================
// Save Quiz Result and Answers
// =========================

app.post("/api/results", (req, res) => {
    const {
        student_id,
        quiz_id,
        score,
        total_questions,
        duration_seconds = 0,
        answers
    } = req.body;

    if (!student_id || !quiz_id) {
        return res.status(400).json({
            message: "Student ID and quiz ID are required."
        });
    }

    const hasAnswers = Array.isArray(answers);

    db.query(
        "SELECT id, correct_answer FROM questions WHERE quiz_id = ? ORDER BY id",
        [quiz_id],
        (err, questions) => {
            if (err) {
                console.error("Question lookup error:", err.message);
                return res.status(500).json({
                    message: "Failed to validate quiz answers."
                });
            }

            if (questions.length === 0) {
                return res.status(400).json({
                    message: "This quiz has no questions."
                });
            }

            let finalScore;
            let finalTotal;
            let answerRecords = [];

            if (hasAnswers) {
                const questionMap = new Map(
                    questions.map(q => [
                        String(q.id),
                        String(q.correct_answer).trim()
                    ])
                );

                const seen = new Set();

                for (const item of answers) {
                    if (!item || item.question_id == null) continue;

                    const questionId = String(item.question_id);

                    if (
                        !questionMap.has(questionId) ||
                        seen.has(questionId)
                    ) {
                        continue;
                    }

                    seen.add(questionId);

                    const selected =
                        item.selected_answer == null
                            ? null
                            : String(item.selected_answer).trim();

                    const correct =
                        selected !== null &&
                        selected === questionMap.get(questionId);

                    answerRecords.push({
                        question_id: Number(questionId),
                        selected_answer: selected,
                        is_correct: correct
                    });
                }

                finalScore = answerRecords.filter(
                    item => item.is_correct
                ).length;

                finalTotal = questions.length;
            } else {
                // Backward compatibility with the existing frontend.
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

            const seconds = Number(duration_seconds);

            if (!Number.isFinite(seconds) || seconds < 0) {
                return res.status(400).json({
                    message: "Duration must be a non-negative number."
                });
            }

            db.getConnection((connectionError, connection) => {
                if (connectionError) {
                    console.error("DB connection error:", connectionError.message);
                    return res.status(500).json({
                        message: "Could not save quiz result."
                    });
                }

                connection.beginTransaction(transactionError => {
                    if (transactionError) {
                        connection.release();
                        return res.status(500).json({
                            message: "Could not start result transaction."
                        });
                    }

                    const rollback = message => {
                        connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ message });
                        });
                    };

                    connection.query(
                        `INSERT INTO quiz_results
                         (student_id, quiz_id, score, total_questions, duration_seconds)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            student_id,
                            quiz_id,
                            finalScore,
                            finalTotal,
                            Math.floor(seconds)
                        ],
                        (insertError, result) => {
                            if (insertError) {
                                console.error("Save result error:", insertError.message);
                                return rollback("Failed to save quiz result.");
                            }

                            const resultId = result.insertId;

                            const saveNextAnswer = index => {
                                if (index >= answerRecords.length) {
                                    return connection.commit(commitError => {
                                        if (commitError) {
                                            console.error("Commit error:", commitError.message);
                                            return rollback("Failed to finish saving quiz attempt.");
                                        }

                                        connection.release();

                                        res.json({
                                            success: true,
                                            message: "Quiz result saved successfully.",
                                            resultId,
                                            score: finalScore,
                                            total_questions: finalTotal,
                                            percentage: Number(
                                                ((finalScore / finalTotal) * 100).toFixed(2)
                                            )
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
                                    insertAnswerError => {
                                        if (insertAnswerError) {
                                            console.error(
                                                "Save answer error:",
                                                insertAnswerError.message
                                            );
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


// =========================
// Student Quiz History
// =========================

app.get("/api/history/:studentId", (req, res) => {
    const studentId = req.params.studentId;

    db.query(
        `SELECT
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
         ORDER BY r.submitted_at DESC`,
        [studentId],
        (err, results) => {
            if (err) {
                console.error("Quiz history error:", err.message);
                return res.status(500).json({
                    message: "Failed to fetch quiz history."
                });
            }

            res.json(results);
        }
    );
});


// =========================
// Student Performance Analytics
// =========================

app.get("/api/analytics/:studentId", (req, res) => {
    const studentId = req.params.studentId;

    db.query(
        `SELECT
            COUNT(*) AS attempts,
            COALESCE(SUM(score), 0) AS total_correct,
            COALESCE(SUM(total_questions), 0) AS total_questions,
            ROUND(
                COALESCE(SUM(score), 0) * 100.0 /
                NULLIF(SUM(total_questions), 0),
                2
            ) AS overall_percentage,
            ROUND(AVG(score * 100.0 / NULLIF(total_questions, 0)), 2)
                AS average_attempt_percentage,
            COALESCE(MAX(duration_seconds), 0) AS longest_attempt_seconds
         FROM quiz_results
         WHERE student_id = ?`,
        [studentId],
        (err, results) => {
            if (err) {
                console.error("Analytics error:", err.message);
                return res.status(500).json({
                    message: "Failed to fetch analytics."
                });
            }

            res.json(results[0]);
        }
    );
});


// =========================
// Quiz Leaderboard
// =========================

app.get("/api/leaderboard/:quizId", (req, res) => {
    const quizId = req.params.quizId;

    db.query(
        `SELECT
            u.id AS student_id,
            u.name AS student_name,
            MAX(r.score) AS best_score,
            MAX(r.total_questions) AS total_questions,
            ROUND(
                MAX(r.score * 100.0 / NULLIF(r.total_questions, 0)),
                2
            ) AS percentage
         FROM quiz_results r
         JOIN users u ON u.id = r.student_id
         WHERE r.quiz_id = ?
         GROUP BY u.id, u.name
         ORDER BY best_score DESC, percentage DESC, u.name ASC
         LIMIT 100`,
        [quizId],
        (err, results) => {
            if (err) {
                console.error("Leaderboard error:", err.message);
                return res.status(500).json({
                    message: "Failed to fetch leaderboard."
                });
            }

            res.json(results);
        }
    );
});

// =========================
// Start Server
// =========================

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

    }
);

