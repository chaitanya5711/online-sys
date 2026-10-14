
"use strict";

// ============================================
// 1. QUIZ STATE
// ============================================

let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = 70;
let totalDurationSeconds = 70;
let timer = null;
let quizFinished = false;
let selectedAnswers = [];
let quizDetails = null;
let submittingQuiz = false;

// ============================================
// 2. HTML ELEMENTS
// ============================================

const questionElement = document.getElementById("question");
const optionsElement = document.getElementById("options");
const timerElement = document.getElementById("timer");
const nextButton = document.getElementById("next-btn");
const previousButton = document.getElementById("previous-btn");
const endButton = document.getElementById("end-btn");
const previewButton = document.getElementById("preview-btn");
const questionNumberElement = document.getElementById("question-number");
const navigationElement = document.getElementById("question-navigation");
const previewModal = document.getElementById("preview-modal");
const previewSummary = document.getElementById("preview-summary");
const previewQuestions = document.getElementById("preview-questions");
const quizTitleElement = document.getElementById("quiz-title");
const studentNameElement = document.getElementById("student-name");

// ============================================
// 3. GET LOGGED-IN USER
// ============================================

const userData = localStorage.getItem("user");

if (!userData) {
    window.location.href = "login.html";
    throw new Error("User is not logged in.");
}

let user;

try {
    user = JSON.parse(userData);
} catch (error) {
    console.error("Invalid user data:", error);
    localStorage.removeItem("user");
    window.location.href = "login.html";
    throw error;
}

if (!user || !user.id) {
    localStorage.removeItem("user");
    window.location.href = "login.html";
    throw new Error("Invalid user information.");
}

if (user.role && user.role !== "student") {
    alert("Only students can take this quiz.");
    window.location.href = "login.html";
    throw new Error("User is not a student.");
}

if (studentNameElement && user.name) {
    studentNameElement.textContent = `Welcome, ${user.name}`;
}

// ============================================
// 4. GET SELECTED QUIZ
// ============================================

const selectedQuizId = localStorage.getItem("selectedQuizId");

if (!selectedQuizId || !Number.isInteger(Number(selectedQuizId))) {
    alert("No valid quiz selected.");
    window.location.href = "student.html";
    throw new Error("No valid quiz selected.");
}

// ============================================
// 5. HELPER: CHECK API RESPONSE
// ============================================

async function readApiResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message || `Request failed (${response.status}).`
        );
    }

    return data;
}

// ============================================
// 6. GET QUIZ DETAILS
// ============================================

async function getQuizDetails() {
    try {
        const response = await fetch("/api/quizzes");
        const quizzes = await readApiResponse(response);

        if (!Array.isArray(quizzes)) {
            throw new Error("Invalid quiz data received.");
        }

        const selectedQuiz = quizzes.find(
            quiz => String(quiz.id) === String(selectedQuizId)
        );

        if (!selectedQuiz) {
            alert("Quiz not found.");
            window.location.href = "student.html";
            return false;
        }

        if (
            selectedQuiz.is_active === false ||
            selectedQuiz.is_active === 0 ||
            selectedQuiz.is_active === "0"
        ) {
            alert("This quiz is currently inactive.");
            window.location.href = "student.html";
            return false;
        }

        quizDetails = selectedQuiz;

        // The quizzes.duration field is assumed to be in minutes.
        const durationMinutes = Number(selectedQuiz.duration);

        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            throw new Error("The quiz duration is invalid.");
        }

        totalDurationSeconds = Math.floor(durationMinutes * 60);
        timeLeft = totalDurationSeconds;

        if (timerElement) {
            timerElement.textContent = formatTime(timeLeft);
            timerElement.classList.remove("warning", "danger");
        }

        if (quizTitleElement) {
            quizTitleElement.textContent = selectedQuiz.title;
        }

        // Save settings for use on the result page.
        localStorage.setItem(
            "currentQuizSettings",
            JSON.stringify({
                quiz_id: selectedQuiz.id,
                title: selectedQuiz.title,
                exam_mode: Boolean(Number(selectedQuiz.exam_mode)),
                pass_percentage: Number(selectedQuiz.pass_percentage ?? 40),
                duration_minutes: durationMinutes
            })
        );

        return true;
    } catch (error) {
        console.error("Quiz details error:", error);
        alert("Unable to load quiz details. Please try again.");
        return false;
    }
}

// ============================================
// 7. NORMALIZE QUESTION OPTIONS
// ============================================

function getQuestionOptions(question) {
    if (Array.isArray(question.options)) {
        return question.options
            .map(option => {
                if (typeof option === "object" && option !== null) {
                    return String(
                        option.text ??
                        option.value ??
                        option.label ??
                        ""
                    );
                }

                return String(option ?? "");
            })
            .filter(option => option.trim() !== "");
    }

    return [
        question.option1,
        question.option2,
        question.option3,
        question.option4
    ]
        .filter(option => option !== undefined && option !== null)
        .map(option => String(option));
}

// ============================================
// 8. GET CORRECT ANSWER TEXT
// Supports answer text, 1-4, and A-D
// ============================================

function getCorrectAnswerText(question) {
    const rawAnswer = question.correct_answer ?? question.answer;

    if (
        rawAnswer === undefined ||
        rawAnswer === null ||
        String(rawAnswer).trim() === ""
    ) {
        return null;
    }

    const answer = String(rawAnswer).trim();
    const options = getQuestionOptions(question);

    if (/^[1-4]$/.test(answer)) {
        return options[Number(answer) - 1] ?? null;
    }

    if (/^[A-D]$/i.test(answer)) {
        return options[answer.toUpperCase().charCodeAt(0) - 65] ?? null;
    }

    return answer;
}

// ============================================
// 9. COMPARE ANSWERS
// ============================================

function answersMatch(selectedAnswer, correctAnswer) {
    if (
        selectedAnswer === null ||
        selectedAnswer === undefined ||
        correctAnswer === null ||
        correctAnswer === undefined
    ) {
        return false;
    }

    return String(selectedAnswer).trim().localeCompare(
        String(correctAnswer).trim(),
        undefined,
        { sensitivity: "accent" }
    ) === 0;
}

// ============================================
// 10. GET ANSWER VALUE FOR BACKEND
// ============================================

function getServerSelectedAnswer(question, selectedAnswer) {
    if (selectedAnswer === null || selectedAnswer === undefined) {
        return null;
    }

    const options = getQuestionOptions(question);
    const selectedIndex = options.findIndex(
        option => answersMatch(option, selectedAnswer)
    );

    const rawCorrectAnswer = question.correct_answer ?? question.answer;
    const answerFormat = String(rawCorrectAnswer ?? "").trim();

    // The current server.js compares selected_answer directly
    // with the database's correct_answer.
    // Preserve numeric or letter answer formats for compatibility.
    if (/^[1-4]$/.test(answerFormat)) {
        return selectedIndex >= 0
            ? String(selectedIndex + 1)
            : String(selectedAnswer);
    }

    if (/^[A-D]$/i.test(answerFormat)) {
        return selectedIndex >= 0
            ? String.fromCharCode(65 + selectedIndex)
            : String(selectedAnswer);
    }

    // When correct_answer stores the answer text, send the selected text.
    return String(selectedAnswer);
}

// ============================================
// 11. GET QUESTIONS
// ============================================

async function getQuestions() {
    try {
        const response = await fetch(
            `/api/questions?quiz_id=${encodeURIComponent(selectedQuizId)}`
        );

        const data = await readApiResponse(response);

        if (!Array.isArray(data) || data.length === 0) {
            if (questionElement) {
                questionElement.textContent = "No questions available.";
            }

            if (optionsElement) {
                optionsElement.innerHTML = "";
            }

            return false;
        }

        questions = data.map(question => ({
            ...question,
            options: getQuestionOptions(question)
        }));

        // Apply question shuffling if enabled for this quiz.
        if (Boolean(Number(quizDetails?.shuffle_questions))) {
            questions = shuffleArray(questions);
        }

        selectedAnswers = new Array(questions.length).fill(null);

        console.log("Loaded quiz:", quizDetails?.title);
        console.log("Number of questions:", questions.length);

        createQuestionNavigation();
        loadQuestion(0);
        startTimer();

        return true;
    } catch (error) {
        console.error("Question loading error:", error);

        if (questionElement) {
            questionElement.textContent =
                "Unable to load quiz questions.";
        }

        alert("Unable to load quiz questions. Please try again.");
        return false;
    }
}

// ============================================
// 12. SHUFFLE ARRAY
// ============================================

function shuffleArray(items) {
    const shuffled = [...items];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [
            shuffled[j],
            shuffled[i]
        ];
    }

    return shuffled;
}

// ============================================
// 13. CREATE QUESTION NAVIGATION
// ============================================

function createQuestionNavigation() {
    if (!navigationElement) return;

    navigationElement.innerHTML = "";

    questions.forEach((question, index) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "question-number-btn";
        button.textContent = index + 1;

        button.addEventListener("click", () => {
            goToQuestion(index);
        });

        navigationElement.appendChild(button);
    });

    updateQuestionNavigation();
}

// ============================================
// 14. UPDATE QUESTION NAVIGATION
// ============================================

function updateQuestionNavigation() {
    if (!navigationElement) return;

    const buttons = navigationElement.querySelectorAll(
        ".question-number-btn"
    );

    buttons.forEach((button, index) => {
        button.classList.remove("current", "answered");

        if (index === currentQuestion) {
            button.classList.add("current");
        }

        if (selectedAnswers[index] !== null) {
            button.classList.add("answered");
        }
    });
}

// ============================================
// 15. LOAD QUESTION
// ============================================

function loadQuestion(index) {
    if (quizFinished || index < 0 || index >= questions.length) {
        return;
    }

    currentQuestion = index;

    const question = questions[currentQuestion];

    if (questionElement) {
        questionElement.textContent = question.question;
    }

    if (questionNumberElement) {
        questionNumberElement.textContent =
            `Question ${currentQuestion + 1} of ${questions.length}`;
    }

    if (!optionsElement) return;

    optionsElement.innerHTML = "";

    question.options.forEach(option => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "option-btn";
        button.textContent = option;

        if (answersMatch(selectedAnswers[currentQuestion], option)) {
            button.classList.add("selected");
        }

        button.addEventListener("click", () => {
            selectAnswer(option);
        });

        optionsElement.appendChild(button);
    });

    updateNavigationButtons();
    updateQuestionNavigation();
}

// ============================================
// 16. SELECT ANSWER
// ============================================

function selectAnswer(selectedAnswer) {
    if (quizFinished || submittingQuiz) return;

    selectedAnswers[currentQuestion] = selectedAnswer;

    if (optionsElement) {
        const buttons = optionsElement.querySelectorAll(".option-btn");

        buttons.forEach(button => {
            button.classList.toggle(
                "selected",
                button.textContent === selectedAnswer
            );
        });
    }

    updateQuestionNavigation();
}

// ============================================
// 17. PREVIOUS QUESTION
// ============================================

function previousQuestion() {
    if (quizFinished || submittingQuiz) return;

    if (currentQuestion > 0) {
        loadQuestion(currentQuestion - 1);
    }
}

// ============================================
// 18. NEXT QUESTION
// ============================================

function nextQuestion() {
    if (quizFinished || submittingQuiz) return;

    if (currentQuestion < questions.length - 1) {
        loadQuestion(currentQuestion + 1);
    } else {
        showPreview();
    }
}

// ============================================
// 19. GO TO QUESTION
// ============================================

function goToQuestion(index) {
    if (quizFinished || submittingQuiz) return;

    loadQuestion(index);
}

// ============================================
// 20. UPDATE PREVIOUS / NEXT BUTTONS
// ============================================

function updateNavigationButtons() {
    if (previousButton) {
        previousButton.disabled =
            currentQuestion === 0 || quizFinished;
    }

    if (nextButton) {
        nextButton.disabled = quizFinished;

        nextButton.textContent =
            currentQuestion === questions.length - 1
                ? "Review Test →"
                : "Next →";
    }
}

// ============================================
// 21. TIMER
// ============================================

function startTimer() {
    clearInterval(timer);

    if (timerElement) {
        timerElement.textContent = formatTime(timeLeft);
    }

    timer = setInterval(() => {
        if (quizFinished) {
            clearInterval(timer);
            return;
        }

        timeLeft = Math.max(0, timeLeft - 1);

        if (timerElement) {
            timerElement.textContent = formatTime(timeLeft);

            if (timeLeft <= 30) {
                timerElement.classList.add("warning");
            }

            if (timeLeft <= 10) {
                timerElement.classList.add("danger");
            }
        }

        if (timeLeft <= 0) {
            clearInterval(timer);
            alert("Time is over. Your test will be submitted.");
            endTestWithoutConfirmation();
        }
    }, 1000);
}

// ============================================
// 22. FORMAT TIME
// ============================================

function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `Time: ${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
}

// ============================================
// 23. GET TIME TAKEN
// ============================================

function getDurationSeconds() {
    return Math.max(
        0,
        totalDurationSeconds - Math.max(0, timeLeft)
    );
}

// ============================================
// 24. SHOW PREVIEW
// ============================================

function showPreview() {
    if (quizFinished || submittingQuiz) return;

    const answeredCount = selectedAnswers.filter(
        answer => answer !== null
    ).length;

    const unansweredCount = questions.length - answeredCount;

    if (previewSummary) {
        previewSummary.innerHTML = `
            <div class="summary-card">
                <span>Total Questions</span>
                <strong>${questions.length}</strong>
            </div>
            <div class="summary-card answered-summary">
                <span>Answered</span>
                <strong>${answeredCount}</strong>
            </div>
            <div class="summary-card unanswered-summary">
                <span>Unanswered</span>
                <strong>${unansweredCount}</strong>
            </div>
        `;
    }

    if (previewQuestions) {
        previewQuestions.innerHTML = "";

        questions.forEach((question, index) => {
            const item = document.createElement("div");
            item.className = "preview-question-item";

            const title = document.createElement("strong");
            title.textContent = `Question ${index + 1}`;

            const questionText = document.createElement("p");
            questionText.textContent = question.question;

            const status = document.createElement("div");
            const answered = selectedAnswers[index] !== null;

            status.className = answered
                ? "status-answered"
                : "status-unanswered";

            status.textContent = answered
                ? "Answered"
                : "Not Answered";

            item.append(title, questionText, status);

            item.addEventListener("click", () => {
                closePreview();
                loadQuestion(index);
            });

            previewQuestions.appendChild(item);
        });
    }

    if (previewModal) {
        previewModal.classList.add("show");
    }
}

// ============================================
// 25. CLOSE PREVIEW
// ============================================

function closePreview() {
    if (previewModal) {
        previewModal.classList.remove("show");
    }
}

// ============================================
// 26. SUBMIT FROM PREVIEW
// ============================================

function submitFromPreview() {
    if (quizFinished || submittingQuiz) return;

    const unansweredCount = selectedAnswers.filter(
        answer => answer === null
    ).length;

    const message = unansweredCount > 0
        ? `You have ${unansweredCount} unanswered question(s).\n\nAre you sure you want to submit the test?`
        : "All questions are answered.\n\nAre you sure you want to submit the test?";

    if (!confirm(message)) return;

    closePreview();
    finishQuiz();
}

// ============================================
// 27. CALCULATE SCORE
// ============================================

function calculateScore() {
    score = 0;

    questions.forEach((question, index) => {
        const selectedAnswer = selectedAnswers[index];
        const correctAnswerText = getCorrectAnswerText(question);

        if (answersMatch(selectedAnswer, correctAnswerText)) {
            score++;
        }
    });

    console.log("Selected answers:", selectedAnswers);
    console.log("Final score:", score);

    return score;
}

// ============================================
// 28. END TEST
// ============================================

function endTest() {
    if (quizFinished || submittingQuiz) return;

    const answeredCount = selectedAnswers.filter(
        answer => answer !== null
    ).length;

    if (!confirm(
        `You have answered ${answeredCount} of ${questions.length} questions.\n\nAre you sure you want to end the test?`
    )) {
        return;
    }

    finishQuiz();
}

function endTestWithoutConfirmation() {
    if (quizFinished || submittingQuiz) return;

    finishQuiz();
}

// ============================================
// 29. SAVE RESULT AND INDIVIDUAL ANSWERS
// ============================================

async function saveResult() {
    const answers = questions.map((question, index) => ({
        question_id: question.id,
        selected_answer: getServerSelectedAnswer(
            question,
            selectedAnswers[index]
        )
    }));

    const payload = {
        student_id: user.id,
        quiz_id: Number(selectedQuizId),
        score,
        total_questions: questions.length,
        duration_seconds: getDurationSeconds(),
        answers
    };

    const response = await fetch("/api/results", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await readApiResponse(response);

    if (!data.success) {
        throw new Error(data.message || "Failed to save quiz result.");
    }

    if (data.resultId) {
        localStorage.setItem("quizResultId", String(data.resultId));
    }

    console.log("Quiz result saved:", data);

    return data;
}

// ============================================
// 30. FINISH QUIZ
// ============================================

async function finishQuiz() {
    if (quizFinished || submittingQuiz) return;

    submittingQuiz = true;
    clearInterval(timer);

    // Calculate the score before saving.
    calculateScore();

    const percentage = questions.length > 0
        ? Number(((score / questions.length) * 100).toFixed(2))
        : 0;

    const passPercentage = Number(
        quizDetails?.pass_percentage ?? 40
    );

    const examMode = Boolean(
        Number(quizDetails?.exam_mode)
    );

    const passed = percentage >= passPercentage;

    const result = {
        score,
        total_questions: questions.length,
        percentage,
        passed,
        pass_percentage: passPercentage,
        exam_mode: examMode,
        duration_seconds: getDurationSeconds(),
        quiz_id: Number(selectedQuizId),
        quiz_title: quizDetails?.title ?? "Quiz",
        answers: questions.map((question, index) => ({
            question_id: question.id,
            question: question.question,
            selected_answer: selectedAnswers[index],
            correct_answer: getCorrectAnswerText(question),
            is_correct: answersMatch(
                selectedAnswers[index],
                getCorrectAnswerText(question)
            )
        }))
    };

    // Save the result locally for the existing result page.
    localStorage.setItem("quizResult", JSON.stringify(result));
    localStorage.setItem("quizScore", String(score));
    localStorage.setItem("totalQuestions", String(questions.length));

    if (endButton) endButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    if (previousButton) previousButton.disabled = true;
    if (previewButton) previewButton.disabled = true;

    if (optionsElement) {
        optionsElement.querySelectorAll("button").forEach(button => {
            button.disabled = true;
        });
    }

    try {
        await saveResult();
    } catch (error) {
        console.error("Could not save result to database:", error);

        // Keep the local result so the student can still see it.
        localStorage.setItem("quizSaveError", "true");

        alert(
            "Your result is available locally, but it could not be saved to the database. Please check your connection or contact your teacher."
        );
    }

    quizFinished = true;
    submittingQuiz = false;

    window.location.href = "result.html";
}

// ============================================
// 31. ESCAPE HTML
// ============================================

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
}

// ============================================
// 32. CLOSE PREVIEW BY CLICKING OUTSIDE
// ============================================

if (previewModal) {
    previewModal.addEventListener("click", event => {
        if (event.target === previewModal) {
            closePreview();
        }
    });
}

// ============================================
// 33. START QUIZ PAGE
// ============================================

async function startQuizPage() {
    const detailsLoaded = await getQuizDetails();

    if (!detailsLoaded) return;

    const questionsLoaded = await getQuestions();

    if (!questionsLoaded) {
        clearInterval(timer);
    }
}

startQuizPage();
