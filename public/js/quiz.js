
let questions = [];
let currentQuestion = 0;
let score = 0;
let timeLeft = 60;
let timer = null;
let quizFinished = false;
let selectedAnswers = [];

// ================================
// HTML ELEMENTS
// ================================

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

// ================================
// GET USER
// ================================

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

if (studentNameElement && user.name) {
    studentNameElement.textContent = `Welcome, ${user.name}`;
}

// ================================
// GET SELECTED QUIZ
// ================================

const selectedQuizId = localStorage.getItem("selectedQuizId");

if (!selectedQuizId) {
    alert("No quiz selected.");
    window.location.href = "student.html";
    throw new Error("No quiz selected.");
}

// ================================
// GET QUIZ DETAILS
// ================================

async function getQuizDetails() {
    try {
        const response = await fetch("/api/quizzes");

        if (!response.ok) {
            throw new Error("Unable to load quizzes.");
        }

        const quizzes = await response.json();

        const selectedQuiz = quizzes.find(
            quiz => String(quiz.id) === String(selectedQuizId)
        );

        if (!selectedQuiz) {
            alert("Quiz not found.");
            window.location.href = "student.html";
            return false;
        }

        timeLeft = Number(selectedQuiz.duration);

        if (!Number.isFinite(timeLeft) || timeLeft <= 0) {
            timeLeft = 60;
        }

        if (timerElement) {
            timerElement.textContent = formatTime(timeLeft);
        }

        if (quizTitleElement) {
            quizTitleElement.textContent = selectedQuiz.title;
        }

        return true;
    } catch (error) {
        console.error("Quiz details error:", error);
        alert("Unable to load quiz details. Please try again.");
        return false;
    }
}

// ================================
// NORMALIZE QUESTION OPTIONS
// ================================

function getQuestionOptions(question) {
    if (Array.isArray(question.options)) {
        return question.options.map(option => {
            if (typeof option === "object" && option !== null) {
                return String(
                    option.text ?? option.value ?? option.label ?? ""
                );
            }

            return String(option ?? "");
        });
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

// ================================
// GET CORRECT ANSWER
// Supports 1-4, A-D, and answer text
// ================================

function getCorrectAnswerText(question) {
    const correctAnswer =
        question.correct_answer ?? question.answer;

    if (
        correctAnswer === undefined ||
        correctAnswer === null ||
        String(correctAnswer).trim() === ""
    ) {
        return null;
    }

    const answer = String(correctAnswer).trim();
    const options = getQuestionOptions(question);

    // Database stores option numbers: 1, 2, 3, 4
    if (/^[1-4]$/.test(answer)) {
        return options[Number(answer) - 1] ?? null;
    }

    // Database stores option letters: A, B, C, D
    if (/^[A-D]$/i.test(answer)) {
        return options[answer.toUpperCase().charCodeAt(0) - 65] ?? null;
    }

    // Database stores the full correct answer text
    return answer;
}

// ================================
// GET QUESTIONS
// ================================

async function getQuestions() {
    try {
        const response = await fetch(
            `/api/questions?quiz_id=${encodeURIComponent(selectedQuizId)}`
        );

        if (!response.ok) {
            throw new Error("Unable to load questions.");
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            if (questionElement) {
                questionElement.textContent = "No questions available.";
            }
            return false;
        }

        questions = data.map(question => ({
            ...question,
            options: getQuestionOptions(question)
        }));

        selectedAnswers = new Array(questions.length).fill(null);

        console.log("Questions received from API:", questions);

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

        return false;
    }
}

// ================================
// CREATE QUESTION NAVIGATION
// ================================

function createQuestionNavigation() {
    if (!navigationElement) return;

    navigationElement.innerHTML = "";

    questions.forEach((question, index) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "question-number-btn";
        button.textContent = index + 1;

        button.onclick = function () {
            goToQuestion(index);
        };

        navigationElement.appendChild(button);
    });

    updateQuestionNavigation();
}

// ================================
// UPDATE NAVIGATION
// ================================

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

// ================================
// LOAD QUESTION
// ================================

function loadQuestion(index) {
    if (index < 0 || index >= questions.length) return;

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

        if (selectedAnswers[currentQuestion] === option) {
            button.classList.add("selected");
        }

        button.onclick = function () {
            selectAnswer(option);
        };

        optionsElement.appendChild(button);
    });

    updateNavigationButtons();
    updateQuestionNavigation();
}

// ================================
// SELECT ANSWER
// ================================

function selectAnswer(selectedAnswer) {
    if (quizFinished) return;

    selectedAnswers[currentQuestion] = selectedAnswer;

    const buttons = optionsElement.querySelectorAll(".option-btn");

    buttons.forEach(button => {
        button.classList.toggle(
            "selected",
            button.textContent === selectedAnswer
        );
    });

    updateQuestionNavigation();
}

// ================================
// PREVIOUS QUESTION
// ================================

function previousQuestion() {
    if (quizFinished) return;

    if (currentQuestion > 0) {
        loadQuestion(currentQuestion - 1);
    }
}

// ================================
// NEXT QUESTION
// ================================

function nextQuestion() {
    if (quizFinished) return;

    if (currentQuestion < questions.length - 1) {
        loadQuestion(currentQuestion + 1);
    } else {
        showPreview();
    }
}

// ================================
// GO TO QUESTION
// ================================

function goToQuestion(index) {
    if (quizFinished) return;

    loadQuestion(index);
}

// ================================
// UPDATE PREVIOUS / NEXT
// ================================

function updateNavigationButtons() {
    if (previousButton) {
        previousButton.disabled = currentQuestion === 0;
    }

    if (nextButton) {
        nextButton.textContent =
            currentQuestion === questions.length - 1
                ? "Review Test →"
                : "Next →";
    }
}

// ================================
// TIMER
// ================================

function startTimer() {
    clearInterval(timer);

    timer = setInterval(function () {
        if (quizFinished) {
            clearInterval(timer);
            return;
        }

        timeLeft--;

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

// ================================
// FORMAT TIME
// ================================

function formatTime(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `Time: ${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

// ================================
// PREVIEW
// ================================

function showPreview() {
    if (quizFinished) return;

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

            item.onclick = function () {
                closePreview();
                loadQuestion(index);
            };

            previewQuestions.appendChild(item);
        });
    }

    if (previewModal) {
        previewModal.classList.add("show");
    }
}

// ================================
// CLOSE PREVIEW
// ================================

function closePreview() {
    if (previewModal) {
        previewModal.classList.remove("show");
    }
}

// ================================
// SUBMIT FROM PREVIEW
// ================================

function submitFromPreview() {
    if (quizFinished) return;

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

// ================================
// CALCULATE SCORE — UPDATED
// ================================

function calculateScore() {
    score = 0;

    questions.forEach((question, index) => {
        const selectedAnswer = selectedAnswers[index];
        const correctAnswerText = getCorrectAnswerText(question);

        if (
            selectedAnswer === null ||
            selectedAnswer === undefined ||
            correctAnswerText === null
        ) {
            return;
        }

        const selectedText = String(selectedAnswer).trim();
        const correctText = String(correctAnswerText).trim();

        if (
            selectedText.localeCompare(correctText, undefined, {
                sensitivity: "accent"
            }) === 0
        ) {
            score++;
        }
    });

    console.log("Selected answers:", selectedAnswers);
    console.log(
        "Correct answers from API:",
        questions.map(q => q.correct_answer ?? q.answer)
    );
    console.log(
        "Correct answers as option text:",
        questions.map(getCorrectAnswerText)
    );
    console.log("Final score:", score);

    return score;
}

// ================================
// END TEST
// ================================

function endTest() {
    if (quizFinished) return;

    const answeredCount = selectedAnswers.filter(
        answer => answer !== null
    ).length;

    if (
        !confirm(
            `You have answered ${answeredCount} of ${questions.length} questions.\n\nAre you sure you want to end the test?`
        )
    ) {
        return;
    }

    finishQuiz();
}

function endTestWithoutConfirmation() {
    if (quizFinished) return;

    finishQuiz();
}

// ================================
// SAVE RESULT TO MYSQL
// ================================

async function saveResult() {
    try {
        const response = await fetch("/api/results", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                student_id: user.id,
                quiz_id: Number(selectedQuizId),
                score: score,
                total_questions: questions.length
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error("Result save failed:", data);
            return false;
        }

        console.log("Result saved successfully:", data);
        return true;
    } catch (error) {
        console.error("Result save error:", error);
        return false;
    }
}

// ================================
// FINISH QUIZ
// ================================

async function finishQuiz() {
    if (quizFinished) return;

    quizFinished = true;
    clearInterval(timer);

    if (previousButton) previousButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    if (endButton) endButton.disabled = true;
    if (previewButton) previewButton.disabled = true;

    // Calculate the final score before saving.
    calculateScore();

    const quizResult = {
        score: score,
        total_questions: questions.length
    };

    localStorage.setItem("quizResult", JSON.stringify(quizResult));
    localStorage.setItem("quizScore", String(score));
    localStorage.setItem("totalQuestions", String(questions.length));

    const saved = await saveResult();

    if (!saved) {
        console.error(
            "The result is displayed locally, but saving it to the database failed."
        );
    }

    window.location.href = "result.html";
}

// ================================
// ESCAPE HTML
// ================================

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
}

// ================================
// CLOSE MODAL BY CLICKING OUTSIDE
// ================================

if (previewModal) {
    previewModal.addEventListener("click", function (event) {
        if (event.target === previewModal) {
            closePreview();
        }
    });
}

// ================================
// START
// ================================

async function startQuizPage() {
    const detailsLoaded = await getQuizDetails();

    await getQuizDetails();

    await getQuestions();

}

startQuizPage();
