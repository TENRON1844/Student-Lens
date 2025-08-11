const firebaseConfig = {
  apiKey: "AIzaSyAn6gP_ODz7Q02okhRAwD3gQbviLKI55ys",
  authDomain: "https://tenron1844.github.io/Student-Lens/",
  projectId: "student-lens",
  storageBucket: "student-lens.appspot.com",
  messagingSenderId: "508910313071",
  appId: "1:508910313071:web:0a64976ecfafa6dbadf79a",
  measurementId: "G-PJW9DT3WZ4"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

function showScreen(screen) {
  document.getElementById('auth-screen').style.display = (screen === 'auth') ? 'flex' : 'none';
  document.getElementById('main-screen').style.display = (screen === 'main') ? '' : 'none';
}

function googleSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return auth.signInWithPopup(provider);
}

document.getElementById('signUpBtn').onclick = function () {
  googleSignIn().catch(err => {
    document.getElementById('auth-message').innerText = err.message;
  });
};
document.getElementById('logInBtn').onclick = function () {
  googleSignIn().catch(err => {
    document.getElementById('auth-message').innerText = err.message;
  });
};

auth.onAuthStateChanged(user => {
  if (user) {
    showScreen('main');
  } else {
    showScreen('auth');
  }
});

window.logout = function() {
  auth.signOut();
};





