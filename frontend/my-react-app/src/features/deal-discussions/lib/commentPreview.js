export const storageKey = (dealId) => `gatorbyte:comment-preview:v1:${dealId}`;

const legacySampleIds = new Set(["sample-taylor", "sample-morgan"]);

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

export function withoutDeletedComments(comments) {
  const deletedParents = new Map();
  for (const comment of comments) {
    if (comment.deleted) deletedParents.set(comment.id, comment.parentId);
  }
  if (!deletedParents.size) return comments;

  return comments.filter((comment) => !comment.deleted).map((comment) => {
    let parentId = comment.parentId;
    if (!deletedParents.has(parentId)) return comment;

    // Move a reply to the nearest surviving ancestor, or to the top level.
    const visited = new Set([comment.id]);
    while (deletedParents.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      parentId = deletedParents.get(parentId);
    }
    return { ...comment, parentId: visited.has(parentId) ? null : parentId };
  });
}

export function loadComments(dealId) {
  try {
    const stored = localStorage.getItem(storageKey(dealId));
    if (stored === null) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    const sampleIds = new Set(legacySampleIds);
    for (const item of parsed) {
      if (item?.sample === true) sampleIds.add(item.id);
    }
    const comments = [];
    const ids = new Set();
    for (const item of parsed) {
      if (!item || typeof item.id !== "string" || ids.has(item.id) || sampleIds.has(item.id)) continue;
      if (typeof item.body !== "string" || item.body.length > 2000 ||
        typeof item.authorId !== "string" || typeof item.authorName !== "string" ||
        (item.parentId !== null && typeof item.parentId !== "string") ||
        !Number.isFinite(item.createdAt) || !Number.isFinite(new Date(item.createdAt).getTime()) ||
        typeof item.pinned !== "boolean" || typeof item.deleted !== "boolean") continue;
      const votes = readVotes(item);
      if (!votes) continue;
      ids.add(item.id);
      // Replies to the former sample threads become top-level comments.
      const migrated = { ...item, ...votes, parentId: sampleIds.has(item.parentId) ? null : item.parentId };
      delete migrated.likes;
      delete migrated.liked;
      delete migrated.sample;
      comments.push(migrated);
    }
    return withoutDeletedComments(comments);
  } catch {
    return [];
  }
}
