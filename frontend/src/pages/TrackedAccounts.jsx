import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function TrackedAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchAccounts = () => {
    fetch((import.meta.env.VITE_API_URL || "http://localhost:8000") + '/api/accounts', { cache: 'no-store' })
      .then((res) => res.json())
      .then(data => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch accounts:", err);
        setError("Failed to connect to API");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

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
      // Fetch live details if we haven't already fetched it
      const account = accounts.find(a => a.username === username);
      if (!account.reddit_data) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/${username}`);
          if (res.ok) {
            const data = await res.json();
            setAccounts(prev => prev.map(a => 
              a.username === username ? { ...a, reddit_data: data.reddit_data } : a
            ));
          }
        } catch (err) {
          console.error("Failed to fetch detailed data for account:", err);
        }
      }
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
        <Link to="/accounts" className="flex items-center justify-center gap-2 bg-linear-to-r from-primary to-primary-container text-white px-6 py-3 rounded-xl font-label-md text-label-md hover:shadow-[0_0_20px_rgba(77,142,255,0.4)] transition-all active:scale-95">
          <span className="material-symbols-outlined">person_add</span>
          Track New Account
        </Link>
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
                    {account.reddit_data?.icon_img ? (
                      <img src={account.reddit_data.icon_img.split('?')[0]} className="w-10 h-10 rounded-full border border-white/10 object-cover" alt="Avatar" />
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
                      {account.reddit_data?.total_karma !== undefined ? `${account.reddit_data.total_karma.toLocaleString()} Karma` : 'Karma Loading...'}
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

                <div className="flex justify-end gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(account.username); }}
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
                          account.reddit_data.recent_posts.map((post, idx) => (
                            <a href={post.url} target="_blank" rel="noreferrer" key={idx} className="block p-3 rounded-lg bg-white/5 border border-white/5 hover:border-primary/30 transition-colors">
                              <p className="text-body-md text-on-surface line-clamp-1">{post.title}</p>
                              <span className="text-label-sm text-on-surface-variant/40">{post.ups} upvotes</span>
                            </a>
                          ))
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
                          account.reddit_data.recent_comments.map((comment, idx) => (
                            <a href={comment.url} target="_blank" rel="noreferrer" key={idx} className="block p-3 rounded-lg bg-white/5 border border-white/5 hover:border-secondary/30 transition-colors">
                              <p className="text-label-md text-on-surface italic line-clamp-2">"{comment.body}"</p>
                              <span className="text-label-sm text-on-surface-variant/40">{comment.ups} upvotes</span>
                            </a>
                          ))
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
        </div>
      </div>
    </>
  );
}
