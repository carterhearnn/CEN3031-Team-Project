import { useEffect, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { useAccount } from "../login/useAccount.js";
import { ADMIN, OWNER } from "../login/roles.js";
import { enrichDealRecord } from "../features/deal-discussions/integration.js";
import { buildDealRecord, mergeDealMetadata } from "./dealSubmission.js";
import "./RecordPage.css";

const emptyValues = () => ({ link: "", status: "pending", dateSubmitted: "", dateApproved: "", userID: "", upvotes: "" });

export default function RecordPage() {
  const account = useAccount();
  const [values, setValues] = useState(emptyValues);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const latestAccount = useRef(account);
  const canSubmit = Boolean(account.user) && !account.loading && !account.error;
  const canApprove = canSubmit && (account.role === ADMIN || account.role === OWNER);
  const isOwner = canSubmit && account.role === OWNER;

  useEffect(() => { latestAccount.current = account; }, [account]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const changeField = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setMessage(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setMessage(null);

    try {
      const startingAccount = latestAccount.current;
      if (!startingAccount.user || auth.currentUser?.uid !== startingAccount.user.uid) throw new Error("Log in to submit a deal.");
      if (startingAccount.loading || startingAccount.error) throw new Error("Your account permissions are unavailable. Please try again.");
      const record = buildDealRecord(values, {
        userID: startingAccount.user.uid,
        role: startingAccount.role,
        now: serverTimestamp,
        fromDate: Timestamp.fromDate,
      });
      const enriched = await enrichDealRecord(record);
      const current = latestAccount.current;
      if (!mounted.current) return;
      if (auth.currentUser?.uid !== startingAccount.user.uid || current.user?.uid !== startingAccount.user.uid ||
        current.loading || current.error || current.role !== startingAccount.role) {
        throw new Error("Your account or permissions changed. Please submit the deal again.");
      }
      await addDoc(collection(db, "deals"), mergeDealMetadata(record, enriched));
      if (mounted.current) {
        setMessage({ kind: "success", text: record.status === "pending" ? "Deal submitted for approval." : "Deal added." });
        setValues(emptyValues());
      }
    } catch (error) {
      if (mounted.current) setMessage({ kind: "error", text: error.message || "Couldn't add the deal. Please try again." });
    } finally {
      pending.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };

  return <main className="record-page" id="main-content">
    <div className="record-page-heading"><h1>Add a Deal</h1></div>
    <form className="record-form" onSubmit={submit} aria-busy={isSaving}>
      <fieldset disabled={isSaving}>
        <div className="record-field">
          <label htmlFor="record-link">Deal link</label>
          <input id="record-link" name="link" type="url" value={values.link} onChange={changeField}
            autoComplete="url" placeholder="https://" required />
        </div>
        {canApprove && <div className="record-field">
          <label htmlFor="record-status">Approval status</label>
          <select id="record-status" name="status" value={values.status} onChange={changeField}>
            <option value="pending">Pending</option><option value="approved">Approved</option><option value="denied">Denied</option>
          </select>
        </div>}
        {isOwner && <fieldset className="record-details">
          <legend>Record details</legend>
          <div className="record-fields">
            <div className="record-field">
              <label htmlFor="record-dateSubmitted">Submission date</label>
              <input id="record-dateSubmitted" name="dateSubmitted" type="datetime-local" value={values.dateSubmitted} onChange={changeField} />
            </div>
            {values.status === "approved" && <div className="record-field">
              <label htmlFor="record-dateApproved">Approval date</label>
              <input id="record-dateApproved" name="dateApproved" type="datetime-local" value={values.dateApproved} onChange={changeField} />
            </div>}
            <div className="record-field">
              <label htmlFor="record-userID">Submitted by (User ID)</label>
              <input id="record-userID" name="userID" type="text" value={values.userID} onChange={changeField} placeholder="Your account by default" />
            </div>
            <div className="record-field">
              <label htmlFor="record-upvotes">Upvotes</label>
              <input id="record-upvotes" name="upvotes" type="number" min="0" step="1" value={values.upvotes} onChange={changeField} placeholder="0" />
            </div>
          </div>
          <p className="record-hint">Blank dates use the current time; a blank user ID uses your account.</p>
        </fieldset>}
        {account.loading ? <p className="record-account-message" role="status">Loading account...</p> : account.error ?
          <p className="record-message record-message-error" role="alert">Couldn't load your account permissions. Please try again.</p> : !account.user &&
          <p className="record-account-message">Log in to submit a deal.</p>}
        <button className="record-submit" type="submit" disabled={isSaving || !canSubmit}>{isSaving ? "Adding deal..." : "Add deal"}</button>
      </fieldset>
      {message && <p className={`record-message record-message-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
    </form>
  </main>;
}
