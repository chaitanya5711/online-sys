document.addEventListener("DOMContentLoaded", function () {

    const resultData = localStorage.getItem("quizResult");

    const scoreElement = document.getElementById("score");
    const resultMessageElement = document.getElementById("result-message");

    // Check if result exists
    if (!resultData) {

        if (scoreElement) {
            scoreElement.textContent = "Result not available";
        }

        if (resultMessageElement) {
            resultMessageElement.textContent = "Result not available";
        }

        return;
    }

    try {

        const result = JSON.parse(resultData);

        const score = Number(result.score);
        const totalQuestions = Number(result.total_questions);

        // Display score
        if (scoreElement) {
            scoreElement.textContent =
                `${score} / ${totalQuestions}`;
        }

        // Calculate percentage
        const percentage =
            totalQuestions > 0
                ? Math.round((score / totalQuestions) * 100)
                : 0;

        // Passing percentage
        const passingPercentage = 40;

        // Display result
        if (resultMessageElement) {

            if (percentage >= passingPercentage) {

                resultMessageElement.textContent =
                    `Percentage: ${percentage}% — PASS`;

                resultMessageElement.className = "pass";

            } else {

                resultMessageElement.textContent =
                    `Percentage: ${percentage}% — FAIL`;

                resultMessageElement.className = "fail";
            }
        }

    } catch (error) {

        console.error("Result parsing error:", error);

        if (scoreElement) {
            scoreElement.textContent = "Unable to load result";
        }

        if (resultMessageElement) {
            resultMessageElement.textContent = "Unable to load result";
        }
    }

});


// ================================
// BACK TO DASHBOARD
// ================================

function goToDashboard() {

    window.location.href = "student.html";

}
