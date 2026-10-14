
"use strict";

const userData = localStorage.getItem("user");

if (!userData) {
    window.location.href = "login.html";
} else {
    let user;

    try {
        user = JSON.parse(userData);
    } catch {
        localStorage.removeItem("user");
        window.location.href = "login.html";
    }

    if (user) initializeDashboard(user);
}

function initializeDashboard(user) {
    const studentName = document.getElementById("student-name");
    const quizList = document.getElementById("quiz-list");
    const historyContent = document.getElementById("history-content");
    const analyticsContent = document.getElementById("analytics-content");
    const leaderboardContent = document.getElementById("leaderboard-content");
    const leaderboardSelect = document.getElementById("leaderboard-quiz-select");

    const panelButtons = document.querySelectorAll("[data-panel]");
    const panels = document.querySelectorAll(".student-feature-panel");

    const historyCache = { data: null };
    const analyticsCache = { data: null };
    const leaderboardCache = new Map();

    if (studentName) {
        studentName.textContent = `Welcome, ${user.name || "Student"}`;
    }

    // -----------------------------
    // Feature panels
    // -----------------------------

    function openPanel(panelId) {
        const target = document.getElementById(panelId);
        if (!target) return;

        const wasOpen = !target.hidden;

        panels.forEach(panel => {
            panel.hidden = true;
        });

        panelButtons.forEach(button => {
            button.setAttribute("aria-expanded", "false");
            button.classList.remove("is-selected");
        });

        if (wasOpen) return;

        target.hidden = false;

        const trigger = document.querySelector(`[data-panel="${panelId}"]`);
        if (trigger) {
            trigger.setAttribute("aria-expanded", "true");
            trigger.classList.add("is-selected");
        }

        if (panelId === "history-panel") loadHistory();
        if (panelId === "analytics-panel") loadAnalytics();
        if (panelId === "leaderboard-panel") loadLeaderboard(leaderboardSelect.value);

        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    panelButtons.forEach(button => {
        button.addEventListener("click", () => openPanel(button.dataset.panel));
    });

    document.querySelectorAll("[data-close-panel]").forEach(button => {
        button.addEventListener("click", () => {
            const panel = button.closest(".student-feature-panel");
            if (!panel) return;

            panel.hidden = true;

            const trigger = document.querySelector(`[data-panel="${panel.id}"]`);
            if (trigger) {
                trigger.setAttribute("aria-expanded", "false");
                trigger.classList.remove("is-selected");
            }
        });
    });

    // -----------------------------
    // Safe API helper
    // -----------------------------

    async function apiGet(url) {
        const response = await fetch(url);
        let data;

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.message || `Request failed (${response.status})`);
        }

        return data;
    }

    // -----------------------------
    // Load available quizzes
    // -----------------------------

    async function loadQuizzes() {
        try {
            const quizzes = await apiGet("/api/quizzes");

            quizList.innerHTML = "";

            if (!Array.isArray(quizzes) || quizzes.length === 0) {
                quizList.innerHTML = emptyState(
                    "No quizzes available",
                    "Your teacher has not published any quizzes yet."
                );
                return;
            }

            quizzes.forEach(quiz => {
                const active = Number(quiz.is_active) === 1;
                const availability = quiz.availability || "open";
                const canStart = active && availability === "open";

                let status = "Available";
                let buttonText = "Start Quiz →";
                let scheduleText = "";

                if (!active) {
                    status = "Unavailable";
                    buttonText = "Unavailable";
                } else if (availability === "upcoming") {
                    status = "Upcoming";
                    buttonText = "Not open yet";
                    scheduleText = `Opens ${formatDateTime(quiz.start_time)}`;
                } else if (availability === "closed") {
                    status = "Closed";
                    buttonText = "Quiz closed";
                    scheduleText = quiz.end_time
                        ? `Closed ${formatDateTime(quiz.end_time)}`
                        : "";
                } else if (quiz.end_time) {
                    scheduleText = `Closes ${formatDateTime(quiz.end_time)}`;
                }

                const card = document.createElement("article");
                card.className = "quiz-card student-available-quiz";

                card.innerHTML = `
                    <div class="quiz-card-content">
                        <div class="quiz-card-top">
                            <span class="quiz-status ${canStart ? "active" : "inactive"}">
                                ${escapeHTML(status)}
                            </span>
                        </div>
                        <h3>${escapeHTML(quiz.title || "Untitled quiz")}</h3>
                        <p class="quiz-description">
                            ${escapeHTML(quiz.description || "No description available.")}
                        </p>
                        <div class="quiz-info">
                            <span>⏱ ${formatDuration(Number(quiz.duration || 0))}</span>
                            <span>📝 Quiz</span>
                        </div>
                        ${scheduleText
                            ? `<p class="quiz-schedule">📅 ${escapeHTML(scheduleText)}</p>`
                            : ""}
                    </div>
                    <div class="quiz-card-footer">
                        <button class="start-quiz-btn" ${canStart ? "" : "disabled"}>
                            ${escapeHTML(buttonText)}
                        </button>
                    </div>
                `;

                card.querySelector("button").addEventListener("click", () => {
                    if (canStart) startQuiz(quiz.id);
                });

                quizList.appendChild(card);
            });

            // Reuse quiz list for the leaderboard selector.
            const currentSelection = leaderboardSelect.value;

            leaderboardSelect.innerHTML = '<option value="">Select a quiz</option>';

            quizzes.forEach(quiz => {
                const option = document.createElement("option");
                option.value = quiz.id;
                option.textContent = quiz.title || `Quiz ${quiz.id}`;
                leaderboardSelect.appendChild(option);
            });

            if (quizzes.some(quiz => String(quiz.id) === currentSelection)) {
                leaderboardSelect.value = currentSelection;
            }
        } catch (error) {
            console.error("Quiz loading error:", error);
            quizList.innerHTML = errorState(
                "Unable to load quizzes",
                error.message || "Please refresh and try again."
            );
            leaderboardSelect.innerHTML = '<option value="">Unable to load quizzes</option>';
        }
    }

    // -----------------------------
    // Quiz history
    // -----------------------------

    async function getHistory(forceRefresh = false) {
        if (historyCache.data && !forceRefresh) return historyCache.data;

        const data = await apiGet(`/api/history/${encodeURIComponent(user.id)}`);
        historyCache.data = Array.isArray(data) ? data : [];
        return historyCache.data;
    }

    async function loadHistory(forceRefresh = false) {
        historyContent.innerHTML = loadingState("Loading your quiz history...");

        try {
            const attempts = await getHistory(forceRefresh);

            if (!attempts.length) {
                historyContent.innerHTML = emptyState(
                    "No quiz history yet",
                    "Complete your first quiz and your results will appear here."
                );
                return;
            }

            historyContent.innerHTML = `
                <div class="history-summary">
                    <span><strong>${attempts.length}</strong> saved attempt${attempts.length === 1 ? "" : "s"}</span>
                    <button class="small-outline-button" id="refresh-history">Refresh</button>
                </div>
                <div class="history-card-list">
                    ${attempts.map(item => {
                        const score = Number(item.score || 0);
                        const total = Number(item.total_questions || 0);
                        const percentage = Number(
                            item.percentage ??
                            (total > 0 ? score * 100 / total : 0)
                        );
                        const passed = percentage >= 40;

                        return `
                            <article class="history-attempt-card">
                                <div class="history-attempt-main">
                                    <div class="history-attempt-title-row">
                                        <h3>${escapeHTML(item.quiz_title || "Quiz")}</h3>
                                        <span class="result-pill ${passed ? "passed" : "needs-work"}">
                                            ${passed ? "Passed" : "Keep practising"}
                                        </span>
                                    </div>
                                    <p class="history-attempt-date">
                                        ${escapeHTML(formatDateTime(item.submitted_at))}
                                    </p>
                                    <div class="history-score-line">
                                        <strong>${score} / ${total}</strong>
                                        <span>${percentage.toFixed(1)}%</span>
                                    </div>
                                    <div class="score-progress">
                                        <span style="width:${clampPercentage(percentage)}%"></span>
                                    </div>
                                    <p class="history-duration">
                                        Time taken: ${formatDuration(Number(item.duration_seconds || 0))}
                                    </p>
                                </div>
                                ${Number(item.show_answers) === 1 && item.result_id
                                    ? `<a class="start-quiz-btn link-btn"
                                          href="review.html?result=${encodeURIComponent(item.result_id)}">
                                          Review answers
                                       </a>`
                                    : ""}
                            </article>
                        `;
                    }).join("")}
                </div>
            `;

            document.getElementById("refresh-history")
                ?.addEventListener("click", () => {
                    historyCache.data = null;
                    analyticsCache.data = null;
                    loadHistory(true);
                });
        } catch (error) {
            console.error("History loading error:", error);
            historyContent.innerHTML = errorState(
                "Unable to load quiz history",
                error.message || "Please try again later."
            );
        }
    }

    // -----------------------------
    // Result analytics
    // -----------------------------

    async function loadAnalytics() {
        analyticsContent.innerHTML = loadingState("Calculating your performance...");

        try {
            const attempts = await getHistory();
            const stats = await apiGet(`/api/analytics/${encodeURIComponent(user.id)}`);

            const totalAttempts = Number(stats.attempts || 0);
            const totalCorrect = Number(stats.total_correct || 0);
            const totalQuestions = Number(stats.total_questions || 0);
            const overall = Number(stats.overall_percentage || 0);
            const average = Number(stats.average_attempt_percentage || 0);
            const longest = Number(stats.longest_attempt_seconds || 0);

            const best = attempts.length
                ? Math.max(...attempts.map(item => Number(item.percentage || 0)))
                : 0;

            const trend = attempts
                .slice()
                .reverse()
                .slice(-8);

            analyticsContent.innerHTML = `
                <div class="analytics-stat-grid">
                    ${statCard("Quizzes completed", totalAttempts, "Saved attempts")}
                    ${statCard("Overall accuracy", `${overall.toFixed(1)}%`, "Correct answers across all attempts")}
                    ${statCard("Average attempt", `${average.toFixed(1)}%`, "Average percentage per attempt")}
                    ${statCard("Best result", `${best.toFixed(1)}%`, "Highest saved quiz percentage")}
                    ${statCard("Correct answers", `${totalCorrect} / ${totalQuestions}`, "Across all attempts")}
                    ${statCard("Longest attempt", formatDuration(longest), "Longest time taken")}
                </div>

                <div class="analytics-detail-grid">
                    <article class="analytics-card">
                        <div class="analytics-card-heading">
                            <h3>Recent performance</h3>
                            <p>Your latest ${trend.length} completed attempts, in chronological order.</p>
                        </div>
                        ${trend.length
                            ? `<div class="trend-list">
                                ${trend.map((item, index) => {
                                    const percentage = Number(
                                        item.percentage ??
                                        (Number(item.total_questions) > 0
                                            ? Number(item.score) * 100 / Number(item.total_questions)
                                            : 0)
                                    );

                                    return `
                                        <div class="trend-item">
                                            <div class="trend-label">
                                                <span>${escapeHTML(item.quiz_title || "Quiz")}</span>
                                                <strong>${percentage.toFixed(1)}%</strong>
                                            </div>
                                            <div class="score-progress">
                                                <span style="width:${clampPercentage(percentage)}%"></span>
                                            </div>
                                        </div>
                                    `;
                                }).join("")}
                               </div>`
                            : emptyState("No performance data yet", "Take a quiz to start building your progress history.")}
                    </article>

                    <article class="analytics-card">
                        <div class="analytics-card-heading">
                            <h3>Performance insights</h3>
                            <p>Quick takeaways from your saved results.</p>
                        </div>
                        <div class="insight-list">
                            <div class="insight-item">
                                <span class="insight-icon">🎯</span>
                                <div><strong>Overall accuracy</strong><p>${overall >= 80
                                    ? "Excellent work. Keep maintaining this consistency."
                                    : overall >= 60
                                        ? "Good progress. Review missed answers to improve further."
                                        : totalAttempts
                                            ? "Focus on reviewing mistakes and revisiting the topics you find difficult."
                                            : "Your first quiz will help establish a performance baseline."}</p></div>
                            </div>
                            <div class="insight-item">
                                <span class="insight-icon">📊</span>
                                <div><strong>Attempt consistency</strong><p>${totalAttempts
                                    ? `Your average attempt score is ${average.toFixed(1)}%.`
                                    : "Complete a quiz to see your average score."}</p></div>
                            </div>
                            <div class="insight-item">
                                <span class="insight-icon">🚀</span>
                                <div><strong>Next goal</strong><p>${totalAttempts
                                    ? `Try to reach ${Math.min(100, Math.ceil(Math.max(overall, best) / 10) * 10 + 10)}% on your next attempt.`
                                    : "Start with an available quiz and build your learning streak."}</p></div>
                            </div>
                        </div>
                    </article>
                </div>
                <p class="analytics-note">Analytics are calculated from results saved in your account.</p>
            `;
        } catch (error) {
            console.error("Analytics loading error:", error);
            analyticsContent.innerHTML = errorState(
                "Unable to load analytics",
                error.message || "Please try again later."
            );
        }
    }

    // -----------------------------
    // Leaderboard
    // -----------------------------

    leaderboardSelect.addEventListener("change", () => {
        loadLeaderboard(leaderboardSelect.value);
    });

    async function loadLeaderboard(quizId) {
        if (!quizId) {
            leaderboardContent.innerHTML = loadingState("Choose a quiz above to see the rankings.");
            return;
        }

        leaderboardContent.innerHTML = loadingState("Loading leaderboard...");

        try {
            let rankings = leaderboardCache.get(String(quizId));

            if (!rankings) {
                const data = await apiGet(`/api/leaderboard/${encodeURIComponent(quizId)}`);
                rankings = Array.isArray(data)
                    ? data
                    : (data.leaderboard || data.results || []);
                leaderboardCache.set(String(quizId), rankings);
            }

            if (!rankings.length) {
                leaderboardContent.innerHTML = emptyState(
                    "No rankings yet",
                    "Rankings will appear after students complete this quiz."
                );
                return;
            }

            const ranked = rankings.map(item => ({
                ...item,
                percentage: Number(item.percentage || 0),
                best_score: Number(item.best_score || 0),
                total_questions: Number(item.total_questions || 0)
            }));

            const currentStudent = ranked.find(
                item => String(item.student_id) === String(user.id)
            );
            const currentRank = currentStudent
                ? ranked.indexOf(currentStudent) + 1
                : null;

            leaderboardContent.innerHTML = `
                ${currentStudent
                    ? `<div class="leaderboard-me-card">
                        <div>
                            <span class="leaderboard-me-label">Your rank</span>
                            <strong>#${currentRank}</strong>
                        </div>
                        <div>
                            <span class="leaderboard-me-label">Your best score</span>
                            <strong>${currentStudent.best_score} / ${currentStudent.total_questions}</strong>
                        </div>
                        <div>
                            <span class="leaderboard-me-label">Percentage</span>
                            <strong>${currentStudent.percentage.toFixed(1)}%</strong>
                        </div>
                       </div>`
                    : `<div class="leaderboard-info-note">You have not appeared on this leaderboard yet. Complete this quiz to be ranked.</div>`
                }

                <div class="table-container leaderboard-table-wrap">
                    <table class="student-leaderboard-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Student</th>
                                <th>Best score</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ranked.map((student, index) => {
                                const isMe = String(student.student_id) === String(user.id);
                                const rank = index + 1;

                                return `
                                    <tr class="${isMe ? "current-student-row" : ""}">
                                        <td>
                                            <span class="rank-number ${rank <= 3 ? `rank-top-${rank}` : ""}">
                                                ${rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>${escapeHTML(student.student_name || "Student")}</strong>
                                            ${isMe ? '<span class="you-badge">You</span>' : ""}
                                        </td>
                                        <td>${student.best_score} / ${student.total_questions}</td>
                                        <td>
                                            <div class="leaderboard-percentage">
                                                <span>${student.percentage.toFixed(1)}%</span>
                                                <div class="score-progress">
                                                    <span style="width:${clampPercentage(student.percentage)}%"></span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
                <p class="analytics-note">Rankings use each student's best attempt. Ties are ordered by percentage, then student name.</p>
            `;
        } catch (error) {
            console.error("Leaderboard loading error:", error);
            leaderboardContent.innerHTML = errorState(
                "Unable to load leaderboard",
                error.message || "Please try again later."
            );
        }
    }

    // -----------------------------
    // Shared UI helpers
    // -----------------------------

    function statCard(label, value, description) {
        return `
            <article class="analytics-stat-card">
                <span class="analytics-stat-label">${escapeHTML(label)}</span>
                <strong class="analytics-stat-value">${escapeHTML(value)}</strong>
                <span class="analytics-stat-description">${escapeHTML(description)}</span>
            </article>
        `;
    }

    function emptyState(title, description) {
        return `
            <div class="empty-state">
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(description)}</p>
            </div>
        `;
    }

    function errorState(title, description) {
        return `
            <div class="student-error-state">
                <strong>${escapeHTML(title)}</strong>
                <p>${escapeHTML(description)}</p>
            </div>
        `;
    }

    function loadingState(message) {
        return `<p class="loading-message">${escapeHTML(message)}</p>`;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function clampPercentage(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function formatDateTime(value) {
        if (!value) return "Date unavailable";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short"
            });
    }

    function formatDuration(seconds) {
        const value = Math.max(0, Math.floor(Number(seconds) || 0));
        const minutes = Math.floor(value / 60);
        const remainingSeconds = value % 60;

        if (minutes === 0) return `${remainingSeconds}s`;
        if (remainingSeconds === 0) return `${minutes} min`;
        return `${minutes}m ${remainingSeconds}s`;
    }

    // -----------------------------
    // Existing navigation actions
    // -----------------------------

    window.startQuiz = function (quizId) {
        localStorage.setItem("selectedQuizId", quizId);
        window.location.href = "quiz.html";
    };

    window.goToHome = function () {
        if (confirm("Are you sure you want to leave the student section?")) {
            window.location.href = "../index.html";
        }
    };

    window.logout = function () {
        if (!confirm("Are you sure you want to logout?")) return;

        localStorage.removeItem("user");
        localStorage.removeItem("selectedQuizId");
        localStorage.removeItem("quizResult");
        localStorage.removeItem("quizScore");
        localStorage.removeItem("totalQuestions");
        localStorage.removeItem("quizResultId");

        window.location.href = "login.html";
    };

    loadQuizzes();
}
