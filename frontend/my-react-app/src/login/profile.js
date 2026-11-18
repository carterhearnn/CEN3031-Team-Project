import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { USER } from "./roles.js";

export async function ensureUserProfile(user, displayName = "") {
  if (!user?.uid) throw new Error("Sign in before saving a profile.");
  const reference = doc(db, "users", user.uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    // Returning logins must not reset a role, creation date, or chosen name.
    if (snapshot.exists()) return;
    transaction.set(reference, {
      userID: user.uid,
      userState: USER,
      name: displayName.trim() || user.displayName || "",
      email: user.email || "",
      dateCreated: serverTimestamp(),
    });
  });
}
