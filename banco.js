// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBIYh3dmxZ4zumE4EIZVYAzpTzM-Fx4uX0",
  authDomain: "foco-fdd6b.firebaseapp.com",
  projectId: "foco-fdd6b",
  storageBucket: "foco-fdd6b.firebasestorage.app",
  messagingSenderId: "1041791131210",
  appId: "1:1041791131210:web:b4423f7bd783d2866dd0b3",
  measurementId: "G-BY41NWHKPD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);