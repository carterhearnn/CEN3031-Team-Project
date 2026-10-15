// src/App.jsx
import React, { useEffect } from "react";
import { db } from "./firebase"; // Import the db instance you exported
import { collection, addDoc } from "firebase/firestore";

function App() {
  const handleAddData = async () => {
    try {
      await addDoc(collection(db, "test_collection"), {
        message: "Hello from React!",
        timestamp: new Date()
      });
      console.log("Document successfully written!");
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };  

  return (
    <div style={{ padding: "20px" }}>
      <h1>CEN3031 Team Project</h1>
      <button onClick={handleAddData}>Add Data to Firestore</button>
    </div>
  );
}

export default App;
