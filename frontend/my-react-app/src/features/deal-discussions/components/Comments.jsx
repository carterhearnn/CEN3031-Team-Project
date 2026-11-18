import { useEffect, useId, useState } from "react";
import { buildCommentTree, formatDate } from "../lib/deals";
import { ADMIN, OWNER } from "../../../login/roles.js";
import { useAccount } from "../../../login/useAccount.js";
import { loadComments, storageKey, toggleCommentVote, withoutDeletedComments } from "../lib/commentPreview";

const LOCAL_AUTHOR_ID = "preview-you";

function Composer({ parentId = null, onPost, onCancel }) {
  const [body, setBody] = useState("");
  const inputId = useId();
  const submit = (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    onPost(body.trim(), parentId);
    setBody("");
  };
  return <form className={`comment-composer${parentId ? " reply-composer" : ""}`} onSubmit={submit}>
    <label htmlFor={inputId}>{parentId ? "Reply" : "Comment"}</label>
    <textarea id={inputId} value={body} onChange={(event) => setBody(event.target.value)}
      placeholder={parentId ? "Write a reply..." : "Write a comment..."} maxLength={2000} rows={2} required />
    <div className="composer-footer">
      <span className="muted">{body.length}/2,000</span>
      <div className="button-row">
        {onCancel && <button type="button" className="text-button" onClick={onCancel}>Cancel</button>}
        <button className="primary-button" type="submit" disabled={!body.trim()}>{parentId ? "Post reply" : "Post"}</button>
      </div>
    </div>
  </form>;
}

function VoteArrow({ down = false }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={down ? "M8 3v10m-4-4 4 4 4-4" : "M8 13V3m-4 4 4-4 4 4"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function countReplies(replies) {
  return replies.reduce((total, reply) => total + 1 + countReplies(reply.replies), 0);
}

function Comment({ comment, canModerate, onPost, onChange, depth = 0 }) {
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const repliesId = useId();
  const composerId = useId();
  const canDelete = comment.authorId === LOCAL_AUTHOR_ID || canModerate;
  const replyCount = countReplies(comment.replies);
  return <li className="comment-thread">
    <article className={`comment ${comment.pinned ? "is-pinned" : ""}`}>
      {comment.deleted ? <p className="deleted-comment">Comment deleted.</p> : <>
        <div className="comment-heading">
          <span className="comment-avatar" aria-hidden="true">{comment.authorName.charAt(0).toUpperCase()}</span>
          <div className="comment-author"><strong>{comment.authorName}</strong><time dateTime={new Date(comment.createdAt).toISOString()}>{formatDate(comment.createdAt)}</time></div>
          {comment.pinned && <span className="pin-badge">Pinned</span>}
        </div>
        <p className="comment-body">{comment.body}</p>
        <div className="comment-actions">
          <div className="vote-control" role="group" aria-label={`Vote on comment by ${comment.authorName}`}>
            <button className={`vote-button${comment.vote === 1 ? " is-upvoted" : ""}`} type="button" title="Upvote"
              aria-label={`Upvote comment by ${comment.authorName}`} aria-pressed={comment.vote === 1}
              onClick={() => onChange(comment.id, toggleCommentVote(comment, 1))}><VoteArrow /></button>
            <span className="vote-score" aria-label={`Score: ${comment.score}`} aria-live="polite">{comment.score}</span>
            <button className={`vote-button${comment.vote === -1 ? " is-downvoted" : ""}`} type="button" title="Downvote"
              aria-label={`Downvote comment by ${comment.authorName}`} aria-pressed={comment.vote === -1}
              onClick={() => onChange(comment.id, toggleCommentVote(comment, -1))}><VoteArrow down /></button>
          </div>
          {depth < 5 && <button className="text-button" type="button" onClick={() => setReplying(!replying)} aria-expanded={replying} aria-controls={composerId}>Reply</button>}
          {canModerate && <button className="text-button" type="button" onClick={() => onChange(comment.id, { pinned: !comment.pinned })}>{comment.pinned ? "Unpin" : "Pin"}</button>}
          {canDelete && <button className="text-button danger-button" type="button" onClick={() => setConfirmingDelete(true)}>Delete</button>}
        </div>
        {confirmingDelete && canDelete && <div className="delete-confirmation" role="group" aria-label="Confirm comment deletion">
          <p>Delete this comment? Replies will stay.</p>
          <div className="button-row"><button className="text-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button>
            <button className="text-button danger-button" type="button" onClick={() => {
              onChange(comment.id, { body: "", authorName: "", deleted: true, pinned: false, score: 0, vote: 0 });
              setConfirmingDelete(false);
              setReplying(false);
            }}>Delete comment</button></div>
        </div>}
      </>}
      <div id={composerId}>
        {replying && !comment.deleted && <Composer parentId={comment.id} onPost={(body, parentId) => {
          onPost(body, parentId);
          setShowReplies(true);
          setReplying(false);
        }} onCancel={() => setReplying(false)} />}
      </div>
      {replyCount > 0 && <div className="replies-control"><button className="text-button replies-toggle" type="button" aria-expanded={showReplies} aria-controls={repliesId}
        onClick={() => setShowReplies(!showReplies)}>{showReplies ? "Hide replies" : `View replies (${replyCount})`}</button></div>}
    </article>
    {replyCount > 0 && <ol id={repliesId} className="comment-replies" hidden={!showReplies}>{comment.replies.map((reply) => <Comment key={reply.id} comment={reply} canModerate={canModerate} onPost={onPost} onChange={onChange} depth={depth + 1} />)}</ol>}
  </li>;
}

export default function Comments({ dealId }) {
  const [comments, setComments] = useState(() => loadComments(dealId));
  const { user, role, loading, error } = useAccount();
  const canModerate = Boolean(user && !loading && !error && (role === ADMIN || role === OWNER));
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    const sync = (event) => {
      if (event.key === storageKey(dealId) || event.key === null) setComments(loadComments(dealId));
    };
    const restore = (event) => {
      if (event.persisted) setComments(loadComments(dealId));
    };
    window.addEventListener("storage", sync);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("pageshow", restore);
    };
  }, [dealId]);
  const save = (next) => {
    setComments(next);
    try {
      localStorage.setItem(storageKey(dealId), JSON.stringify(withoutDeletedComments(next)));
      setStorageError("");
    } catch {
      setStorageError("Couldn't save comments in this browser. Changes will last until this page closes.");
    }
  };
  const onPost = (body, parentId) => save([...comments, {
    id: crypto.randomUUID(), body, parentId, authorId: LOCAL_AUTHOR_ID, authorName: "You",
    createdAt: Date.now(), pinned: false, deleted: false, score: 0, vote: 0,
  }]);
  const onChange = (id, changes) => save(comments.map((comment) => comment.id === id ? { ...comment, ...changes } : comment));
  const tree = buildCommentTree(comments);
  const count = comments.filter((comment) => !comment.deleted).length;
  return <section className="discussion" aria-labelledby="discussion-title">
    <div className="discussion-header">
      <div className="discussion-heading">
        <h2 id="discussion-title">Comments <span className="count-badge">{count}</span></h2>
      </div>
      <p className="muted discussion-storage-note">Saved in this browser.</p>
    </div>
    <div className="comments-scroll" tabIndex={0} role="region" aria-label="Comments">
      {storageError && <p className="error" role="status">{storageError}</p>}
      <div className="comments-status" role="status" aria-live="polite">{count === 0 ? "No comments yet! Be the first" : ""}</div>
      {count > 0 && <ol className="comment-list">{tree.map((comment) => <Comment key={comment.id} comment={comment} canModerate={canModerate} onPost={onPost} onChange={onChange} />)}</ol>}
    </div>
    <div className="discussion-composer"><Composer onPost={onPost} /></div>
  </section>;
}
