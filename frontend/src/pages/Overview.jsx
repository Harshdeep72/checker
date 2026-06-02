import { useState, useEffect } from 'react';

export default function Overview() {
  const [stats, setStats] = useState({
    accounts: { total: 0, live: 0, banned: 0 },
    posts: { total: 0, live: 0 },
    comments: { total: 0, live: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch((import.meta.env.VITE_API_URL || "http://localhost:8000") + '/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch stats:", err);
        setError("Failed to connect to API");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-on-surface p-12">Loading analytics...</div>;
  if (error) return <div className="text-error p-12">{error}</div>;

  return (
    <>
      {/* Hero Section: Statistics Grid */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Network Pulse</h2>
            <p className="font-body-md text-on-surface-variant">Real-time surveillance across tracked subreddits and entities.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => alert('Report exporting is being processed. It will be available shortly.')} className="bg-primary hover:neon-glow-blue text-on-primary px-6 py-2 rounded-lg font-label-md text-label-md transition-all active:scale-95 cursor-pointer">
              Export Report
            </button>
            <button className="glass-card hover:bg-white/10 text-primary px-4 py-2 rounded-lg transition-all cursor-pointer" onClick={() => window.location.reload()}>
              <span className="material-symbols-outlined align-middle">refresh</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {/* Stat Card 1 */}
          <div className="glass-card p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary stat-glow rounded-full" />
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-widest">Tracked Accounts</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg text-primary">{stats.accounts.total}</span>
            </div>
            <div className="mt-4 flex items-center text-tertiary text-xs">
              <span className="material-symbols-outlined text-sm mr-1">trending_up</span>
              <span>Total accounts tracked</span>
            </div>
          </div>
          {/* Stat Card 2 */}
          <div className="glass-card p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-tertiary stat-glow rounded-full" />
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-widest">Live Accounts</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg text-tertiary">{stats.accounts.live}</span>
              <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_#4edea3]" />
            </div>
            <div className="mt-4 flex items-center text-on-surface-variant text-xs">
              <span className="material-symbols-outlined text-sm mr-1">sensors</span>
              <span>Active monitoring enabled</span>
            </div>
          </div>
          {/* Stat Card 3 */}
          <div className="glass-card p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-error stat-glow rounded-full opacity-50" />
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-widest">Banned Accounts</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg text-error">{stats.accounts.banned}</span>
            </div>
            <div className="mt-4 flex items-center text-error text-xs">
              <span className="material-symbols-outlined text-sm mr-1">warning</span>
              <span>{((stats.accounts.banned / (stats.accounts.total || 1)) * 100).toFixed(1)}% ban rate</span>
            </div>
          </div>
          {/* Stat Card 4 */}
          <div className="glass-card p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-secondary stat-glow rounded-full" />
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-widest">Tracked Posts</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg text-secondary">{stats.posts.total}</span>
            </div>
            <div className="mt-4 flex items-center text-secondary text-xs">
              <span className="material-symbols-outlined text-sm mr-1">add_circle</span>
              <span>{stats.posts.live} live</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Layout: Activity & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Activity Feed */}
        <section className="lg:col-span-8">
          <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h3 className="font-headline-md text-headline-md">Live Activity Stream</h3>
              <span className="px-3 py-1 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold uppercase tracking-widest">Real-time</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[600px] scrollbar-hide">
              <div className="p-12 text-center text-on-surface-variant italic">
                Connect websocket to stream live updates here...
              </div>
            </div>
          </div>
        </section>

        {/* Secondary Content: Quick Actions & Visual */}
        <section className="lg:col-span-4 space-y-gutter">
          {/* Search Card */}
          <div className="glass-card p-6 rounded-2xl neon-glow-blue border-primary/20">
            <h3 className="font-label-md text-label-md text-primary uppercase mb-4 tracking-widest">Rapid Lookup</h3>
            <div className="relative">
              <input className="w-full bg-black/20 border border-white/10 rounded-lg py-3 pl-12 pr-4 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all" placeholder="Search accounts..." type="text" />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            </div>
          </div>
          {/* Visualization Card */}
          <div className="glass-card rounded-2xl overflow-hidden aspect-square flex flex-col relative group">
            <div className="w-full h-full bg-linear-to-tr from-primary/20 to-tertiary/20 absolute inset-0 mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h4 className="font-headline-md text-headline-md mb-2">Network Health</h4>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[94%] shadow-[0_0_8px_#adc6ff]" />
                </div>
                <span className="font-label-sm text-label-sm">94% Stable</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
