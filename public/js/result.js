document.addEventListener(
    "DOMContentLoaded",
    function () {

        // ================================
        // GET RESULT
        // ================================

        const resultData =
            localStorage.getItem(
                "quizResult"
            );


        const scoreElement =
            document.getElementById(
                "score"
            );


        // ================================
        // CHECK RESULT
        // ================================

        if (!resultData) {

            if (scoreElement) {

                scoreElement.textContent =
                    "Result not available";

            }

            return;

        }


        try {

            const result =
                JSON.parse(
                    resultData
                );


            const score =
                Number(
                    result.score
                );


            const totalQuestions =
                Number(
                    result.total_questions
                );


            // ================================
            // DISPLAY SCORE
            // ================================

            if (scoreElement) {

                scoreElement.textContent =
                    `${score} / ${totalQuestions}`;

            }


        }
        catch (error) {

            console.error(
                "Result parsing error:",
                error
            );


            if (scoreElement) {

                scoreElement.textContent =
                    "Unable to load result";

            }

        }

    }
);


// ================================
// BACK TO DASHBOARD
// ================================

function goToDashboard() {

    window.location.href =
        "student.html";

}