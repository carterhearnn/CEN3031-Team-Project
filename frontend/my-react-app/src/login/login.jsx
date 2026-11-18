import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase.js";
import { useAccount } from "./useAccount.js";
import { ensureUserProfile } from "./profile.js";
import "./Login.css";

function authError(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "The email or password is incorrect.";
    case "auth/email-already-in-use": return "An account already exists for this email.";
    case "auth/weak-password": return "Use a password with at least 6 characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request": return "";
    case "auth/popup-blocked": return "Allow the Google sign-in popup and try again.";
    case "auth/too-many-requests": return "Too many attempts. Please try again later.";
    case "auth/network-request-failed": return "Couldn't connect. Check your connection and try again.";
    default: return "Couldn't sign in. Please try again.";
  }
}

function accountName(user, profile) {
  for (const name of [profile?.username, profile?.name, user?.displayName]) {
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return "Signed in";
}

export default function GoogleLogin({ className = "" }) {
  const { user, profile, loading, error: accountError } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const modal = useRef(null);
  const trigger = useRef(null);
  const titleId = useId();
  const errorId = useId();
  const emailId = useId();
  const passwordId = useId();
  const nameId = useId();

  const close = () => { setIsOpen(false); setPassword(""); setError(""); };

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const accountElement = trigger.current?.closest(".login-account");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...(modal.current?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]',
    ) || [])];
    const firstField = modal.current?.querySelector("input");
    (firstField || focusable()[0])?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        setPassword("");
        setError("");
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !modal.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modal.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const target = previousFocus?.isConnected ? previousFocus : accountElement?.querySelector(".login-button");
      target?.focus();
    };
  }, [isOpen]);

  async function authenticate(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    let signedIn = false;
    try {
      const result = await action();
      signedIn = true;
      await ensureUserProfile(result.user, mode === "signup" ? name : "");
      close();
      setEmail("");
      setName("");
    } catch (cause) {
      setError(signedIn
        ? "You're signed in, but your profile couldn't be saved. Try signing in again."
        : authError(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const submitEmail = (event) => {
    event.preventDefault();
    if (mode === "signup" && !name.trim()) { setError("Enter a display name."); return; }
    authenticate(async () => {
      if (mode === "signin") return signInWithEmailAndPassword(auth, email.trim(), password);
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      try { await updateProfile(result.user, { displayName: name.trim() }); }
      catch { /* The Firestore profile below still stores the chosen display name. */ }
      return result;
    });
  };

  const logOut = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try { await signOut(auth); }
    catch { setError("Couldn't log out. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  };

  return <>
    <div className="login-account">
      {user ? <>
        <span className="login-account-name" title={accountName(user, profile)}>{accountName(user, profile)}</span>
        <button className={`login-button ${className}`.trim()} type="button" onClick={logOut} disabled={busy}>Log out</button>
      </> : <button ref={trigger} className={`login-button ${className}`.trim()} type="button" disabled={loading}
        onClick={() => { setError(""); setMode("signin"); setIsOpen(true); }}>
        {loading ? "Loading..." : "Log in"}
      </button>}
      {!isOpen && (error || accountError) && <span className="login-account-error" role="alert">{error || accountError}</span>}
    </div>
    {isOpen && typeof document !== "undefined" && createPortal(
      <div className="login-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}>
        <section ref={modal} className="login-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}
          aria-describedby={error ? errorId : undefined}>
          <button className="login-close" type="button" aria-label="Close login" onClick={close}>×</button>
          <h2 id={titleId}>{mode === "signin" ? "Log in" : "Create an account"}</h2>
          <button className="login-google" type="button" disabled={busy}
            onClick={() => authenticate(() => signInWithPopup(auth, googleProvider))}>
            Continue with Google
          </button>
          <div className="login-divider"><span>or use email</span></div>
          <form className="login-form" onSubmit={submitEmail} aria-busy={busy}>
            <fieldset className="login-fields" disabled={busy}>
              {mode === "signup" && <div className="login-field">
                <label htmlFor={nameId}>Display name</label>
                <input id={nameId} autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>}
              <div className="login-field">
                <label htmlFor={emailId}>Email</label>
                <input id={emailId} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="login-field">
                <label htmlFor={passwordId}>Password</label>
                <input id={passwordId} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={mode === "signup" ? 6 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required />
                {mode === "signup" && <p className="login-field-help">At least 6 characters.</p>}
              </div>
            </fieldset>
            {error && <p className="login-error" id={errorId} role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "signin" ? "Log in" : "Create account"}
            </button>
          </form>
          <p className="login-switch">
            {mode === "signin" ? "New to GatorByte?" : "Already have an account?"}
            <button className="login-mode-toggle" type="button" disabled={busy} onClick={() => {
              setError(""); setPassword(""); setMode(mode === "signin" ? "signup" : "signin");
            }}>{mode === "signin" ? "Create an account" : "Log in"}</button>
          </p>
        </section>
      </div>, document.body,
    )}
  </>;
}
