// config/firebaseConfig.js
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
    apiKey: "AIzaSyABE1_rXs0M5IJHH9ONyWAIxkNW3PZXwXM",
    authDomain: "database-delivery-project.firebaseapp.com",
    databaseURL: "gs://database-delivery-project.appspot.com/images",
    projectId: "database-delivery-project",
    storageBucket: "database-delivery-project.appspot.com",
    messagingSenderId: "1048215803691",
    appId: "1:1048215803691:web:fe620c2be4100b0748176e",
    measurementId: "G-3R0F02NB6G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app;
