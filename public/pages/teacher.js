const userData = localStorage.getItem("user");

if (!userData) {
    window.location.href = "login.html";
}

const user = JSON.parse(userData);

if (user.role !== "teacher") {
    window.location.href = "login.html";
}

document.getElementById("teacher-name").textContent =
    `Welcome, ${user.name}`;


// =========================
// Logout
// =========================

function logout() {

    localStorage.removeItem("user");
    localStorage.removeItem("selectedQuizId");

    window.location.href = "login.html";
}


// =========================
// Create Quiz
// =========================

async function createQuiz() {

    const title =
        document.getElementById("quiz-title").value.trim();

    const description =
        document.getElementById("quiz-description").value.trim();

    const duration =
        Number(
            document.getElementById("quiz-duration").value
        );

    const message =
        document.getElementById("create-message");


    if (!title) {

        message.textContent =
            "Please enter quiz title.";

        return;
    }


    if (!duration || duration < 10) {

        message.textContent =
            "Duration must be at least 10 seconds.";

        return;
    }


    try {

        const response = await fetch(
            "/api/quizzes",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    title: title,
                    description: description,
                    duration: duration,
                    created_by: user.id
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            message.textContent =
                data.message ||
                "Failed to create quiz.";

            return;
        }


        message.textContent =
            "Quiz created successfully!";


        document.getElementById(
            "quiz-title"
        ).value = "";


        document.getElementById(
            "quiz-description"
        ).value = "";


        document.getElementById(
            "quiz-duration"
        ).value = "";


        loadQuizzes();

    } catch (error) {

        console.error(
            "Create quiz error:",
            error
        );

        message.textContent =
            "Unable to connect to server.";
    }
}


// =========================
// Upload Excel
// =========================

async function uploadExcel() {

    const quizId =
        document.getElementById(
            "upload-quiz"
        ).value;


    const file =
        document.getElementById(
            "excel-file"
        ).files[0];


    const message =
        document.getElementById(
            "upload-message"
        );


    if (!quizId) {

        message.textContent =
            "Please select a quiz.";

        return;
    }


    if (!file) {

        message.textContent =
            "Please select an Excel file.";

        return;
    }


    const fileName =
        file.name.toLowerCase();


    if (
        !fileName.endsWith(".xlsx") &&
        !fileName.endsWith(".xls")
    ) {

        message.textContent =
            "Please select a valid Excel file.";

        return;
    }


    const formData =
        new FormData();


    formData.append(
        "excel",
        file
    );


    formData.append(
        "quiz_id",
        quizId
    );


    message.textContent =
        "Uploading questions...";


    try {

        const response =
            await fetch(
                "/api/questions/upload",
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            message.textContent =
                data.message ||
                "Excel upload failed.";

            return;
        }


        message.textContent =
            `${data.inserted} questions uploaded successfully!`;


        document.getElementById(
            "excel-file"
        ).value = "";


        loadQuizzes();

    } catch (error) {

        console.error(
            "Excel upload error:",
            error
        );

        message.textContent =
            "Upload error: " +
            error.message;
    }
}


// =========================
// Load Quizzes
// =========================

async function loadQuizzes() {

    const quizList =
        document.getElementById(
            "quiz-list"
        );


    const uploadQuiz =
        document.getElementById(
            "upload-quiz"
        );


    quizList.innerHTML =
        "<p>Loading quizzes...</p>";


    try {

        const response =
            await fetch(
                "/api/quizzes"
            );


        if (!response.ok) {

            throw new Error(
                "Server returned " +
                response.status
            );
        }


        const quizzes =
            await response.json();


        if (
            !Array.isArray(quizzes) ||
            quizzes.length === 0
        ) {

            quizList.innerHTML =
                "<p>No quizzes available.</p>";


            uploadQuiz.innerHTML = `
                <option value="">
                    No quizzes available
                </option>
            `;

            return;
        }


        uploadQuiz.innerHTML = `
            <option value="">
                Select Quiz
            </option>
        `;


        quizzes.forEach(
            function (quiz) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    quiz.id;


                option.textContent =
                    quiz.title;


                uploadQuiz.appendChild(
                    option
                );
            }
        );


        quizList.innerHTML = "";


        quizzes.forEach(
            function (quiz) {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "quiz-item";


                const title =
                    document.createElement(
                        "h3"
                    );


                title.textContent =
                    quiz.title;


                const description =
                    document.createElement(
                        "p"
                    );


                description.textContent =
                    quiz.description ||
                    "No description available.";


                const duration =
                    document.createElement(
                        "p"
                    );


                duration.textContent =
                    "Duration: " +
                    quiz.duration +
                    " seconds";


                const questionContainer =
                    document.createElement(
                        "div"
                    );


                questionContainer.className =
                    "question-list";


                questionContainer.innerHTML =
                    "<p>Loading questions...</p>";


                card.appendChild(title);

                card.appendChild(description);

                card.appendChild(duration);

                card.appendChild(questionContainer);


                quizList.appendChild(card);


                loadQuestions(
                    quiz.id,
                    questionContainer
                );
            }
        );

    } catch (error) {

        console.error(
            "Quiz loading error:",
            error
        );


        quizList.innerHTML =
            "<p>Unable to load quizzes.</p>";
    }
}


// =========================
// Load Questions
// =========================

async function loadQuestions(
    quizId,
    container
) {

    try {

        const response =
            await fetch(
                `/api/questions?quiz_id=${quizId}`
            );


        if (!response.ok) {

            throw new Error(
                "Failed to load questions"
            );
        }


        const questions =
            await response.json();


        container.innerHTML = "";


        if (
            !Array.isArray(questions) ||
            questions.length === 0
        ) {

            container.innerHTML =
                "<p>No questions uploaded yet.</p>";

            return;
        }


        const heading =
            document.createElement(
                "h4"
            );


        heading.textContent =
            `Questions (${questions.length})`;


        container.appendChild(
            heading
        );


        questions.forEach(
            function (question, index) {

                const questionCard =
                    document.createElement(
                        "div"
                    );


                questionCard.className =
                    "question-card";


                const questionText =
                    document.createElement(
                        "p"
                    );


                questionText.innerHTML =
                    `<strong>Q${index + 1}.</strong> ${question.question}`;


                const options =
                    document.createElement(
                        "div"
                    );


                options.innerHTML = `

                    <p>
                        <strong>A:</strong>
                        ${question.options[0] || ""}
                    </p>

                    <p>
                        <strong>B:</strong>
                        ${question.options[1] || ""}
                    </p>

                    <p>
                        <strong>C:</strong>
                        ${question.options[2] || ""}
                    </p>

                    <p>
                        <strong>D:</strong>
                        ${question.options[3] || ""}
                    </p>

                    <p>
                        <strong>Correct Answer:</strong>
                        ${question.answer || ""}
                    </p>

                `;


                const actions =
                    document.createElement(
                        "div"
                    );


                actions.className =
                    "question-actions";


                const editButton =
                    document.createElement(
                        "button"
                    );


                editButton.textContent =
                    "Edit";


                editButton.onclick =
                    function () {

                        editQuestion(
                            question.id
                        );
                    };


                const deleteButton =
                    document.createElement(
                        "button"
                    );


                deleteButton.textContent =
                    "Delete";


                deleteButton.onclick =
                    function () {

                        deleteQuestion(
                            question.id
                        );
                    };


                actions.appendChild(
                    editButton
                );


                actions.appendChild(
                    deleteButton
                );


                questionCard.appendChild(
                    questionText
                );


                questionCard.appendChild(
                    options
                );


                questionCard.appendChild(
                    actions
                );


                container.appendChild(
                    questionCard
                );
            }
        );

    } catch (error) {

        console.error(
            "Question loading error:",
            error
        );


        container.innerHTML =
            "<p>Unable to load questions.</p>";
    }
}


// =========================
// Edit Question
// =========================

async function editQuestion(
    questionId
) {

    try {

        const response =
            await fetch(
                `/api/questions?quiz_id=1`
            );


        const questions =
            await response.json();


        const question =
            questions.find(
                function (item) {

                    return item.id === questionId;
                }
            );


        if (!question) {

            alert(
                "Question not found."
            );

            return;
        }


        const newQuestion =
            prompt(
                "Enter the new question:",
                question.question
            );


        if (newQuestion === null) {
            return;
        }


        const newOption1 =
            prompt(
                "Enter Option A:",
                question.options[0]
            );


        if (newOption1 === null) {
            return;
        }


        const newOption2 =
            prompt(
                "Enter Option B:",
                question.options[1]
            );


        if (newOption2 === null) {
            return;
        }


        const newOption3 =
            prompt(
                "Enter Option C:",
                question.options[2]
            );


        if (newOption3 === null) {
            return;
        }


        const newOption4 =
            prompt(
                "Enter Option D:",
                question.options[3]
            );


        if (newOption4 === null) {
            return;
        }


        const newAnswer =
            prompt(
                "Enter the correct answer:",
                question.answer
            );


        if (newAnswer === null) {
            return;
        }


        const updateResponse =
            await fetch(
                `/api/questions/${questionId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        question:
                            newQuestion,

                        option1:
                            newOption1,

                        option2:
                            newOption2,

                        option3:
                            newOption3,

                        option4:
                            newOption4,

                        correct_answer:
                            newAnswer
                    })
                }
            );


        const data =
            await updateResponse.json();


        if (!updateResponse.ok) {

            alert(
                data.message ||
                "Failed to update question."
            );

            return;
        }


        alert(
            "Question updated successfully!"
        );


        loadQuizzes();

    } catch (error) {

        console.error(
            "Edit question error:",
            error
        );


        alert(
            "Unable to update question."
        );
    }
}


// =========================
// Delete Question
// =========================

async function deleteQuestion(
    questionId
) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this question?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/questions/${questionId}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Failed to delete question."
            );

            return;
        }


        alert(
            "Question deleted successfully!"
        );


        loadQuizzes();

    } catch (error) {

        console.error(
            "Delete question error:",
            error
        );


        alert(
            "Unable to delete question."
        );
    }
}


// =========================
// Start
// =========================

loadQuizzes();