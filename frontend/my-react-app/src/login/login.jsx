
import { useState } from "react";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup
} from "firebase/auth";
import {
    doc,
    setDoc,
    serverTimestamp
} from "firebase/firestore";

import { auth, googleProvider, db } from "../firebase.js";
import "./Login.css";

async function saveUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    try {
        await setDoc(userRef, {
            userID: user.uid,
            userStatus: 0,
            name: user.displayName ?? "",
            email: user.email ?? "",
            dateCreated: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error("User profile save failed:", error);
        throw new Error("Signed in, but your user profile could not be saved. Update the Firestore rules for users/{uid}.");
    }
}

function getAuthError(error) {
    switch (error.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "The email or password is incorrect.";
        case "auth/email-already-in-use":
            return "An account already exists for this email.";
        case "auth/weak-password":
            return "Password must be at least 6 characters.";
        default:
            return error.message || "Unable to authenticate.";
    }
}

export default function GoogleLogin({ className = "" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    async function handleGoogleLogin() {
        setError("");
        setIsLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await saveUserProfile(result.user);
            setIsOpen(false);
        } catch (error) {
            console.error("Google login failed:", error);
            setError(getAuthError(error));
        } finally {
            setIsLoading(false);
        }
    }

    async function handleEmailAuth(event) {
        event.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            const result = mode === "signin"
                ? await signInWithEmailAndPassword(auth, email, password)
                : await createUserWithEmailAndPassword(auth, email, password);
            await saveUserProfile(result.user);
            setIsOpen(false);
            setEmail("");
            setPassword("");
        } catch (error) {
            console.error("Email authentication failed:", error);
            setError(getAuthError(error));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            <button className={`login-button ${className}`.trim()} type="button" onClick={() => { setError(""); setIsOpen(true); }}>
                Log in
            </button>
            {isOpen && <div className="login-modal-backdrop" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) setIsOpen(false);
            }}>
                <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
                    <button className="login-close" type="button" aria-label="Close login" onClick={() => setIsOpen(false)}>×</button>
                    <h2 id="login-title">{mode === "signin" ? "Log in" : "Create an account"}</h2>
                    <button className="login-google" type="button" onClick={handleGoogleLogin} disabled={isLoading}>
                        Continue with Google
                    </button>
                    <div className="login-divider"><span>or</span></div>
                    <form onSubmit={handleEmailAuth}>
                        <label htmlFor="login-email">Email</label>
                        <input id="login-email" type="email" autoComplete="email" value={email}
                            onChange={(event) => setEmail(event.target.value)} required />
                        <label htmlFor="login-password">Password</label>
                        <input id="login-password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
                            minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required />
                        {error && <p className="login-error" role="alert">{error}</p>}
                        <button className="login-submit" type="submit" disabled={isLoading}>
                            {isLoading ? "Please wait..." : mode === "signin" ? "Log in" : "Create account"}
                        </button>
                    </form>
                    <button className="login-mode-toggle" type="button" onClick={() => { setError(""); setMode(mode === "signin" ? "signup" : "signin"); }}>
                        {mode === "signin" ? "Need an account? Create one" : "Already have an account? Log in"}
                    </button>
                </section>
            </div>}
        </>
    );
}
