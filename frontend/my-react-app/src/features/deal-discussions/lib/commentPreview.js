export const storageKey = (dealId) => `gatorbyte:comment-preview:v1:${dealId}`;

const sampleBodies = {
  "sample-taylor": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "sample-morgan": "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
};

export function sampleComments() {
  const now = Date.now();
  return [
    { id: "sample-taylor", authorId: "sample-taylor", authorName: "Taylor", body: sampleBodies["sample-taylor"], parentId: null, createdAt: now - 3600000, pinned: false, deleted: false, score: 3, vote: 0, sample: true },
    { id: "sample-morgan", authorId: "sample-morgan", authorName: "Morgan", body: sampleBodies["sample-morgan"], parentId: "sample-taylor", createdAt: now - 1800000, pinned: false, deleted: false, score: 1, vote: 0, sample: true },
  ];
}

function readVotes(comment) {
  if (Number.isInteger(comment.score) && [-1, 0, 1].includes(comment.vote)) {
    return { score: comment.score, vote: comment.vote };
  }
  // The previous likes count excluded the current viewer's like.
  if (Number.isInteger(comment.likes) && comment.likes >= 0 && typeof comment.liked === "boolean") {
    return { score: comment.likes + Number(comment.liked), vote: Number(comment.liked) };
  }
  return null;
}

export function toggleCommentVote(comment, direction) {
  const vote = comment.vote === direction ? 0 : direction;
  return { score: comment.score + vote - comment.vote, vote };
}

export function loadComments(dealId) {
  try {
    const stored = localStorage.getItem(storageKey(dealId));
    if (stored === null) return sampleComments();
    const parsed = JSON.parse(stored);
    const ids = new Set();
    if (!Array.isArray(parsed) || !parsed.every((item) => {
      if (!item || typeof item.id !== "string" || ids.has(item.id)) return false;
      ids.add(item.id);
      return typeof item.body === "string" && item.body.length <= 2000 &&
        typeof item.authorId === "string" && typeof item.authorName === "string" &&
        (item.parentId === null || typeof item.parentId === "string") &&
        Number.isFinite(item.createdAt) && !Number.isNaN(new Date(item.createdAt).getTime()) &&
        readVotes(item) !== null &&
        [item.pinned, item.deleted, item.sample].every((value) => typeof value === "boolean");
    })) return sampleComments();
    return parsed.map((item) => {
      const migrated = { ...item, ...readVotes(item) };
      delete migrated.likes;
      delete migrated.liked;
      if (item.sample && !item.deleted && Object.hasOwn(sampleBodies, item.id)) {
        migrated.body = sampleBodies[item.id];
      }
      return migrated;
    });
  } catch {
    return sampleComments();
  }
}
