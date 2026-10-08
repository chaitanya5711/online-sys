const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const XLSX = require("xlsx");
require("dotenv").config();

const app = express();

const PORT = 5000;


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
// MySQL Connection
// =========================

const db = mysql.createConnection({

    host: process.env.DB_HOST,

    user: process.env.DB_USER,

    password: process.env.DB_PASSWORD,

    database: process.env.DB_NAME,

    port: process.env.DB_PORT

});


db.connect(
    (err) => {

        if (err) {

            console.error(
                "MySQL connection error:",
                err
            );

            return;
        }

        console.log(
            "MySQL connected successfully."
        );

    }
);


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
                        err
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
                        err
                    );

                    return res.status(500).json({

                        message:
                            "Server error."

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

                    user:
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
                        err
                    );

                    return res.status(500).json({

                        message:
                            "Server error."

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

                    user:
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
                        err
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
                        err
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
                                    err
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
                error
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
                        err
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
                        err
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
// Save Quiz Result
// =========================

app.post(
    "/api/results",
    (req, res) => {

        const {
            student_id,
            quiz_id,
            score,
            total_questions
        } = req.body;


        if (
            !student_id ||
            !quiz_id ||
            score === undefined ||
            !total_questions
        ) {

            return res.status(400).json({

                message:
                    "All result fields are required."

            });

        }


        const sql = `
            INSERT INTO quiz_results
            (
                student_id,
                quiz_id,
                score,
                total_questions
            )
            VALUES (?, ?, ?, ?)
        `;


        db.query(
            sql,
            [

                student_id,

                quiz_id,

                score,

                total_questions

            ],
            (err, result) => {

                if (err) {

                    console.error(
                        "Save result error:",
                        err
                    );


                    return res.status(500).json({

                        message:
                            "Failed to save quiz result."

                    });

                }


                res.json({

                    success: true,

                    message:
                        "Quiz result saved successfully.",

                    resultId:
                        result.insertId

                });

            }
        );

    }
);


// =========================
// Start Server
// =========================

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

    }
);