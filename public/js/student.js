// ==========================================
// CHECK LOGIN
// ==========================================

const userData =
    localStorage.getItem("user");


if (!userData) {

    window.location.href =
        "login.html";

}


const user =
    JSON.parse(userData);


// ==========================================
// HTML ELEMENTS
// ==========================================

const studentName =
    document.getElementById(
        "student-name"
    );

const quizList =
    document.getElementById(
        "quiz-list"
    );


// ==========================================
// DISPLAY STUDENT NAME
// ==========================================

if (studentName) {

    studentName.textContent =
        `Welcome, ${user.name}`;

}


// ==========================================
// LOAD QUIZZES
// ==========================================

async function loadQuizzes() {

    try {

        const response =
            await fetch(
                "/api/quizzes"
            );


        if (!response.ok) {

            throw new Error(
                "Failed to load quizzes"
            );

        }


        const quizzes =
            await response.json();


        quizList.innerHTML =
            "";


        if (
            !Array.isArray(quizzes) ||
            quizzes.length === 0
        ) {

            quizList.innerHTML = `

                <div class="empty-state">

                    <h3>
                        No quizzes available
                    </h3>

                    <p>
                        There are currently no quizzes available.
                    </p>

                </div>

            `;

            return;

        }


        quizzes.forEach(
            function (quiz) {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "quiz-card";


                const duration =
                    formatDuration(
                        Number(
                            quiz.duration
                        )
                    );


                const status =
                    quiz.is_active
                        ? "Available"
                        : "Unavailable";


                const buttonDisabled =
                    !quiz.is_active
                        ? "disabled"
                        : "";


                card.innerHTML = `

                    <div class="quiz-card-content">

                        <div class="quiz-card-top">

                            <span class="quiz-status ${
                                quiz.is_active
                                    ? "active"
                                    : "inactive"
                            }">

                                ${status}

                            </span>

                        </div>


                        <h3>
                            ${escapeHtml(
                                quiz.title
                            )}
                        </h3>


                        <p class="quiz-description">

                            ${
                                quiz.description
                                    ? escapeHtml(
                                        quiz.description
                                    )
                                    : "No description available."
                            }

                        </p>


                        <div class="quiz-info">

                            <span>
                                ⏱ ${duration}
                            </span>

                            <span>
                                📝 Quiz
                            </span>

                        </div>

                    </div>


                    <div class="quiz-card-footer">

                        <button
                            class="start-quiz-btn"
                            ${buttonDisabled}
                            onclick="startQuiz(${quiz.id})"
                        >
                            ${
                                quiz.is_active
                                    ? "Start Quiz →"
                                    : "Unavailable"
                            }
                        </button>

                    </div>

                `;


                quizList.appendChild(
                    card
                );

            }
        );

    }
    catch (error) {

        console.error(
            "Quiz loading error:",
            error
        );


        quizList.innerHTML = `

            <div class="error-state">

                <h3>
                    Unable to load quizzes
                </h3>

                <p>
                    Please refresh the page and try again.
                </p>

            </div>

        `;

    }

}


// ==========================================
// START QUIZ
// ==========================================

function startQuiz(
    quizId
) {

    localStorage.setItem(
        "selectedQuizId",
        quizId
    );


    window.location.href =
        "quiz.html";

}


// ==========================================
// GO TO HOME
// ==========================================

function goToHome() {

    const confirmLeave =
        confirm(
            "Are you sure you want to leave the student section?"
        );


    if (!confirmLeave) {

        return;

    }


    window.location.href =
        "../index.html";

}


// ==========================================
// LOGOUT
// ==========================================

function logout() {

    const confirmLogout =
        confirm(
            "Are you sure you want to logout?"
        );


    if (!confirmLogout) {

        return;

    }


    localStorage.removeItem(
        "user"
    );

    localStorage.removeItem(
        "selectedQuizId"
    );

    localStorage.removeItem(
        "quizResult"
    );

    localStorage.removeItem(
        "quizScore"
    );

    localStorage.removeItem(
        "totalQuestions"
    );


    window.location.href =
        "login.html";

}


// ==========================================
// FORMAT DURATION
// ==========================================

function formatDuration(
    seconds
) {

    if (seconds < 60) {

        return `${seconds} seconds`;

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    if (
        remainingSeconds === 0
    ) {

        return `${minutes} minutes`;

    }


    return `${minutes}m ${remainingSeconds}s`;

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


// ==========================================
// LOAD
// ==========================================

loadQuizzes();