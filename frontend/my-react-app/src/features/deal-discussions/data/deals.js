// Shared Firebase configuration is the feature's explicit database integration.
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase.js";

export function watchDeal(dealId, onDeal, onError) {
  return onSnapshot(doc(db, "deals", dealId), (snapshot) => {
    onDeal(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null);
  }, onError);
}
