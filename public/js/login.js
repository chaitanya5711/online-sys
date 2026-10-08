let selectedRole = "";


// =========================
// Show Login Type
// =========================

function showLogin(role) {

    selectedRole = role;

    const title = document.getElementById("login-title");

    if (role === "teacher") {

        title.textContent = "Teacher Login";

    } else {

        title.textContent = "Student Login";

    }

}


// =========================
// Login
// =========================

async function login() {

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value.trim();

    const message =
        document.getElementById("login-message");


    if (!selectedRole) {

        message.textContent =
            "Please select Teacher or Student.";

        return;
    }


    if (!email || !password) {

        message.textContent =
            "Please enter email and password.";

        return;
    }


    try {

        const response = await fetch(
            `/api/${selectedRole}/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            message.textContent = data.message;

            return;
        }


        if (selectedRole === "teacher") {

            localStorage.setItem(
                "user",
                JSON.stringify(data.teacher)
            );

            window.location.href =
                "teacher.html";

        } else {

            localStorage.setItem(
                "user",
                JSON.stringify(data.student)
            );

            window.location.href =
                "student.html";

        }


    } catch (error) {

        console.error("Login error:", error);

        message.textContent =
            "Unable to connect to server.";

    }

}