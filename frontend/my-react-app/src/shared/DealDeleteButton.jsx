import { createContext, useContext, useRef, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { ADMIN, OWNER } from "../login/roles.js";
import { useAccount } from "../login/useAccount.js";

const DealDeletion = createContext(null);

export function DealDeletionProvider({ children }) {
  const { user, role, loading, error } = useAccount();
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const pending = useRef(false);
  const canDelete = Boolean(user && !loading && !error && (role === ADMIN || role === OWNER));

  async function deleteListing(dealId) {
    if (!canDelete || pending.current) return;
    if (auth.currentUser?.uid !== user.uid) {
      setDeleteError("Your account changed. Try again.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this listing")) return;
    if (auth.currentUser?.uid !== user.uid) {
      setDeleteError("Your account changed. Try again.");
      return;
    }

    pending.current = true;
    setDeletingId(dealId);
    setDeleteError("");
    try {
      await deleteDoc(doc(db, "deals", dealId));
    } catch (cause) {
      setDeleteError(cause.code === "permission-denied"
        ? "You don't have permission to delete this listing."
        : "Couldn't delete the listing. Please try again.");
    } finally {
      pending.current = false;
      setDeletingId(null);
    }
  }

  return <DealDeletion.Provider value={{ canDelete, deletingId, deleteListing }}>
    {deleteError && <p className="deal-delete-error" role="alert">{deleteError}</p>}
    {children}
  </DealDeletion.Provider>;
}

export default function DealDeleteButton({ dealId, className }) {
  const deletion = useContext(DealDeletion);
  if (!dealId || !deletion?.canDelete) return null;

  return <button className={`${className} deal-delete-button`} type="button"
    disabled={deletion.deletingId !== null} aria-busy={deletion.deletingId === dealId}
    onClick={() => deletion.deleteListing(dealId)}>
    {deletion.deletingId === dealId ? "Deleting..." : "Delete listing"}
  </button>;
}
