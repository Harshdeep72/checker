import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MessageSquare, ArrowUp } from 'lucide-react';

const CommentNode = ({ comment }) => {
  const [expanded, setExpanded] = useState(true);
  
  if (comment.kind !== 't1') return null; // Only render comments, not "more" links
  
  const data = comment.data;
  const hasReplies = data.replies && data.replies.data && data.replies.data.children && data.replies.data.children.length > 0;
  
  return (
    <div className="comment-node" style={{ 
      borderLeft: '2px solid rgba(255, 255, 255, 0.1)', 
      paddingLeft: '1rem',
      marginTop: '1rem'
    }}>
      <div className="comment-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
        {hasReplies && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <span style={{ fontWeight: '600', color: 'var(--accent-color)' }}>u/{data.author}</span>
        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <ArrowUp size={12} /> {data.ups}
        </span>
      </div>
      
      {expanded && (
        <>
          <div className="comment-body" style={{ fontSize: '0.95rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>
            {data.body}
          </div>
          
          {hasReplies && (
            <div className="comment-replies">
              {data.replies.data.children.map((child, idx) => (
                <CommentNode key={child.data.id || idx} comment={child} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default function CommentTree({ comments }) {
  if (!comments || comments.length === 0) return <div style={{padding: '1rem', color: 'var(--text-secondary)'}}>No comments found.</div>;
  
  return (
    <div className="comment-tree" style={{ 
      background: 'rgba(0, 0, 0, 0.2)', 
      borderRadius: '8px', 
      padding: '1rem'
    }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
        <MessageSquare size={18} /> Comment Thread
      </h3>
      {comments.map((child, idx) => (
        <CommentNode key={child.data?.id || idx} comment={child} />
      ))}
    </div>
  );
}
