import { useState, useEffect, Fragment } from 'react';

export default function TrackedItems({ type }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trackUrl, setTrackUrl] = useState('');
  const [isTracking, setIsTracking] = useState(false);

  // Expandable Row State
  const [expandedRow, setExpandedRow] = useState(null);
  const [itemDetails, setItemDetails] = useState({});

  const isPosts = type === 'posts';
  const apiEndpoint = isPosts ? (import.meta.env.VITE_API_URL || "http://localhost:8000") + '/api/tracked/posts' : (import.meta.env.VITE_API_URL || "http://localhost:8000") + '/api/tracked/comments';
  
  const getDisplayName = (url, isPosts) => {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      const titlePart = parts.length >= 5 ? parts[4] : '';
      const formattedTitle = titlePart ? titlePart.replace(/_/g, ' ') : url;
      return isPosts ? formattedTitle : `Comment on ${formattedTitle}`;
    } catch {
      return url;
    }
  };

  const fetchItems = () => {
    fetch(apiEndpoint, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(`Failed to fetch ${type}:`, err);
        setError("Failed to connect to API");
        setLoading(false);
      });
  };

  const toggleRow = async (id, url) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
      if (!itemDetails[id]) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/external/post_details?url=${encodeURIComponent(url)}`);
          if (res.ok) {
            const data = await res.json();
            setItemDetails(prev => ({ ...prev, [id]: data }));
          }
        } catch (err) {
          console.error("Failed to fetch details:", err);
        }
      }
    }
  };

  useEffect(() => {
    fetchItems();
  }, [type]);

  const handleDelete = async (id) => {
    if (window.confirm(`Stop tracking this ${isPosts ? 'post' : 'comment'}?`)) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/tracked/${isPosts ? 'posts' : 'comments'}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Failed to delete ${isPosts ? 'post' : 'comment'}`);
        setItems(items => items.filter(item => item.id !== id));
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/tracked/${isPosts ? 'posts' : 'comments'}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error("Failed to sync items");
      fetchItems();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTrackNew = () => {
    setIsModalOpen(true);
    setTrackUrl('');
  };

  const submitTrackUrl = async (e) => {
    e.preventDefault();
    if (!trackUrl) return;
    setIsTracking(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/tracked/${isPosts ? 'posts' : 'comments'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trackUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Failed to track ${isPosts ? 'post' : 'comment'}`);
      
      setIsModalOpen(false);
      setTrackUrl('');
      fetchItems();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsTracking(false);
    }
  };

  if (loading) return <div className="p-12 text-on-surface">Loading {type}...</div>;
  if (error) return <div className="p-12 text-error">{error}</div>;

  return (
    <>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Tracked {isPosts ? 'Posts' : 'Comments'}
          </h2>
          <p className="text-on-surface-variant font-body-md">Monitoring real-time activity across selected Reddit threads.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handleSyncAll} disabled={isSyncing} className={`bg-surface-container hover:bg-white/10 text-on-surface px-5 py-2.5 rounded-lg font-label-md transition-all flex items-center gap-2 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <span className={`material-symbols-outlined ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </button>
          <button onClick={handleTrackNew} className="bg-primary hover:neon-glow-purple text-on-primary px-5 py-2.5 rounded-lg font-label-md transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            Track New {isPosts ? 'Post' : 'Comment'}
          </button>
        </div>
      </div>

      {/* Glassmorphic Data Container */}
      <div className="bg-surface-container/50 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden mb-12">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white/5 text-on-surface-variant font-label-sm border-b border-white/5">
                <th className="px-6 py-4 font-label-sm uppercase tracking-wider">{isPosts ? 'Post Title' : 'Comment Content'}</th>
                <th className="px-6 py-4 font-label-sm uppercase tracking-wider">Context</th>
                <th className="px-6 py-4 font-label-sm uppercase tracking-wider text-center">URL</th>
                <th className="px-6 py-4 font-label-sm uppercase tracking-wider">Upvotes</th>
                <th className="px-6 py-4 font-label-sm uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-label-sm uppercase tracking-wider text-right w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-on-surface-variant">
                    No {type} tracked for this user in your system.
                  </td>
                </tr>
              ) : items.map((item) => (
                <Fragment key={item.id}>
                  <tr 
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => toggleRow(item.id, item.url)}
                  >
                    <td className="px-6 py-5 font-body-sm text-on-surface font-medium max-w-[300px]">
                      {getDisplayName(item.url, isPosts)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-body-sm text-on-surface">u/{(itemDetails[item.id]?.author || item.account)?.replace('u/', '')}</span>
                        {(itemDetails[item.id]?.subreddit || item.subreddit) && (
                          <span className="text-label-sm text-on-surface-variant">r/{(itemDetails[item.id]?.subreddit || item.subreddit)?.replace('r/', '')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary/60 hover:text-primary transition-all">
                        <span className="material-symbols-outlined">open_in_new</span>
                      </a>
                    </td>
                    <td className="px-6 py-5">
                      <span className="flex items-center gap-1 font-label-sm text-primary">
                        <span className="material-symbols-outlined text-[16px]">arrow_upward</span> {itemDetails[item.id]?.ups !== undefined ? itemDetails[item.id].ups : (item.ups || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 rounded-full text-label-sm bg-tertiary-container/20 text-tertiary border border-tertiary/30">Active</span>
                    </td>
                    <td className="px-6 py-5 text-right flex justify-end items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-on-surface-variant/40 hover:text-error transition-all p-2 rounded-lg hover:bg-error/10">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                      <span className={`material-symbols-outlined text-on-surface-variant/40 transition-transform ${expandedRow === item.id ? 'rotate-180' : ''}`}>expand_more</span>
                    </td>
                  </tr>
                  
                  {expandedRow === item.id && (
                    <tr className="bg-surface-container/30 border-b border-white/5">
                      <td colSpan="6" className="px-6 py-6">
                        {!itemDetails[item.id] ? (
                          <div className="flex items-center justify-center p-4 text-on-surface-variant italic">
                            Fetching live details...
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            <div className="bg-black/20 p-4 rounded-lg font-body-md text-on-surface-variant whitespace-pre-wrap">
                              {itemDetails[item.id].body || "No text content."}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-white/5">
          {items.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">No {type} tracked in your system.</div>
          ) : items.map((item) => (
            <div key={item.id} className="p-4 flex flex-col gap-3 border-b border-white/5 cursor-pointer" onClick={() => toggleRow(item.id, item.url)}>
              <div className="flex justify-between items-start gap-2">
                <a className="font-body-lg font-bold text-primary hover:underline line-clamp-2 capitalize" onClick={(e) => e.stopPropagation()} href={item.url} target="_blank" rel="noreferrer">
                  {getDisplayName(item.url, isPosts)}
                </a>
                <div className="flex gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-error/70 hover:text-error p-1">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                  <button className="text-on-surface-variant/40 p-1 transition-transform" style={{ transform: expandedRow === item.id ? 'rotate(180deg)' : 'none' }}>
                    <span className="material-symbols-outlined">expand_more</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant text-label-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  {item.account ? `u/${item.account}` : 'Unknown'}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary border border-tertiary/30">Active</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="flex flex-col gap-1">
                  <span className="text-body-sm text-on-surface">u/{(itemDetails[item.id]?.author || item.account)?.replace('u/', '')}</span>
                  {(itemDetails[item.id]?.subreddit || item.subreddit) && (
                    <span className="text-label-sm text-on-surface-variant">r/{(itemDetails[item.id]?.subreddit || item.subreddit)?.replace('r/', '')}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 font-label-sm text-primary">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span> {itemDetails[item.id]?.ups !== undefined ? itemDetails[item.id].ups : (item.ups || 0)}
                </div>
              </div>
              
              {expandedRow === item.id && (
                <div className="mt-4 pt-4 border-t border-white/5 animate-fade-in-up">
                  {!itemDetails[item.id] ? (
                    <div className="flex items-center justify-center p-4 text-on-surface-variant italic text-label-sm">
                      Fetching live details...
                    </div>
                  ) : itemDetails[item.id].error ? (
                    <div className="text-error font-body-sm bg-error/10 p-3 rounded-md">
                      Error: {itemDetails[item.id].error}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="bg-black/20 p-3 rounded-lg font-body-sm text-on-surface-variant whitespace-pre-wrap">
                        {itemDetails[item.id].body || "No text content."}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decorative Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/10 p-6 rounded-xl flex items-center gap-6 overflow-hidden relative">
          <div className="z-10">
            <h3 className="font-headline-md text-primary mb-2">Network Health</h3>
            <p className="text-on-surface-variant font-body-md">Currently scanning subreddits for high-velocity signal patterns.</p>
          </div>
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
        </div>
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/10 p-6 rounded-xl flex items-center gap-6">
          <div className="w-12 h-12 rounded-lg bg-tertiary-container/30 flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-3xl">bolt</span>
          </div>
          <div>
            <h3 className="font-headline-md text-tertiary mb-1">99.9% Uptime</h3>
            <p className="text-on-surface-variant font-label-md">Real-time webhook ingestion operational.</p>
          </div>
        </div>
      </div>

      {/* Track New Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-headline-md text-on-surface">Track New {isPosts ? 'Post' : 'Comment'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={submitTrackUrl}>
              <div className="mb-6">
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-2">Reddit URL</label>
                <input 
                  type="url" 
                  required
                  placeholder="https://www.reddit.com/r/..." 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isTracking}
                  className="px-5 py-2.5 rounded-lg text-label-md font-label-md bg-primary text-on-primary hover:neon-glow-blue transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isTracking && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  {isTracking ? 'Tracking...' : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
