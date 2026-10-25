import { useState } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { externalUrl } from "../shared/urls.js";
import { enrichDealRecord } from "../features/deal-discussions/integration.js";
import "./RecordPage.css";

const schemas = {
  deals: [
    { name: "link", label: "Link", type: "url" },
    { name: "brand", label: "Brand", type: "text" },
    { name: "itemName", label: "Item name", type: "text" },
    { name: "price", label: "Price ($)", type: "number", decimal: true },
    { name: "userID", label: "Submitted by (User ID)", type: "number" },
    { name: "upvotes", label: "Upvotes", type: "number" },
    { name: "downvotes", label: "Downvotes", type: "number" },
  ],
  users: [
    { name: "dateCreated", label: "Date created", type: "datetime-local" },
    { name: "userID", label: "User ID", type: "number" },
    { name: "username", label: "Username", type: "text" },
  ],
  wishlist: [
    { name: "userID", label: "User ID", type: "number" },
    { name: "brand", label: "Brand", type: "text" },
    { name: "itemName", label: "Item name", type: "text" },
    { name: "desiredPrice", label: "Desired price ($)", type: "number", decimal: true },
    { name: "link", label: "Link (optional)", type: "url", optional: true },
  ],
};

const emptyValues = (name) => Object.fromEntries(schemas[name].map((field) => [field.name, ""]));

export default function RecordPage() {
  const [collectionName, setCollectionName] = useState("deals");
  const [values, setValues] = useState(() => emptyValues("deals"));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const changeCollection = (event) => {
    const name = event.target.value;
    setCollectionName(name);
    setValues(emptyValues(name));
    setMessage(null);
  };

  const changeField = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const record = {};
      for (const field of schemas[collectionName]) {
        const value = values[field.name].trim();
        if (!value) {
          if (field.optional) continue;
          throw new Error(`${field.label} is required.`);
        }

        if (field.type === "number") {
          const number = Number(value);
          const valid = field.decimal ? Number.isFinite(number) && number >= 0 : Number.isInteger(number);
          if (!valid) throw new Error(field.decimal ? `${field.label} must be a valid price.` : `${field.label} must be a whole number.`);
          record[field.name] = number;
        } else if (field.type === "datetime-local") {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) throw new Error(`${field.label} must be a valid date.`);
          record[field.name] = Timestamp.fromDate(date);
        } else if (field.type === "url") {
          const url = externalUrl(value);
          if (!url) throw new Error(`${field.label} must be an http or https URL.`);
          record[field.name] = url;
        } else {
          record[field.name] = value;
        }
      }

      const savedRecord = collectionName === "deals" ? await enrichDealRecord(record) : record;
      await addDoc(collection(db, collectionName), savedRecord);
      const thumbnailNote = collectionName === "deals" && !savedRecord.imageUrl ? " Thumbnail unavailable." : "";
      setMessage({ kind: "success", text: `Record added to ${collectionName}.${thumbnailNote}` });
      setValues(emptyValues(collectionName));
    } catch (error) {
      console.error("Error adding document:", error);
      setMessage({ kind: "error", text: error.message || "Unable to add the record." });
    } finally {
      setIsSaving(false);
    }
  };

  return <main className="record-page" id="main-content">
    <a className="record-back" href="/">← Home</a>
    <div className="record-page-heading">
      <h1>Add a database record</h1>
      <p>Choose a collection and enter its fields.</p>
    </div>
    <form className="record-form" onSubmit={submit} aria-busy={isSaving}>
      <fieldset disabled={isSaving}>
        <div className="record-field">
          <label htmlFor="record-collection">Collection</label>
          <select id="record-collection" value={collectionName} onChange={changeCollection}>
            {Object.keys(schemas).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="record-fields">
          {schemas[collectionName].map((field) => <div className={`record-field${field.type === "url" ? " record-field-wide" : ""}`} key={field.name}>
            <label htmlFor={`record-${field.name}`}>{field.label}</label>
            <input id={`record-${field.name}`} name={field.name} type={field.type} value={values[field.name]}
              onChange={changeField}
              required={!field.optional}
              step={field.type === "number" ? (field.decimal ? "0.01" : "1") : undefined} />
          </div>)}
        </div>
        <button className="record-submit" type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : `Add ${collectionName} record`}
        </button>
      </fieldset>
      {message && <p className={`record-message record-message-${message.kind}`}
        role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
    </form>
  </main>;
}
