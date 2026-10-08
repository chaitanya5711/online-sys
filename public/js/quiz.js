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

const questionElement =
    document.getElementById("question");

const optionsElement =
    document.getElementById("options");

const timerElement =
    document.getElementById("timer");

const nextButton =
    document.getElementById("next-btn");

const previousButton =
    document.getElementById("previous-btn");

const endButton =
    document.getElementById("end-btn");

const previewButton =
    document.getElementById("preview-btn");

const questionNumberElement =
    document.getElementById("question-number");

const navigationElement =
    document.getElementById(
        "question-navigation"
    );

const previewModal =
    document.getElementById(
        "preview-modal"
    );

const previewSummary =
    document.getElementById(
        "preview-summary"
    );

const previewQuestions =
    document.getElementById(
        "preview-questions"
    );

const quizTitleElement =
    document.getElementById(
        "quiz-title"
    );

const studentNameElement =
    document.getElementById(
        "student-name"
    );


// ================================
// GET USER
// ================================

const userData =
    localStorage.getItem("user");


if (!userData) {

    window.location.href =
        "login.html";

}


const user =
    JSON.parse(userData);


if (studentNameElement && user.name) {

    studentNameElement.textContent =
        `Welcome, ${user.name}`;

}


// ================================
// GET SELECTED QUIZ
// ================================

const selectedQuizId =
    localStorage.getItem(
        "selectedQuizId"
    );


if (!selectedQuizId) {

    alert(
        "No quiz selected."
    );

    window.location.href =
        "student.html";

}


// ================================
// GET QUIZ DETAILS
// ================================

async function getQuizDetails() {

    try {

        const response =
            await fetch(
                "/api/quizzes"
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load quizzes."
            );

        }


        const quizzes =
            await response.json();


        const selectedQuiz =
            quizzes.find(
                function (quiz) {

                    return String(quiz.id) ===
                        String(selectedQuizId);

                }
            );


        if (!selectedQuiz) {

            alert(
                "Quiz not found."
            );

            window.location.href =
                "student.html";

            return;

        }


        timeLeft =
            Number(
                selectedQuiz.duration
            );


        timerElement.textContent =
            formatTime(timeLeft);


        if (quizTitleElement) {

            quizTitleElement.textContent =
                selectedQuiz.title;

        }

    }
    catch (error) {

        console.error(
            "Quiz details error:",
            error
        );

    }

}


// ================================
// GET QUESTIONS
// ================================

async function getQuestions() {

    try {

        const response =
            await fetch(
                `/api/questions?quiz_id=${selectedQuizId}`
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load questions."
            );

        }


        questions =
            await response.json();


        if (
            !Array.isArray(questions) ||
            questions.length === 0
        ) {

            questionElement.textContent =
                "No questions available.";

            return;

        }


        // Create answer storage

        selectedAnswers =
            new Array(
                questions.length
            ).fill(null);


        createQuestionNavigation();

        loadQuestion(0);

        startTimer();

    }
    catch (error) {

        console.error(
            "Question loading error:",
            error
        );


        questionElement.textContent =
            "Unable to load quiz questions.";

    }

}


// ================================
// CREATE QUESTION NAVIGATION
// ================================

function createQuestionNavigation() {

    navigationElement.innerHTML =
        "";


    questions.forEach(
        function (question, index) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "question-number-btn";


            button.textContent =
                index + 1;


            button.onclick =
                function () {

                    goToQuestion(index);

                };


            navigationElement.appendChild(
                button
            );

        }
    );


    updateQuestionNavigation();

}


// ================================
// UPDATE NAVIGATION
// ================================

function updateQuestionNavigation() {

    const buttons =
        document.querySelectorAll(
            ".question-number-btn"
        );


    buttons.forEach(
        function (button, index) {

            button.classList.remove(
                "current"
            );

            button.classList.remove(
                "answered"
            );


            if (
                index ===
                currentQuestion
            ) {

                button.classList.add(
                    "current"
                );

            }


            if (
                selectedAnswers[index] !==
                null
            ) {

                button.classList.add(
                    "answered"
                );

            }

        }
    );

}


// ================================
// LOAD QUESTION
// ================================

function loadQuestion(index) {

    if (
        index < 0 ||
        index >= questions.length
    ) {

        return;

    }


    currentQuestion =
        index;


    const question =
        questions[currentQuestion];


    questionElement.textContent =
        question.question;


    questionNumberElement.textContent =
        `Question ${currentQuestion + 1} of ${questions.length}`;


    optionsElement.innerHTML =
        "";


    question.options.forEach(
        function (option) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "option-btn";


            button.textContent =
                option;


            button.onclick =
                function () {

                    selectAnswer(
                        option
                    );

                };


            if (
                selectedAnswers[currentQuestion] ===
                option
            ) {

                button.classList.add(
                    "selected"
                );

            }


            optionsElement.appendChild(
                button
            );

        }
    );


    updateNavigationButtons();

    updateQuestionNavigation();

}


// ================================
// SELECT ANSWER
// ================================

function selectAnswer(
    selectedAnswer
) {

    if (quizFinished) {

        return;

    }


    selectedAnswers[currentQuestion] =
        selectedAnswer;


    const buttons =
        document.querySelectorAll(
            ".option-btn"
        );


    buttons.forEach(
        function (button) {

            button.classList.remove(
                "selected"
            );


            if (
                button.textContent ===
                selectedAnswer
            ) {

                button.classList.add(
                    "selected"
                );

            }

        }
    );


    updateQuestionNavigation();

}


// ================================
// PREVIOUS QUESTION
// ================================

function previousQuestion() {

    if (quizFinished) {

        return;

    }


    if (currentQuestion > 0) {

        loadQuestion(
            currentQuestion - 1
        );

    }

}


// ================================
// NEXT QUESTION
// ================================

function nextQuestion() {

    if (quizFinished) {

        return;

    }


    if (
        currentQuestion <
        questions.length - 1
    ) {

        loadQuestion(
            currentQuestion + 1
        );

    }
    else {

        showPreview();

    }

}


// ================================
// GO TO QUESTION
// ================================

function goToQuestion(index) {

    if (quizFinished) {

        return;

    }


    loadQuestion(index);

}


// ================================
// UPDATE PREVIOUS / NEXT
// ================================

function updateNavigationButtons() {

    previousButton.disabled =
        currentQuestion === 0;


    if (
        currentQuestion ===
        questions.length - 1
    ) {

        nextButton.textContent =
            "Review Test →";

    }
    else {

        nextButton.textContent =
            "Next →";

    }

}


// ================================
// TIMER
// ================================

function startTimer() {

    clearInterval(timer);


    timer =
        setInterval(
            function () {

                if (quizFinished) {

                    clearInterval(timer);

                    return;

                }


                timeLeft--;


                timerElement.textContent =
                    formatTime(timeLeft);


                if (timeLeft <= 30) {

                    timerElement.classList.add(
                        "warning"
                    );

                }


                if (timeLeft <= 10) {

                    timerElement.classList.add(
                        "danger"
                    );

                }


                if (timeLeft <= 0) {

                    clearInterval(timer);

                    alert(
                        "Time is over. Your test will be submitted."
                    );

                    finishQuiz();

                }

            },
            1000
        );

}


// ================================
// FORMAT TIME
// ================================

function formatTime(seconds) {

    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    return `Time: ${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

}


// ================================
// PREVIEW
// ================================

function showPreview() {

    if (quizFinished) {

        return;

    }


    const answeredCount =
        selectedAnswers.filter(
            function (answer) {

                return answer !== null;

            }
        ).length;


    const unansweredCount =
        questions.length -
        answeredCount;


    previewSummary.innerHTML = `

        <div class="summary-card">

            <span>
                Total Questions
            </span>

            <strong>
                ${questions.length}
            </strong>

        </div>


        <div class="summary-card answered-summary">

            <span>
                Answered
            </span>

            <strong>
                ${answeredCount}
            </strong>

        </div>


        <div class="summary-card unanswered-summary">

            <span>
                Unanswered
            </span>

            <strong>
                ${unansweredCount}
            </strong>

        </div>

    `;


    previewQuestions.innerHTML =
        "";


    questions.forEach(
        function (question, index) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "preview-question-item";


            const status =
                selectedAnswers[index] !== null
                    ? "Answered"
                    : "Not Answered";


            const statusClass =
                selectedAnswers[index] !== null
                    ? "status-answered"
                    : "status-unanswered";


            item.innerHTML = `

                <div>

                    <strong>
                        Question ${index + 1}
                    </strong>

                    <p>
                        ${escapeHtml(
                            question.question
                        )}
                    </p>

                </div>


                <div class="${statusClass}">

                    ${status}

                </div>

            `;


            item.onclick =
                function () {

                    closePreview();

                    loadQuestion(index);

                };


            previewQuestions.appendChild(
                item
            );

        }
    );


    previewModal.classList.add(
        "show"
    );

}


// ================================
// CLOSE PREVIEW
// ================================

function closePreview() {

    previewModal.classList.remove(
        "show"
    );

}


// ================================
// SUBMIT FROM PREVIEW
// ================================

function submitFromPreview() {

    const unansweredCount =
        selectedAnswers.filter(
            function (answer) {

                return answer === null;

            }
        ).length;


    if (unansweredCount > 0) {

        const confirmSubmit =
            confirm(
                `You have ${unansweredCount} unanswered question(s).\n\nAre you sure you want to submit the test?`
            );


        if (!confirmSubmit) {

            return;

        }

    }
    else {

        const confirmSubmit =
            confirm(
                "All questions are answered.\n\nAre you sure you want to submit the test?"
            );


        if (!confirmSubmit) {

            return;

        }

    }


    closePreview();

    calculateScore();

    finishQuiz();

}


// ================================
// CALCULATE SCORE
// ================================

function calculateScore() {

    score = 0;


    questions.forEach(
        function (question, index) {

            if (
                selectedAnswers[index] ===
                question.answer
            ) {

                score++;

            }

        }
    );

}


// ================================
// END TEST
// ================================

function endTest() {

    if (quizFinished) {

        return;

    }


    const answeredCount =
        selectedAnswers.filter(
            function (answer) {

                return answer !== null;

            }
        ).length;


    const confirmEnd =
        confirm(
            `You have answered ${answeredCount} of ${questions.length} questions.\n\nAre you sure you want to end the test?`
        );


    if (!confirmEnd) {

        return;

    }


    calculateScore();

    finishQuiz();

}


// ================================
// SAVE RESULT
// ================================

async function saveResult() {

    try {

        const response =
            await fetch(
                "/api/results",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        student_id:
                            user.id,

                        quiz_id:
                            selectedQuizId,

                        score:
                            score,

                        total_questions:
                            questions.length

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "Result save failed:",
                data
            );

            return false;

        }


        return true;

    }
    catch (error) {

        console.error(
            "Result save error:",
            error
        );

        return false;

    }

}


// ================================
// FINISH QUIZ
// ================================

async function finishQuiz() {

    if (quizFinished) {

        return;

    }


    quizFinished =
        true;


    clearInterval(timer);


    previousButton.disabled =
        true;


    nextButton.disabled =
        true;


    endButton.disabled =
        true;


    previewButton.disabled =
        true;


    await saveResult();


    const quizResult = {

        score:
            score,

        total_questions:
            questions.length

    };


    localStorage.setItem(
        "quizResult",
        JSON.stringify(
            quizResult
        )
    );


    localStorage.setItem(
        "quizScore",
        score
    );


    localStorage.setItem(
        "totalQuestions",
        questions.length
    );


    window.location.href =
        "result.html";

}


// ================================
// ESCAPE HTML
// ================================

function escapeHtml(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


// ================================
// CLOSE MODAL BY CLICKING OUTSIDE
// ================================

previewModal.addEventListener(
    "click",
    function (event) {

        if (
            event.target ===
            previewModal
        ) {

            closePreview();

        }

    }
);


// ================================
// START
// ================================

async function startQuizPage() {

    await getQuizDetails();

    await getQuestions();

}


startQuizPage();