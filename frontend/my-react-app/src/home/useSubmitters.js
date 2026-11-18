import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";

export function submitterKey(value) {
  if (typeof value === "string") return value.trim() || null;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

export function buildSubmitterNames(documents) {
  const names = new Map();
  const users = documents.map((document) => {
    const user = document.data();
    const name = [user.username, user.name, user.displayName]
      .find((value) => typeof value === "string" && value.trim());
    return { id: document.id, userID: user.userID, name: name?.trim() };
  }).filter((user) => user.name);

  for (const user of users) {
    const key = submitterKey(user.id);
    if (key !== null) names.set(key, user.name);
  }
  // Explicit legacy user IDs take precedence over coincidentally matching document IDs.
  for (const user of users) {
    const key = submitterKey(user.userID);
    if (key !== null) names.set(key, user.name);
  }
  return names;
}

export function useSubmitters() {
  const [names, setNames] = useState(() => new Map());

  useEffect(() => {
    let active = true;
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      if (active) setNames(buildSubmitterNames(snapshot.docs));
    }, () => { if (active) setNames(new Map()); });
    return () => { active = false; unsubscribe(); };
  }, []);

  return names;
}
