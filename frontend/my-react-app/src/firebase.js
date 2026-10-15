import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration goes here
const firebaseConfig = {
  apiKey: "AIzaSyANt1iyVCt82uGibAiHEnenZJ4gwIMX8sE",
  authDomain: "cen3031-team-project.firebaseapp.com",
  projectId: "cen3031-team-project",
  storageBucket: "cen3031-team-project.firebasestorage.app",
  messagingSenderId: "697750715663",
  appId: "1:697750715663:web:570ca5d36ba7405810d27a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
