import { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import LiveDelta from '../components/LiveDelta';

export default function TrackedItems({ type }) {
  const queryClient = useQueryClient();
  const [expandedRow, setExpandedRow] = useState(null);
  const [itemDetails, setItemDetails] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trackUrl, setTrackUrl] = useState('');
  
  const parentRef = useRef(null);

  const isPosts = type === 'posts';
  const apiEndpoint = isPosts ? (import.meta.env.VITE_API_URL || "http://localhost:8000") + '/api/tracked/posts' : (import.meta.env.VITE_API_URL || "http://localhost:8000") + '/api/tracked/comments';
  const queryKey = ['tracked_items', type];

  const getDisplayName = (item, isPosts) => {
    if (!isPosts && item.body) {
      return `"${item.body.length > 80 ? item.body.slice(0, 80) + '…' : item.body}"`;
    }
    try {
      const urlObj = new URL(item.url);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      const titlePart = parts.length >= 5 ? parts[4] : '';
      const formattedTitle = titlePart ? titlePart.replace(/_/g, ' ') : item.url;
      return isPosts ? formattedTitle : `Comment on ${formattedTitle}`;
    } catch {
      return item.url;
    }
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`${apiEndpoint}?page=${pageParam}&per_page=50`);
      if (!res.ok) throw new Error('Network error');
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined;
    },
    refetchInterval: 60000,
  });

  const { data: queueStatus } = useQuery({
    queryKey: ['queue_status'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/queue/status`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const items = data ? data.pages.flatMap(page => page.items) : [];

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? items.length + 1 : items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => expandedRow ? 300 : 80,
    overscan: 10,
  });

  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
    if (!lastItem) return;
    if (lastItem.index >= items.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, items.length, isFetchingNextPage, rowVirtualizer.getVirtualItems()]);

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${apiEndpoint}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete ${isPosts ? 'post' : 'comment'}`);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            items: page.items.filter(item => item.id !== id)
          }))
        };
      });
      return { previousData };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(queryKey, context.previousData);
      alert(err.message);
    }
  });

  const trackBulkMutation = useMutation({
    mutationFn: async (urls) => {
      const res = await fetch(`${apiEndpoint}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Failed to track ${isPosts ? 'posts' : 'comments'}`);
      return data;
    },
    onSuccess: (data) => {
      if (data.failed > 0) {
        alert(`Successfully added ${data.added} items. Failed ${data.failed} items:\n\n${data.errors.join('\\n')}`);
      }
      setIsModalOpen(false);
      setTrackUrl('');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => alert(err.message)
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiEndpoint}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to sync items");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue_status'] });
    },
    onError: (err) => alert(err.message)
  });

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

  const exportData = (format) => {
    if (!items.length) return;
    let dataStr, mimeType, filename;
    
    if (format === 'json') {
      const exportable = items.map(i => ({
        url: i.url,
        title_or_body: getDisplayName(i, isPosts),
        ups: i.ups,
        status: i.is_live ? 'Active' : 'Inactive',
        last_synced: i.last_synced_at || i.last_checked
      }));
      dataStr = JSON.stringify(exportable, null, 2);
      mimeType = 'application/json';
      filename = `tracked_${type}.json`;
    } else {
      const header = `URL,Content,Upvotes,Status,LastSynced\n`;
      const rows = items.map(i => 
        `"${i.url}","${getDisplayName(i, isPosts).replace(/"/g, '""')}",${i.ups || 0},${i.is_live ? 'Active' : 'Inactive'},${i.last_synced_at || i.last_checked}`
      ).join("\n");
      dataStr = header + rows;
      mimeType = 'text/csv';
      filename = `tracked_${type}.csv`;
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

  const submitTrackUrl = (e) => {
    e.preventDefault();
    if (!trackUrl) return;
    const urls = trackUrl.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length > 0) {
      trackBulkMutation.mutate(urls);
    }
  };

  if (status === 'pending') return <div className="p-12 text-on-surface">Loading {type}...</div>;
  if (status === 'error') return <div className="p-12 text-error">{error.message}</div>;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-4 mb-1">
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Tracked {isPosts ? 'Posts' : 'Comments'}
            </h2>
            {queueStatus?.status === 'processing' && (
              <span className="flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-label-sm">
                <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                Syncing {queueStatus.active + queueStatus.queued} items...
              </span>
            )}
          </div>
          <p className="text-on-surface-variant font-body-md">Monitoring real-time activity across selected Reddit threads.</p>
        </div>
        <div className="flex gap-4">
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
          <button onClick={() => syncAllMutation.mutate()} disabled={queueStatus?.status === 'processing' || syncAllMutation.isPending} className={`bg-surface-container hover:bg-white/10 text-on-surface px-5 py-2.5 rounded-lg font-label-md transition-all flex items-center gap-2 ${queueStatus?.status === 'processing' || syncAllMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <span className={`material-symbols-outlined ${queueStatus?.status === 'processing' || syncAllMutation.isPending ? 'animate-spin' : ''}`}>sync</span>
            {queueStatus?.status === 'processing' || syncAllMutation.isPending ? 'Syncing...' : 'Sync All'}
          </button>
          <button onClick={() => { setIsModalOpen(true); setTrackUrl(''); }} className="bg-primary hover:neon-glow-purple text-on-primary px-5 py-2.5 rounded-lg font-label-md transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            Track New {isPosts ? 'Post' : 'Comment'}
          </button>
        </div>
      </div>

      <div className="bg-surface-container/50 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden mb-12 flex flex-col h-[70vh]">
        <div className="hidden md:grid grid-cols-[1.5fr_1fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-4 px-6 py-4 border-b border-white/5 bg-white/5 shrink-0">
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant/60">{isPosts ? 'Post Title' : 'Comment Content'}</span>
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant/60">Context</span>
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant/60 text-center">URL</span>
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant/60">Upvotes</span>
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant/60">Status</span>
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant/60 text-right">Actions</span>
        </div>

        <div ref={parentRef} className="flex-1 overflow-auto divide-y divide-white/5">
          {items.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">No {type} tracked for this user in your system.</div>
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const isLoaderRow = virtualRow.index > items.length - 1;
                const item = items[virtualRow.index];
                const isExpanded = expandedRow === item?.id;

                if (isLoaderRow) {
                  return (
                    <div key="loader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }} className="p-8 text-center text-on-surface-variant flex justify-center items-center gap-2">
                      <span className="material-symbols-outlined animate-spin">refresh</span> Loading more...
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="group transition-all absolute top-0 left-0 w-full" style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
                    <div className={`grid grid-cols-2 md:grid-cols-[1.5fr_1fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-4 px-6 py-5 items-center cursor-pointer transition-colors ${isExpanded ? 'bg-white/5' : 'hover:bg-white/5'}`} onClick={() => toggleRow(item.id, item.url)}>
                      <div className="font-body-sm text-on-surface font-medium truncate overflow-hidden">
                        {getDisplayName(item, isPosts)}
                      </div>
                      
                      <div className="flex flex-col gap-1 overflow-hidden shrink-0">
                        <span className="text-body-sm text-on-surface truncate">u/{(itemDetails[item.id]?.author || item.account?.username)?.replace('u/', '')}</span>
                        {(itemDetails[item.id]?.subreddit || item.subreddit) && (
                          <span className="text-label-sm text-on-surface-variant truncate">r/{(itemDetails[item.id]?.subreddit || item.subreddit)?.replace('r/', '')}</span>
                        )}
                      </div>
                      
                      <div className="text-center shrink-0 hidden md:block">
                        <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary/60 hover:text-primary transition-all">
                          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                        </a>
                      </div>
                      
                      <div className="shrink-0 hidden md:flex items-center">
                        <span className="flex items-center gap-1 font-label-sm text-primary">
                          <span className="material-symbols-outlined text-[16px]">arrow_upward</span> 
                          <LiveDelta current={item.ups} previous={item.previous_score} />
                        </span>
                      </div>
                      
                      <div className="shrink-0 hidden md:flex items-center">
                        <span className={`px-3 py-1 rounded-full text-label-sm ${item.is_live ? 'bg-tertiary-container/20 text-tertiary border border-tertiary/30' : 'bg-error/10 text-error border-error/20'}`}>
                          {item.is_live ? 'Active' : 'Deleted/Removed'}
                        </span>
                      </div>
                      
                      <div className="flex justify-end items-center gap-2 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Stop tracking?')) deleteMutation.mutate(item.id); }} className="text-on-surface-variant/40 hover:text-error transition-all p-2 rounded-lg hover:bg-error/10">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                        <span className={`material-symbols-outlined text-on-surface-variant/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="bg-surface-container/30 border-t border-white/5 p-6 h-full">
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-2">Reddit URLs (one per line or comma-separated)</label>
                <textarea 
                  required
                  rows="4"
                  placeholder="https://www.reddit.com/r/...&#10;https://www.reddit.com/r/..." 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-white/5 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={trackBulkMutation.isPending} className="px-5 py-2.5 rounded-lg text-label-md font-label-md bg-primary text-on-primary hover:neon-glow-blue transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2">
                  {trackBulkMutation.isPending && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  {trackBulkMutation.isPending ? 'Tracking...' : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
