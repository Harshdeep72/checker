import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import LiveDelta from '../components/LiveDelta';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TrackedAccounts() {
  const queryClient = useQueryClient();
  const parentRef = useRef(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkUsernames, setBulkUsernames] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery({
    queryKey: ['tracked_accounts'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`${API_URL}/api/accounts?page=${pageParam}&per_page=50`);
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined;
    },
    refetchInterval: 60000, // Background poll every minute
  });

  const { data: queueStatus } = useQuery({
    queryKey: ['queue_status'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/queue/status`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const accounts = data ? data.pages.flatMap(page => page.items) : [];

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? accounts.length + 1 : accounts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (index >= accounts.length) return 80;
      return accounts[index]?.username === expandedRow ? 400 : 80;
    },
    overscan: 10,
  });

  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
    if (!lastItem) return;
    if (lastItem.index >= accounts.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, accounts.length, isFetchingNextPage, rowVirtualizer.getVirtualItems()]);

  const deleteMutation = useMutation({
    mutationFn: async (username) => {
      const res = await fetch(`${API_URL}/api/accounts/${username}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete account");
      return username;
    },
    onMutate: async (username) => {
      await queryClient.cancelQueries({ queryKey: ['tracked_accounts'] });
      const previousData = queryClient.getQueryData(['tracked_accounts']);
      queryClient.setQueryData(['tracked_accounts'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items.filter(acc => acc.username !== username)
          }))
        };
      });
      return { previousData };
    },
    onError: (err, username, context) => {
      queryClient.setQueryData(['tracked_accounts'], context.previousData);
      alert(err.message);
    }
  });

  const bulkTrackMutation = useMutation({
    mutationFn: async (usernames) => {
      const res = await fetch(`${API_URL}/api/accounts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to bulk track accounts");
      return data;
    },
    onSuccess: (data) => {
      if (data.failed > 0) {
        alert(`Successfully added ${data.added} accounts. Failed ${data.failed} accounts:\n\n${data.errors.join('\n')}`);
      }
      setIsBulkModalOpen(false);
      setBulkUsernames('');
      queryClient.invalidateQueries({ queryKey: ['tracked_accounts'] });
    },
    onError: (err) => alert(err.message)
  });

  const toggleAutoTrackMutation = useMutation({
    mutationFn: async (username) => {
      const res = await fetch(`${API_URL}/api/accounts/${username}/auto_track`, { method: 'PATCH' });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onMutate: async (username) => {
      await queryClient.cancelQueries({ queryKey: ['tracked_accounts'] });
      const previousData = queryClient.getQueryData(['tracked_accounts']);
      queryClient.setQueryData(['tracked_accounts'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items.map(acc => acc.username === username ? { ...acc, auto_track: !acc.auto_track } : acc)
          }))
        };
      });
      return { previousData };
    },
    onError: (err, username, context) => {
      queryClient.setQueryData(['tracked_accounts'], context.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tracked_accounts'] });
    }
  });

  const quickTrackMutation = useMutation({
    mutationFn: async ({ url, type }) => {
      const res = await fetch(`${API_URL}/api/tracked/${type}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] })
      });
      if (!res.ok) throw new Error("Failed to track item");
      return res.json();
    },
    onSuccess: () => {
      if (expandedRow) toggleRow(expandedRow, true);
    }
  });

  const toggleRow = async (username, force = false) => {
    if (expandedRow === username && !force) {
      setExpandedRow(null);
    } else {
      setExpandedRow(username);
      try {
        const res = await fetch(`${API_URL}/api/accounts/${username}`);
        if (res.ok) {
          const data = await res.json();
          queryClient.setQueryData(['tracked_accounts'], (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map(page => ({
                ...page,
                items: page.items.map(acc => 
                  acc.username === username ? { ...acc, reddit_data: data.reddit_data, posts: data.posts, comments: data.comments } : acc
                )
              }))
            };
          });
        }
      } catch (err) {
        console.error("Failed to fetch detailed data for account:", err);
      }
    }
  };

  const exportData = (format) => {
    if (!accounts.length) return;
    let dataStr, mimeType, filename;
    
    if (format === 'json') {
      const exportable = accounts.map(a => ({
        username: a.username,
        karma: a.total_karma,
        status: a.is_live ? 'Active' : 'Banned',
        auto_track: a.auto_track,
        last_synced: a.last_synced_at || a.last_checked
      }));
      dataStr = JSON.stringify(exportable, null, 2);
      mimeType = 'application/json';
      filename = 'tracked_accounts.json';
    } else {
      const header = "Username,Karma,Status,AutoTrack,LastSynced\n";
      const rows = accounts.map(a => 
        `${a.username},${a.total_karma || 0},${a.is_live ? 'Active' : 'Banned'},${a.auto_track},${a.last_synced_at || a.last_checked}`
      ).join("\n");
      dataStr = header + rows;
      mimeType = 'text/csv';
      filename = 'tracked_accounts.csv';
    }
    
    const blob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const submitBulkAccounts = (e) => {
    e.preventDefault();
    if (!bulkUsernames) return;
    const usernames = bulkUsernames.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.length > 0);
    if (usernames.length > 0) {
      bulkTrackMutation.mutate(usernames);
    }
  };

  if (status === 'pending') return <div className="p-12 text-on-surface">Loading accounts...</div>;
  if (status === 'error') return <div className="p-12 text-error">Failed to load accounts: {error.message}</div>;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <nav className="flex items-center gap-2 mb-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase">Dashboard</span>
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[16px]">chevron_right</span>
            <span className="font-label-sm text-label-sm text-primary uppercase">Accounts</span>
          </nav>
          <div className="flex items-center gap-4">
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Tracked Accounts</h1>
            {queueStatus?.status === 'processing' && (
              <span className="flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-label-sm">
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                Syncing {queueStatus.active + queueStatus.queued} items...
              </span>
            )}
          </div>
          <p className="text-on-surface-variant mt-2 max-w-xl">Manage your high-priority Reddit monitoring targets. Background syncing is active.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <button className="flex items-center justify-center gap-2 bg-surface-container border border-white/10 text-on-surface px-6 py-3 rounded-xl font-label-md text-label-md hover:bg-white/5 transition-all">
              <span className="material-symbols-outlined">download</span>
              Export
            </button>
            <div className="absolute right-0 top-full mt-2 w-32 bg-surface-container-high border border-white/10 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-lg">
              <button onClick={() => exportData('csv')} className="w-full text-left px-4 py-2 text-label-md hover:bg-white/5 text-on-surface">CSV</button>
              <button onClick={() => exportData('json')} className="w-full text-left px-4 py-2 text-label-md hover:bg-white/5 text-on-surface">JSON</button>
            </div>
          </div>
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

      <div className="bg-surface-container/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[70vh]">
        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.5fr] gap-4 px-8 py-4 border-b border-white/5 bg-white/5 shrink-0">
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase">Username</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase text-center">Status</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase">Last Synced</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase text-right">Actions</span>
        </div>

        <div ref={parentRef} className="flex-1 overflow-auto divide-y divide-white/5">
          {accounts.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">No accounts being tracked.</div>
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const isLoaderRow = virtualRow.index > accounts.length - 1;
                const account = accounts[virtualRow.index];
                const isExpanded = expandedRow === account?.username;

                if (isLoaderRow) {
                  return (
                    <div key="loader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }} className="p-8 text-center text-on-surface-variant flex justify-center items-center gap-2">
                      <span className="material-symbols-outlined animate-spin">refresh</span> Loading more...
                    </div>
                  );
                }

                return (
                  <div 
                    key={account.id} 
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="group transition-all absolute top-0 left-0 w-full" 
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className={`grid grid-cols-[auto_1fr_auto_auto] md:grid-cols-[1.5fr_1fr_1fr_auto] gap-4 px-6 md:px-8 py-5 items-center cursor-pointer transition-all ${isExpanded ? 'bg-white/5' : 'hover:bg-white/5'}`} onClick={() => toggleRow(account.username)}>
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="relative shrink-0">
                          {account.icon_img ? (
                            <img src={account.icon_img.split('?')[0]} className="w-10 h-10 rounded-full border border-white/10 object-cover" alt="Avatar" />
                          ) : (
                            <div className="w-10 h-10 rounded-full border border-white/10 bg-surface flex items-center justify-center text-primary font-bold">
                              {account.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface-container ${account.is_live ? 'bg-tertiary shadow-[0_0_5px_#4edea3]' : 'bg-error'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-body-md text-body-md text-on-surface block truncate">u/{account.username}</span>
                          <span className="text-label-sm text-on-surface-variant/50 block truncate max-w-full">
                            <LiveDelta current={account.total_karma} previous={account.previous_karma} /> Karma
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-center shrink-0">
                        <span className={`px-3 py-1 rounded-full border font-label-sm text-label-sm ${account.is_live ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'bg-error/10 text-error border-error/20'}`}>
                          {account.is_live ? 'Active' : 'Banned'}
                        </span>
                      </div>

                      <div className="hidden md:flex items-center gap-2 text-on-surface-variant shrink-0">
                        <span className="material-symbols-outlined text-[18px]">schedule</span>
                        <span className="text-label-md truncate">{new Date(account.last_synced_at || account.last_checked).toLocaleDateString()}</span>
                      </div>

                      <div className="flex justify-end items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleAutoTrackMutation.mutate(account.username)}
                          title={account.auto_track ? 'Auto-track ON' : 'Auto-track OFF'}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-label-sm font-label-sm border transition-all ${
                            account.auto_track ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25' : 'bg-white/5 text-on-surface-variant/50 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">bolt</span>
                          <span className="hidden md:inline">Auto</span>
                        </button>
                        <button 
                          onClick={() => { if(window.confirm(`Delete u/${account.username}?`)) deleteMutation.mutate(account.username) }}
                          className="material-symbols-outlined p-2 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition-colors"
                        >
                          delete
                        </button>
                        <span className={`material-symbols-outlined text-on-surface-variant/40 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                          expand_more
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-surface-container-low/50 w-full overflow-hidden">
                        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 border-t border-white/5">
                          <div className="flex-1 min-w-0 md:pr-4 md:border-r md:border-white/5">
                            <h4 className="font-label-sm text-label-sm text-primary uppercase mb-4 tracking-widest flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px]">article</span> Recent Posts
                            </h4>
                            <div className="space-y-4">
                              {!account.reddit_data ? (
                                <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">Fetching live data...</div>
                              ) : account.reddit_data.recent_posts?.length === 0 ? (
                                <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">No recent posts.</div>
                              ) : (
                                account.reddit_data.recent_posts?.map((post, idx) => {
                                  const isTracked = (account.posts || []).some(p => p.url === post.url);
                                  return (
                                    <div key={idx} className={`p-3 rounded-lg border transition-colors ${isTracked ? 'bg-white/5 border-white/5' : 'bg-primary/5 border-primary/20'}`}>
                                      <div className="flex items-start justify-between gap-3">
                                        <a href={post.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0">
                                          <p className="text-body-md text-on-surface line-clamp-2 hover:text-primary transition-colors">{post.title}</p>
                                          <span className="text-label-sm text-on-surface-variant/40">{post.ups} upvotes</span>
                                        </a>
                                        {!isTracked && (
                                          <button
                                            onClick={() => quickTrackMutation.mutate({ url: post.url, type: 'posts' })}
                                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-on-primary text-label-sm font-label-sm hover:bg-primary/80 transition-colors cursor-pointer"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">add</span>NEW
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0 md:pl-4">
                            <h4 className="font-label-sm text-label-sm text-secondary uppercase mb-4 tracking-widest flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px]">comment</span> Recent Comments
                            </h4>
                            <div className="space-y-4">
                              {!account.reddit_data ? (
                                <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">Fetching live data...</div>
                              ) : account.reddit_data.recent_comments?.length === 0 ? (
                                <div className="p-4 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant/60 italic">No recent comments.</div>
                              ) : (
                                account.reddit_data.recent_comments?.map((comment, idx) => {
                                  const isTracked = (account.comments || []).some(c => c.url === comment.url);
                                  return (
                                    <div key={idx} className={`p-3 rounded-lg border transition-colors ${isTracked ? 'bg-white/5 border-white/5' : 'bg-secondary/5 border-secondary/20'}`}>
                                      <div className="flex items-start justify-between gap-3">
                                        <a href={comment.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0">
                                          <p className="text-label-md text-on-surface italic line-clamp-3 hover:text-secondary transition-colors">"{comment.body}"</p>
                                          <span className="text-label-sm text-on-surface-variant/40">{comment.ups} upvotes</span>
                                        </a>
                                        {!isTracked && (
                                          <button
                                            onClick={() => quickTrackMutation.mutate({ url: comment.url, type: 'comments' })}
                                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-on-secondary text-label-sm font-label-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">add</span>NEW
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
                );
              })}
            </div>
          )}
        </div>
      </div>

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
                <button type="button" onClick={() => setIsBulkModalOpen(false)} className="px-5 py-2.5 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-white/5 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={bulkTrackMutation.isPending} className="px-5 py-2.5 rounded-lg text-label-md font-label-md bg-primary text-on-primary hover:neon-glow-blue transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2">
                  {bulkTrackMutation.isPending && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  {bulkTrackMutation.isPending ? 'Tracking...' : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
