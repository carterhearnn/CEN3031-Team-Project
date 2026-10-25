// Shared Firebase configuration is the feature's explicit database integration.
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase.js";

export async function readDeal(dealId) {
  const snapshot = await getDoc(doc(db, "deals", dealId));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
}
