import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { normalizeRole, USER } from "./roles.js";

export function useAccount() {
  const [account, setAccount] = useState({ user: null, profile: null, role: USER, loading: true, error: "" });

  useEffect(() => {
    let active = true;
    let generation = 0;
    let unsubscribeProfile;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const current = ++generation;
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      if (!active) return;
      setAccount({ user, profile: null, role: USER, loading: Boolean(user), error: "" });
      if (!user) return;

      unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
        if (!active || current !== generation) return;
        const profile = snapshot.exists() ? snapshot.data() : null;
        setAccount({ user, profile, role: normalizeRole(profile), loading: false, error: "" });
      }, () => {
        if (active && current === generation) setAccount({
          user, profile: null, role: USER, loading: false,
          error: "Couldn't load your account permissions. Reload the page to try again.",
        });
      });
    }, () => {
      generation++;
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      if (active) setAccount({
        user: null, profile: null, role: USER, loading: false,
        error: "Couldn't check your sign-in status. Reload the page to try again.",
      });
    });

    return () => {
      active = false;
      generation++;
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  return account;
}
