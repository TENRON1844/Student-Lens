const CLIENT_ID = "538948576836-1kk0cph50bg3e5ulupjhhjri6nm13snh.apps.googleusercontent.com";

function handleCredentialResponse(response) {
    const token = response.credential;
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log("Google payload:", payload);

    const existingUsers = JSON.parse(localStorage.getItem("users") || "[]");
    const isExisting = existingUsers.some(user => user.email === payload.email);

    if (window.authMode === "signup") {
        if (isExisting) {
            document.getElementById("auth-message").textContent = "Account already exists. Please log in.";
        } else {
            existingUsers.push({ email: payload.email, name: payload.name });
            localStorage.setItem("users", JSON.stringify(existingUsers));
            document.getElementById("auth-message").textContent = Welcome, ${payload.name}! Account created.;
            showMainScreen();
        }
    } else if (window.authMode === "login") {
        if (isExisting) {
            document.getElementById("auth-message").textContent = Welcome back, ${payload.name}!;
            showMainScreen();
        } else {
            document.getElementById("auth-message").textContent = "No account found. Please sign up first.";
        }
    }
}

function showMainScreen() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("main-screen").style.display = "block";
}

window.onload = function () {
    google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: "popup"
    });

    document.getElementById("signUpBtn").addEventListener("click", () => {
        window.authMode = "signup";
        google.accounts.id.prompt();
    });

    document.getElementById("logInBtn").addEventListener("click", () => {
        window.authMode = "login";
        google.accounts.id.prompt();
    });
};
