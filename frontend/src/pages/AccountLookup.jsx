import { useState } from 'react';

export default function AccountLookup() {
  const [username, setUsername] = useState('');
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError(null);
    setAccount(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/${username}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error("Account not found");
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to fetch account details");
      }
      const data = await response.json();
      setAccount(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Stop tracking u/${account.username} and remove from database?`)) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/accounts/${account.username}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Failed to delete account");
        setAccount(null);
        setUsername('');
      } catch(err) {
        alert(err.message);
      }
    }
  };

  return (
    <>
      <div className="max-w-container-max mx-auto space-y-gutter">
        {/* Search Section */}
        <section className="relative z-10">
          <form onSubmit={handleSearch} className="bg-surface-container-low/50 backdrop-blur-xl border border-white/10 rounded-xl p-4 md:p-6 shadow-none">
            <div className="relative group flex gap-2">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
              <input
                className="flex-1 bg-black/20 border border-white/10 rounded-lg py-4 pl-12 pr-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-body-lg placeholder:text-on-surface-variant/50"
                placeholder="Search Reddit username..."
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <button type="submit" disabled={loading} className="bg-primary text-on-primary px-8 rounded-lg font-bold hover:scale-[1.02] active:scale-95 transition-all">
                {loading ? '...' : 'Search'}
              </button>
            </div>
            {error && <div className="mt-4 text-error font-label-md px-4">{error}</div>}
          </form>
        </section>

        {/* Profile Card */}
        {account && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/10 rounded-xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
                <div className="relative">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-primary/20 p-1 flex items-center justify-center bg-surface">
                    {account.reddit_data?.icon_img ? (
                      <img alt="Avatar" className="w-full h-full rounded-full object-cover" src={account.reddit_data.icon_img.split('?')[0]} />
                    ) : (
                      <span className="text-4xl text-primary font-bold">{account.username.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className={`absolute bottom-1 right-1 px-3 py-1 rounded-full border shadow-lg flex items-center gap-1.5 ${account.is_live ? 'bg-surface-container-highest border-tertiary' : 'bg-surface-container-highest border-error'}`}>
                    <span className={`w-2 h-2 rounded-full ${account.is_live ? 'bg-tertiary animate-pulse shadow-[0_0_8px_#4edea3]' : 'bg-error'}`} />
                    <span className={`text-[10px] font-bold tracking-widest ${account.is_live ? 'text-tertiary' : 'text-error'}`}>
                      {account.is_live ? 'LIVE' : 'BANNED'}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-4">
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface">u/{account.username}</h1>
                    <p className="text-on-surface-variant font-label-md">Updated: {new Date(account.last_checked).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4">
                    <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                      <p className="text-on-surface-variant font-label-sm uppercase">Total Karma</p>
                      <p className="font-headline-md text-primary">{account.reddit_data?.total_karma?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                      <p className="text-on-surface-variant font-label-sm uppercase">Created</p>
                      <p className="font-headline-md text-on-surface">
                        {account.reddit_data?.created_utc ? new Date(account.reddit_data.created_utc * 1000).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col gap-3">
                  <a href={`https://reddit.com/user/${account.username}`} target="_blank" rel="noreferrer" className="px-6 py-2 bg-linear-to-r from-primary to-primary-container text-on-primary font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-all text-center">
                    View on Reddit
                  </a>
                  <button onClick={handleDelete} className="px-6 py-2 border border-error/50 text-error font-bold rounded-lg hover:bg-error/10 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Untrack
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Activity Columns */}
        {account && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            {/* Column 1: Recent Posts */}
            <section className="bg-surface-container-low/50 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">article</span>
                  <h2 className="font-headline-md text-on-surface">Recent Posts</h2>
                </div>
                <span className="text-primary font-label-sm bg-primary/10 px-2 py-0.5 rounded">{account.reddit_data?.recent_posts?.length || 0} found</span>
              </div>
              <div className="p-4 space-y-3">
                {!account.reddit_data?.recent_posts?.length ? (
                  <p className="text-on-surface-variant text-center py-4">No recent posts</p>
                ) : (
                  account.reddit_data.recent_posts.map((post, idx) => (
                    <a href={post.url} target="_blank" rel="noreferrer" key={post.id || idx} className="block p-4 bg-white/5 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/8 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-primary font-label-sm truncate">ID: {post.id}</span>
                      </div>
                      <h3 className="font-body-md text-on-surface group-hover:text-primary transition-colors mb-2 line-clamp-2">{post.title}</h3>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1 text-on-surface-variant font-label-sm">
                          <span className="material-symbols-outlined text-xs">thumb_up</span> {post.ups}
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </section>

            {/* Column 2: Recent Comments */}
            <section className="bg-surface-container-low/50 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">forum</span>
                  <h2 className="font-headline-md text-on-surface">Recent Comments</h2>
                </div>
                <span className="text-primary font-label-sm bg-primary/10 px-2 py-0.5 rounded">{account.reddit_data?.recent_comments?.length || 0} found</span>
              </div>
              <div className="p-4 space-y-4">
                {!account.reddit_data?.recent_comments?.length ? (
                  <p className="text-on-surface-variant text-center py-4">No recent comments</p>
                ) : (
                  account.reddit_data.recent_comments.map((comment, idx) => (
                    <div key={comment.id || idx} className="relative pl-4 border-l-2 border-primary/30 py-1 hover:border-primary transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <a href={comment.url} target="_blank" rel="noreferrer" className="text-primary font-label-sm hover:underline cursor-pointer">
                          View Context
                        </a>
                      </div>
                      <p className="text-on-surface text-sm line-clamp-3">"{comment.body}"</p>
                      <div className="flex items-center gap-1 mt-1 text-on-surface-variant font-label-sm">
                        <span className="material-symbols-outlined text-[10px]">thumb_up</span> {comment.ups}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
