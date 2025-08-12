// Your Google OAuth 2.0 Web Client ID from Google Cloud Console
const CLIENT_ID = "http://538948576836-1kk0cph50bg3e5ulupjhhjri6nm13snh.apps.googleusercontent.com";

// Called when Google returns the credential
function handleCredentialResponse(response) {
    // This is the ID token (JWT)
    const token = response.credential;

    // Decode it for display
    const payload = JSON.parse(atob(token.split('.')[1]));

    console.log("Google payload:", payload);

    // Simulated account storage in localStorage
    const existingUsers = JSON.parse(localStorage.getItem("users") || "[]");

    // Check if user is new or returning
    const isExisting = existingUsers.some(user => user.email === payload.email);

    if (window.authMode === "signup") {
        if (isExisting) {
            document.getElementById("auth-message").textContent =
                "Account already exists. Please log in.";
        } else {
            existingUsers.push({ email: payload.email, name: payload.name });
            localStorage.setItem("users", JSON.stringify(existingUsers));
            document.getElementById("auth-message").textContent =
                Welcome, ${payload.name}! Account created.;
            showMainScreen();
        }
    } else if (window.authMode === "login") {
        if (isExisting) {
            document.getElementById("auth-message").textContent =
                Welcome back, ${payload.name}!;
            showMainScreen();
        } else {
            document.getElementById("auth-message").textContent =
                "No account found. Please sign up first.";
        }
    }
}

function showMainScreen() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("main-screen").style.display = "block";
}

// Initialize Google Sign-In
window.onload = function () {
    google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse
    });

    // Hook up buttons
    document.getElementById("signUpBtn").addEventListener("click", () => {
        window.authMode = "signup";
        google.accounts.id.prompt(); // or render the One Tap
    });

    document.getElementById("logInBtn").addEventListener("click", () => {
        window.authMode = "login";
        google.accounts.id.prompt();
    });
};
