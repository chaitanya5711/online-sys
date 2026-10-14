// =====================================================================
// Create the first teacher account (prints SQL, does not touch the DB)
// =====================================================================
// Usage (from the project folder):
//   node scripts/create-teacher.js
//
// It asks for a name, email and password, hashes the password with the
// SAME scrypt format the login code in server.js uses
// ("scrypt$<salt>$<hash>"), and prints one INSERT statement.
// Run that statement against your database. The plain password is never
// printed or saved anywhere.
// =====================================================================

const crypto = require("crypto");
const readline = require("readline");

// Must match hashPassword() in server.js.
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
    return `scrypt$${salt}$${hash}`;
}

function sqlString(value) {
    return "'" + String(value).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

function ask(question, { hidden = false } = {}) {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        if (hidden) {
            // Hide typed characters.
            rl._writeToOutput = text => {
                if (text.startsWith(question)) rl.output.write(question);
            };
        }

        rl.question(question, answer => {
            rl.close();
            if (hidden) process.stdout.write("\n");
            resolve(answer);
        });
    });
}

async function main() {
    const name = (await ask("Teacher name: ")).trim();
    const email = (await ask("Teacher email: ")).trim().toLowerCase();
    const password = await ask("Password (min 8 characters): ", { hidden: true });
    const confirm = await ask("Confirm password: ", { hidden: true });

    if (!name || !email) {
        console.error("Name and email are required.");
        process.exit(1);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.error("Please enter a valid email address.");
        process.exit(1);
    }

    if (password.length < 8) {
        console.error("Password must be at least 8 characters.");
        process.exit(1);
    }

    if (password !== confirm) {
        console.error("Passwords do not match.");
        process.exit(1);
    }

    const sql =
        "INSERT INTO users (name, email, password, role) VALUES (" +
        [sqlString(name), sqlString(email), sqlString(hashPassword(password)), "'teacher'"].join(", ") +
        ");";

    console.log("\nRun this SQL once against your database:\n");
    console.log(sql);
    console.log();
}

main();
