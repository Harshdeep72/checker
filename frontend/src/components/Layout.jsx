import { NavLink } from 'react-router-dom';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col md:flex-row">
      
      {/* HEADER (Mobile & Desktop) */}
      <header className="fixed top-0 w-full flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 z-40 backdrop-blur-xl border-b border-white/10 bg-surface-container-low/50 dark:bg-surface-container-low/50 shadow-none">
        <div className="flex items-center gap-3 md:pl-[240px]">
          <span className="material-symbols-outlined text-primary">monitoring</span>
          <h1 className="font-headline-md text-headline-md font-bold text-primary">Stealth Checker</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors active:scale-95 duration-200">
            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          </button>
          <div className="h-8 w-8 rounded-full overflow-hidden border border-white/20 bg-primary/20">
            <span className="material-symbols-outlined text-primary m-1">person</span>
          </div>
        </div>
      </header>

      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col py-6 z-50 fixed left-0 top-0 h-full w-[240px] backdrop-blur-xl border-r border-white/10 bg-surface-container-low/50 dark:bg-surface-container-low/50 shadow-none">
        <div className="px-6 mb-10 mt-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">monitoring</span>
          </div>
          <div>
            <p className="font-label-md text-label-md text-primary font-bold">Admin Monitor</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Pro Analyst</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink to="/" className={({isActive}) => `flex items-center px-6 py-3 cursor-pointer transition-all hover:bg-white/5 ${isActive ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined mr-4">dashboard</span>
            <span className="font-label-md text-label-md">Overview</span>
          </NavLink>
          <NavLink to="/accounts" className={({isActive}) => `flex items-center px-6 py-3 cursor-pointer transition-all hover:bg-white/5 ${isActive ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined mr-4">person_search</span>
            <span className="font-label-md text-label-md">Account Lookup</span>
          </NavLink>
          <NavLink to="/accounts-directory" className={({isActive}) => `flex items-center px-6 py-3 cursor-pointer transition-all hover:bg-white/5 ${isActive ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined mr-4">group</span>
            <span className="font-label-md text-label-md">Tracked Accounts</span>
          </NavLink>
          <NavLink to="/posts" className={({isActive}) => `flex items-center px-6 py-3 cursor-pointer transition-all hover:bg-white/5 ${isActive ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined mr-4">article</span>
            <span className="font-label-md text-label-md">Tracked Posts</span>
          </NavLink>
          <NavLink to="/comments" className={({isActive}) => `flex items-center px-6 py-3 cursor-pointer transition-all hover:bg-white/5 ${isActive ? 'text-primary bg-primary/10 border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined mr-4">forum</span>
            <span className="font-label-md text-label-md">Tracked Comments</span>
          </NavLink>
        </nav>
      </aside>

      {/* MOBILE NAV (Bottom) */}
      <nav className="md:hidden fixed bottom-0 w-full flex justify-around items-center h-16 z-50 backdrop-blur-xl border-t border-white/10 bg-surface-container-low/80 dark:bg-surface-container-low/80">
        <NavLink to="/" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">dashboard</span>
        </NavLink>
        <NavLink to="/accounts" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">person_search</span>
        </NavLink>
        <NavLink to="/accounts-directory" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">group</span>
        </NavLink>
        <NavLink to="/posts" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">article</span>
        </NavLink>
        <NavLink to="/comments" className={({isActive}) => `flex flex-col items-center justify-center w-full h-full ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">forum</span>
        </NavLink>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full pt-16 pb-20 md:pb-0 md:ml-[240px]">
        <div className="p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto space-y-gutter">
          {children}
        </div>
      </main>

    </div>
  );
}
