import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function TrackedAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkUsernames, setBulkUsernames] = useState('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(300);
  const refreshIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const REFRESH_INTERVAL = 300; // 5 minutes

  const runBackgroundRefresh = useCallback((data) => {
    Promise.all(
      data.map(acc =>
        fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/${acc.username}`)
          .then(r => r.ok ? r.json() : null)
          .then(detail => {
            if (detail) {
              setAccounts(prev => prev.map(a =>
                a.username === acc.username
                  ? { ...a, total_karma: detail.total_karma, icon_img: detail.icon_img, is_live: detail.is_live, auto_track: detail.auto_track, reddit_data: detail.reddit_data }
                  : a
              ));
            }
          })
          .catch(() => null)
      )
    );
  }, []);

  const fetchAccounts = useCallback(() => {
    fetch((import.meta.env.VITE_API_URL || "http://localhost:8000") + '/api/accounts', { cache: 'no-store' })
      .then((res) => res.json())
      .then(data => {
        setAccounts(data);
        setLoading(false);
        setSecondsUntilRefresh(REFRESH_INTERVAL);
        runBackgroundRefresh(data);
      })
      .catch(err => {
        console.error("Failed to fetch accounts:", err);
        setError("Failed to connect to API");
        setLoading(false);
      });
  }, [runBackgroundRefresh]);

  useEffect(() => {
    fetchAccounts();

    // Auto-refresh every 5 minutes
    refreshIntervalRef.current = setInterval(() => {
      fetchAccounts();
    }, REFRESH_INTERVAL * 1000);

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh(s => (s <= 1 ? REFRESH_INTERVAL : s - 1));
    }, 1000);

    return () => {
      clearInterval(refreshIntervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [fetchAccounts]);


  const handleDelete = async (username) => {
    if (window.confirm(`Stop tracking u/${username} and remove from database?`)) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/${username}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Failed to delete account");
        setAccounts(accounts => accounts.filter(acc => acc.username !== username));
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const toggleRow = async (username) => {
    if (expandedRow === username) {
      setExpandedRow(null);
    } else {
      setExpandedRow(username);
      const account = accounts.find(a => a.username === username);
      if (!account.reddit_data) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/${username}`);
          if (res.ok) {
            const data = await res.json();
            setAccounts(prev => prev.map(a => 
              a.username === username ? { ...a, reddit_data: data.reddit_data, posts: data.posts, comments: data.comments } : a
            ));
          }
        } catch (err) {
          console.error("Failed to fetch detailed data for account:", err);
        }
      }
    }
  };

  const toggleAutoTrack = async (username) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/${username}/auto_track`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setAccounts(prev => prev.map(a => a.username === username ? { ...a, auto_track: data.auto_track } : a));
      }
    } catch (err) {
      console.error("Failed to toggle auto_track:", err);
    }
  };

  const quickTrackItem = async (url, type, username) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/tracked/${type}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] })
      });
      if (res.ok) {
        // Update local tracked list so badge disappears
        setAccounts(prev => prev.map(a => {
          if (a.username !== username) return a;
          const key = type === 'posts' ? 'posts' : 'comments';
          return { ...a, [key]: [...(a[key] || []), { url, is_live: true }] };
        }));
      }
    } catch (err) {
      console.error("Failed to quick-track:", err);
    }
  };

  const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;


  const submitBulkAccounts = async (e) => {
    e.preventDefault();
    if (!bulkUsernames) return;
    
    const usernames = bulkUsernames
      .split(/[\n,\s]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0);
      
    if (usernames.length === 0) return;
    setIsSubmittingBulk(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to bulk track accounts");
      
      if (data.failed > 0) {
        alert(`Successfully added ${data.added} accounts. Failed ${data.failed} accounts:\n\n${data.errors.join('\\n')}`);
      }
      setIsBulkModalOpen(false);
      setBulkUsernames('');
      fetchAccounts();
    } catch(err) {
      alert(err.message);
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  if (loading) return <div className="p-12 text-on-surface">Loading accounts...</div>;
  if (error) return <div className="p-12 text-error">{error}</div>;

  return (
    <>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <nav className="flex items-center gap-2 mb-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase">Dashboard</span>
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[16px]">chevron_right</span>
            <span className="font-label-sm text-label-sm text-primary uppercase">Accounts</span>
          </nav>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Tracked Accounts</h1>
          <p className="text-on-surface-variant mt-2 max-w-xl">Manage your high-priority Reddit monitoring targets. Real-time scanning is active.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsBulkModalOpen(true)} className="flex items-center justify-center gap-2 bg-surface-container border border-white/10 text-on-surface px-6 py-3 rounded-xl font-label-md text-label-md hover:bg-white/5 transition-all active:scale-95 cursor-pointer">
            <span className="material-symbols-outlined">group_add</span>
            Bulk Track
          </button>
          <Link to="/accounts" className="flex items-center justify-center gap-2 bg-linear-to-r from-primary to-primary-container text-white px-6 py-3 rounded-xl font-label-md text-label-md hover:shadow-[0_0_20px_rgba(77,142,255,0.4)] transition-all active:scale-95">
            <span className="material-symbols-outlined">person_add</span>
            Lookup Account
          </Link>
        </div>
      </div>

      {/* Directory Table Container */}
      <div className="bg-surface-container/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
        {/* Table Header (Desktop) */}
        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.5fr] gap-4 px-8 py-4 border-b border-white/5 bg-white/5">
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase">Username</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase text-center">Status</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase">Last Checked</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase text-right">Actions</span>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-white/5">
          {accounts.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">No accounts being tracked.</div>
          ) : accounts.map((account) => (
            <div key={account.id} className="group transition-all">
              <div 
                className={`grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_0.5fr] gap-4 px-6 md:px-8 py-5 items-center cursor-pointer transition-all ${expandedRow === account.username ? 'bg-white/5' : 'hover:bg-white/5'}`}
                onClick={() => toggleRow(account.username)}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {account.icon_img ? (
                      <img src={account.icon_img.split('?')[0]} className="w-10 h-10 rounded-full border border-white/10 object-cover" alt="Avatar" />
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-white/10 bg-surface flex items-center justify-center text-primary font-bold">
                        {account.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface-container ${account.is_live ? 'bg-tertiary shadow-[0_0_5px_#4edea3]' : 'bg-error'}`} />
                  </div>
                  <div>
                    <span className="font-body-md text-body-md text-on-surface block truncate">u/{account.username}</span>
                    <span className="text-label-sm text-on-surface-variant/50">
                      {account.total_karma !== null && account.total_karma !== undefined
                        ? `${account.total_karma.toLocaleString()} Karma`
                        : <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-on-surface-variant/30 animate-pulse inline-block" />Loading...</span>
                      }
                    </span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <span className={`px-3 py-1 rounded-full border font-label-sm text-label-sm ${account.is_live ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'bg-error/10 text-error border-error/20'}`}>
                    {account.is_live ? 'Active' : 'Banned'}
                  </span>
                </div>

                <div className="hidden md:flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  <span className="text-label-md truncate">{new Date(account.last_checked).toLocaleDateString()}</span>
                </div>

                <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                  {/* Auto-track toggle */}
                  <button
                    onClick={() => toggleAutoTrack(account.username)}
                    title={account.auto_track ? 'Auto-track ON: new posts/comments tracked automatically' : 'Auto-track OFF: click to enable'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-label-sm font-label-sm border transition-all ${
                      account.auto_track
                        ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                        : 'bg-white/5 text-on-surface-variant/50 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{account.auto_track ? 'bolt' : 'bolt'}</span>
                    <span className="hidden md:inline">{account.auto_track ? 'Auto' : 'Auto'}</span>
                  </button>
                  <button 
                    onClick={() => handleDelete(account.username)}
                    className="material-symbols-outlined p-2 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition-colors"
                  >
                    delete
                  </button>
                  <span className={`material-symbols-outlined text-on-surface-variant/40 md:hidden transition-transform ${expandedRow === account.username ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedRow === account.username && (
                <div className="bg-surface-container-low/50">
                  <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8 border-t border-white/5">
                    <div>
                      <h4 className="font-label-sm text-label-sm text-primary uppercase mb-4 tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">article</span>
                        Recent Posts
                      </h4>
                      <div className="space-y-4">
                        {!account.reddit_data ? (
                          <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">
                            Fetching live data...
                          </div>
                        ) : !account.reddit_data?.recent_posts?.length ? (
                          <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">
                            No posts found.
                          </div>
                        ) : (
                          account.reddit_data.recent_posts.map((post, idx) => {
                            const isTracked = (account.posts || []).some(p => p.url === post.url);
                            return (
                              <div key={idx} className={`p-3 rounded-lg border transition-colors ${isTracked ? 'bg-white/5 border-white/5' : 'bg-primary/5 border-primary/20'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <a href={post.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0">
                                    <p className="text-body-md text-on-surface line-clamp-1 hover:text-primary transition-colors">{post.title}</p>
                                    <span className="text-label-sm text-on-surface-variant/40">{post.ups} upvotes</span>
                                  </a>
                                  {!isTracked && (
                                    <button
                                      onClick={() => quickTrackItem(post.url, 'posts', account.username)}
                                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-on-primary text-label-sm font-label-sm hover:bg-primary/80 transition-colors animate-pulse-subtle"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">add</span>
                                      NEW
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-label-sm text-label-sm text-secondary uppercase mb-4 tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">comment</span>
                        Recent Comments
                      </h4>
                      <div className="space-y-4">
                        {!account.reddit_data ? (
                          <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">
                            Fetching live data...
                          </div>
                        ) : !account.reddit_data?.recent_comments?.length ? (
                          <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">
                            No comments found.
                          </div>
                        ) : (
                          account.reddit_data.recent_comments.map((comment, idx) => {
                            const isTracked = (account.comments || []).some(c => c.url === comment.url);
                            return (
                              <div key={idx} className={`p-3 rounded-lg border transition-colors ${isTracked ? 'bg-white/5 border-white/5' : 'bg-secondary/5 border-secondary/20'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <a href={comment.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0">
                                    <p className="text-label-md text-on-surface italic line-clamp-2 hover:text-secondary transition-colors">"{comment.body}"</p>
                                    <span className="text-label-sm text-on-surface-variant/40">{comment.ups} upvotes</span>
                                  </a>
                                  {!isTracked && (
                                    <button
                                      onClick={() => quickTrackItem(comment.url, 'comments', account.username)}
                                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-on-secondary text-label-sm font-label-sm hover:bg-secondary/80 transition-colors animate-pulse-subtle"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">add</span>
                                      NEW
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Table Footer */}
        <div className="px-8 py-4 bg-white/5 flex items-center justify-between">
          <span className="text-label-sm text-on-surface-variant/40 uppercase tracking-widest">Showing {accounts.length} accounts</span>
          <div className="flex items-center gap-2 text-label-sm text-on-surface-variant/40">
            <span className="material-symbols-outlined text-[14px] animate-spin" style={{animationDuration: '3s'}}>refresh</span>
            <span>Refreshing in <span className="text-primary font-mono">{formatCountdown(secondsUntilRefresh)}</span></span>
            <button onClick={fetchAccounts} className="ml-2 text-primary hover:text-primary/70 text-label-sm underline">Refresh now</button>
          </div>
        </div>
      </div>

      {/* Bulk Track Accounts Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-headline-md text-on-surface">Bulk Track Accounts</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={submitBulkAccounts}>
              <div className="mb-6">
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-2">Reddit Usernames (one per line or comma-separated)</label>
                <textarea 
                  required
                  rows="4"
                  placeholder="username1&#10;username2" 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
                  value={bulkUsernames}
                  onChange={(e) => setBulkUsernames(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingBulk}
                  className="px-5 py-2.5 rounded-lg text-label-md font-label-md bg-primary text-on-primary hover:neon-glow-blue transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingBulk && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  {isSubmittingBulk ? 'Tracking...' : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
