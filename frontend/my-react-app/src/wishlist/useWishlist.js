import { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { useAccount } from "../login/useAccount.js";
import { buildWishlistRecord, findWishlistItem, wishlistRecordID } from "./records.js";

function actionError(error, kind) {
  if (error.code === "permission-denied") return `You don't have permission to ${kind === "remove" ? "remove" : "save"} this item.`;
  if (error.code === "unavailable") return "Couldn't connect. Please try again.";
  if (error.code) return `Couldn't ${kind === "remove" ? "remove" : "save"} this item. Please try again.`;
  return error.message || "Couldn't update your wishlist. Please try again.";
}

function loadError(error) {
  if (error.code === "permission-denied") return "Wishlist access is blocked. Ask the site administrator to check wishlist permissions.";
  if (error.code === "unauthenticated") return "Sign out and log back in to load your wishlist.";
  if (error.code === "unavailable") return "Couldn't connect. Check your connection and refresh.";
  return "Couldn't load your wishlist. Refresh to try again.";
}

export function useWishlist() {
  const account = useAccount();
  const uid = account.user?.uid || "";
  const scope = uid && !account.loading && !account.error ? uid : "";
  const [saved, setSaved] = useState({ uid: "", items: [], status: "loading", error: "" });
  const [actions, setActions] = useState({ uid: "", pending: new Set(), errors: new Map() });
  const pending = useRef(new Map());
  const mounted = useRef(true);
  const currentAccount = useRef(account);

  useEffect(() => { currentAccount.current = account; }, [account]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!scope) return;
    let active = true;
    const request = query(collection(db, "wishlist"), where("userID", "==", scope));
    const unsubscribe = onSnapshot(request, (snapshot) => {
      if (active) setSaved({ uid: scope, items: snapshot.docs.map((document) => ({ ...document.data(), id: document.id })), status: "ready", error: "" });
    }, (error) => {
      if (active) setSaved({ uid: scope, items: [], status: "error", error: loadError(error) });
    });
    return () => { active = false; unsubscribe(); };
  }, [scope]);

  const result = scope && saved.uid === scope ? saved : { items: [], status: "loading", error: "" };
  const status = account.loading ? "loading" : account.error ? "error" : !uid ? "signed-out" : result.status;
  const items = status === "ready" ? result.items : [];

  const runAction = async (kind, id, write) => {
    const key = `${kind}:${id}`;
    const operationKey = JSON.stringify([uid, key]);
    if (pending.current.has(operationKey)) return pending.current.get(operationKey);
    const isCurrentAccount = () => mounted.current &&
      (currentAccount.current.user?.uid || "") === uid && (auth.currentUser?.uid || "") === uid;
    const updateAction = (busy, error = "") => {
      if (!isCurrentAccount()) return;
      setActions((previous) => {
        const next = previous.uid === uid
          ? { uid, pending: new Set(previous.pending), errors: new Map(previous.errors) }
          : { uid, pending: new Set(), errors: new Map() };
        if (busy) next.pending.add(key); else next.pending.delete(key);
        if (error) next.errors.set(key, error); else next.errors.delete(key);
        return next;
      });
    };

    const operation = (async () => {
      updateAction(true);
      try {
        if (!uid || auth.currentUser?.uid !== uid || currentAccount.current.user?.uid !== uid) {
          throw new Error("Log in to save deals to your wishlist.");
        }
        if (account.loading || account.error || currentAccount.current.loading || currentAccount.current.error || status !== "ready") {
          throw new Error(account.error || result.error || "Your wishlist isn't available yet. Please try again.");
        }
        await write();
        updateAction(false);
        return true;
      } catch (error) {
        updateAction(false, actionError(error, kind));
        return false;
      }
    })();
    pending.current.set(operationKey, operation);
    try { return await operation; }
    finally { pending.current.delete(operationKey); }
  };

  const save = (deal) => runAction("save", deal.id, async () => {
    if (findWishlistItem(items, deal)) return;
    const record = buildWishlistRecord(deal, uid, serverTimestamp);
    await setDoc(doc(db, "wishlist", wishlistRecordID(uid, deal.id)), record);
  });
  const remove = (item) => runAction("remove", item.id, async () => {
    if (!item.id || item.userID !== uid) throw new Error("This item isn't in your wishlist.");
    await deleteDoc(doc(db, "wishlist", item.id));
  });
  const action = (kind, id) => {
    const key = `${kind}:${id}`;
    return actions.uid === uid ? { busy: actions.pending.has(key), error: actions.errors.get(key) || "" } : { busy: false, error: "" };
  };

  return { account, items, status, error: account.error || result.error, save, remove, action,
    isSaved: (deal) => Boolean(findWishlistItem(items, deal)) };
}
