// src/App.jsx
import { useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import Leaderboard from "./leaderboard/Leaderboard";
import Wishlist from "./wishlist/Wishlist";

const schemas = {
  deals: [
    { name: "dateApproved", label: "Date approved", type: "datetime-local" },
    { name: "dateSubmitted", label: "Date submitted", type: "datetime-local" },
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

const emptyValues = (collectionName) =>
  Object.fromEntries(schemas[collectionName].map(({ name }) => [name, ""]));

function App() {
  const [collectionName, setCollectionName] = useState("deals");
  const [values, setValues] = useState(emptyValues("deals"));
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [tables, setTables] = useState(null);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tableError, setTableError] = useState("");

  const handleCollectionChange = (event) => {
    const nextCollection = event.target.value;
    setCollectionName(nextCollection);
    setValues(emptyValues(nextCollection));
    setMessage("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((currentValues) => ({ ...currentValues, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);

    try {
      const record = {};
      for (const field of schemas[collectionName]) {
        const value = values[field.name].trim();
        if (!value) {
          if (field.optional) continue;
          throw new Error(`${field.label} is required.`);
        }

        if (field.type === "number") {
          const numberValue = Number(value);
          const valid = field.decimal
            ? Number.isFinite(numberValue) && numberValue >= 0
            : Number.isInteger(numberValue);
          if (!valid) {
            throw new Error(field.decimal
              ? `${field.label} must be a valid price.`
              : `${field.label} must be a whole number.`);
          }
          record[field.name] = numberValue;
        } else if (field.type === "datetime-local") {
          const dateValue = new Date(value);
          if (Number.isNaN(dateValue.getTime())) {
            throw new Error(`${field.label} must be a valid date.`);
          }
          record[field.name] = Timestamp.fromDate(dateValue);
        } else {
          record[field.name] = value;
        }
      }

      await addDoc(collection(db, collectionName), record);
      setValues(emptyValues(collectionName));
      setMessage(`Record added to ${collectionName}.`);
    } catch (error) {
      console.error("Error adding document:", error);
      setMessage(error.message || "Unable to add the record.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisplayTables = async () => {
    setIsLoadingTables(true);
    setTableError("");

    try {
      const results = await Promise.all(
        Object.keys(schemas).map(async (name) => {
          const snapshot = await getDocs(collection(db, name));
          return [
            name,
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            })),
          ];
        }),
      );
      setTables(Object.fromEntries(results));
    } catch (error) {
      console.error("Error loading tables:", error);
      setTableError("Unable to load the Firestore tables.");
    } finally {
      setIsLoadingTables(false);
    }
  };

  const formatValue = (value) => {
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleString();
    }
    if (value?.toDate instanceof Function) {
      return value.toDate().toLocaleString();
    }
    return String(value ?? "");
  };

  return (
    <div className="app">
      <header>
        <p className="eyebrow">CEN3031 Team Project</p>
        <h1>Add a database record</h1>
        <p className="intro">
          Choose a collection and enter the fields from the Firestore schema.
        </p>
      </header>

      <main className="record-card">
        <form onSubmit={handleSubmit}>
          <label htmlFor="collection">Collection</label>
          <select
            id="collection"
            value={collectionName}
            onChange={handleCollectionChange}
          >
            {Object.keys(schemas).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <div className="field-grid">
            {schemas[collectionName].map((field) => (
              <div className="field" key={field.name}>
                <label htmlFor={field.name}>{field.label}</label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  value={values[field.name]}
                  onChange={handleChange}
                  required={!field.optional}
                  step={field.type === "number" ? "1" : undefined}
                />
              </div>
            ))}
          </div>

          <button className="submit-button" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : `Add ${collectionName} record`}
          </button>
        </form>
        {message && (
          <p className={message.startsWith("Record") ? "success" : "error"}>
            {message}
          </p>
        )}
      </main>

      <section className="tables-section" aria-live="polite">
        <div className="tables-heading">
          <div>
            <h2>Firestore tables</h2>
            <p>Load the current records from each collection.</p>
          </div>
          <button
            className="display-button"
            type="button"
            onClick={handleDisplayTables}
            disabled={isLoadingTables}
          >
            {isLoadingTables ? "Loading..." : "Display tables"}
          </button>
        </div>

        {tableError && <p className="error">{tableError}</p>}
        {tables && (
          <div className="tables-list">
            {Object.entries(tables).map(([name, records]) => (
              <div className="table-card" key={name}>
                <h3>{name}</h3>
                {records.length === 0 ? (
                  <p className="empty-table">No records found.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Document ID</th>
                          {schemas[name].map((field) => (
                            <th key={field.name}>{field.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td>{record.id}</td>
                            {schemas[name].map((field) => (
                              <td key={field.name}>
                                {formatValue(record[field.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <Leaderboard />
      <Wishlist /> 
    </div>
  );
}

export default App;
