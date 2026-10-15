const userData = localStorage.getItem("user");

if (!userData) {
    window.location.href = "login.html";
}

const user = JSON.parse(userData);

if (user.role !== "teacher") {
    window.location.href = "login.html";
}


// =========================
// Display Teacher Name
// =========================

document.getElementById("teacher-name").textContent =
    `Welcome, ${user.name}`;


// =========================
// Logout
// =========================

function logout() {

    localStorage.removeItem("user");
    localStorage.removeItem("selectedQuizId");
    localStorage.removeItem("teacherToken");

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


        const data =
            await response.json();


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


    // Check quiz

    if (!quizId) {

        message.textContent =
            "Please select a quiz.";

        return;
    }


    // Check file

    if (!file) {

        message.textContent =
            "Please select an Excel file.";

        return;
    }


    // Check file extension

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

        console.log(
            "Uploading file:",
            file.name
        );

        console.log(
            "Selected Quiz ID:",
            quizId
        );


        const response =
            await fetch(
                "/api/questions/upload",
                {
                    method: "POST",

                    body: formData
                }
            );


        console.log(
            "Upload response status:",
            response.status
        );


        const data =
            await response.json();


        console.log(
            "Upload response:",
            data
        );


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


    } catch (error) {

        console.error(
            "Excel upload error:",
            error
        );


        // Show the actual browser error

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


        const allQuizzes =
            await response.json();


        // Hide deleted (inactive) quizzes from the teacher's list
        // and from the Excel upload dropdown.
        const quizzes =
            Array.isArray(allQuizzes)
                ? allQuizzes.filter(
                    quiz => Number(quiz.is_active) !== 0
                )
                : [];


        console.log(
            "Quizzes received:",
            quizzes
        );


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


        // =========================
        // Quiz Dropdown
        // =========================

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


        // =========================
        // Quiz List
        // =========================

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


                card.appendChild(
                    title
                );

                card.appendChild(
                    description
                );

                card.appendChild(
                    duration
                );


                // Delete button
                const actions =
                    document.createElement(
                        "div"
                    );

                actions.className =
                    "quiz-item-actions";


                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.type = "button";

                deleteButton.className =
                    "danger-btn";

                deleteButton.textContent =
                    "Delete";


                deleteButton.addEventListener(
                    "click",
                    function () {
                        deleteQuiz(
                            quiz.id,
                            quiz.title,
                            deleteButton
                        );
                    }
                );


                actions.appendChild(
                    deleteButton
                );

                card.appendChild(
                    actions
                );


                quizList.appendChild(
                    card
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
// Delete Quiz
// =========================

async function deleteQuiz(quizId, quizTitle, button) {

    const confirmed =
        window.confirm(
            `Are you sure you want to delete "${quizTitle}"?`
        );

    if (!confirmed) return;


    button.disabled = true;
    button.textContent = "Deleting...";


    try {

        const token =
            localStorage.getItem("teacherToken");


        const response =
            await fetch(
                `/api/quizzes/${encodeURIComponent(quizId)}`,
                {
                    method: "DELETE",

                    headers: {
                        Authorization: `Bearer ${token || ""}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Failed to delete quiz."
            );

            // Session missing or expired: send teacher to login.
            if (response.status === 401) {
                logout();
                return;
            }

            button.disabled = false;
            button.textContent = "Delete";
            return;
        }


        alert(
            data.message ||
            "Quiz deleted successfully."
        );


        // Refresh the quiz list and upload dropdown.
        await loadQuizzes();

    } catch (error) {

        console.error(
            "Delete quiz error:",
            error
        );

        alert(
            "Unable to connect to the server."
        );

        button.disabled = false;
        button.textContent = "Delete";
    }
}


// =========================
// Load Dashboard
// =========================

loadQuizzes();
