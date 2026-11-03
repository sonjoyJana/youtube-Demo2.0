import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api.js';
import { formatCount } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import CommentComposer from './CommentComposer.jsx';
import CommentItem from './CommentItem.jsx';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'mostLiked', label: 'Most liked' },
  { value: 'mostRelevant', label: 'Most relevant' },
];

export default function CommentSection({ videoId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchComments = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const response = await api.get('/comments', { params: { videoId, sort } });
        setComments(response.data.comments);
        setTotal(response.data.total);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [videoId, sort, user?.id]
  );

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  function patchComment(commentId, patch) {
    setComments((current) =>
      current.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, ...patch, replies: comment.replies };
        }
        if (!comment.replies?.length) return comment;
        let changed = false;
        const replies = comment.replies.map((reply) => {
          if (reply.id !== commentId) return reply;
          changed = true;
          return { ...reply, ...patch };
        });
        return changed ? { ...comment, replies } : comment;
      })
    );
  }

  function handleTopLevelPosted() {
    fetchComments({ silent: true });
  }

  return (
    <section className="comments-section" id="comments">
      <div className="comments-header">
        <div className="comments-heading">
          <h2>
            {formatCount(total)} {total === 1 ? 'Comment' : 'Comments'}
          </h2>
          {refreshing ? (
            <span className="comments-refreshing">
              <RefreshCw size={14} className="spin" />
              Updating
            </span>
          ) : null}
        </div>

        <label className="sort-control">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {user ? (
        <div className="top-composer">
          <CommentComposer
            videoId={videoId}
            onPosted={handleTopLevelPosted}
            placeholder="Add a comment… use @username to mention someone"
          />
        </div>
      ) : (
        <div className="signed-out-composer">
          <Avatar name="Guest" size={40} />
          <div>
            <p>Sign in to add a comment, mention other users, and translate the discussion.</p>
            <Link to="/login" className="sign-in-button">
              Sign in
            </Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="comment-skeletons">
          {[1, 2, 3].map((item) => (
            <div className="comment-skeleton" key={item}>
              <span className="skeleton-avatar" />
              <div>
                <span className="skeleton-line short" />
                <span className="skeleton-line" />
                <span className="skeleton-line medium" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="comments-error">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => fetchComments()}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      ) : comments.length === 0 ? (
        <div className="comments-empty">
          <MessageSquare size={28} />
          <h3>Start the conversation</h3>
          <p>No comments yet. Be the first to share your thoughts.</p>
        </div>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onPatch={patchComment}
              onRefresh={() => fetchComments({ silent: true })}
            />
          ))}
        </div>
      )}

      {refreshing ? (
        <div className="refreshing-overlay">
          <Loader2 size={18} className="spin" />
        </div>
      ) : null}
    </section>
  );
}
