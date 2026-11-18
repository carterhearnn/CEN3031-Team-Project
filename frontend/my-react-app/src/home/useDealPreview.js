import { useEffect } from "react";
import { loadDealPreview } from "../features/deal-discussions/integration.js";

const previews = new Map();
const queue = [];
let running = 0;

function trimCache() {
  for (const [url, entry] of previews) {
    if (previews.size <= 100) break;
    if (!entry.pending) previews.delete(url);
  }
}

function runQueue() {
  while (running < 3 && queue.length) {
    const entry = queue.shift();
    if (entry.controller.signal.aborted) {
      if (previews.get(entry.url) === entry) previews.delete(entry.url);
      entry.resolve(null);
      continue;
    }
    running++;
    loadDealPreview(entry.url, { signal: entry.controller.signal })
      .then((data) => {
        entry.data = data;
        entry.expires = Date.now() + 5 * 60 * 1000;
      })
      .catch(() => {
        entry.data = null;
        entry.expires = entry.controller.signal.aborted ? 0 : Date.now() + 30000;
      })
      .finally(() => {
        entry.pending = false;
        entry.resolve(entry.data);
        running--;
        if (entry.controller.signal.aborted && previews.get(entry.url) === entry) previews.delete(entry.url);
        trimCache();
        runQueue();
      });
  }
}

function subscribe(url) {
  let entry = previews.get(url);
  if (entry && !entry.pending && entry.expires > Date.now()) {
    return { promise: Promise.resolve(entry.data), release() {} };
  }
  if (!entry?.pending || entry.controller.signal.aborted) {
    entry = { url, controller: new AbortController(), subscribers: 0, data: null, pending: true };
    entry.promise = new Promise((resolve) => { entry.resolve = resolve; });
    previews.set(url, entry);
    queue.push(entry);
  }
  entry.subscribers++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.subscribers--;
    if (!entry.subscribers && entry.pending) entry.controller.abort();
  };
  runQueue();
  return { promise: entry.promise, release };
}

export function useDealPreview(link, enabled, element, onPreview) {
  useEffect(() => {
    if (!link || !enabled) return;
    let active = true;
    let subscription;
    let observer;
    const start = () => {
      if (subscription) return;
      subscription = subscribe(link);
      subscription.promise.then((data) => { if (active) onPreview(link, data); });
    };
    if (typeof IntersectionObserver === "function" && element.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      }, { rootMargin: "180px" });
      observer.observe(element.current);
    } else start();
    return () => {
      active = false;
      observer?.disconnect();
      subscription?.release();
    };
  }, [link, enabled, element, onPreview]);
}
