import { useEffect, useState } from 'react';

export default function LiveDelta({ current, previous, type = 'number' }) {
  const [highlight, setHighlight] = useState('');

  useEffect(() => {
    if (previous !== null && previous !== undefined && current !== previous) {
      if (current > previous) {
        setHighlight('text-tertiary font-bold transition-all');
      } else {
        setHighlight('text-error font-bold transition-all');
      }
      const timer = setTimeout(() => setHighlight(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [current, previous]);

  if (current === null || current === undefined) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-on-surface-variant/30 animate-pulse inline-block" />
        Pending Sync
      </span>
    );
  }

  const displayValue = type === 'number' ? current.toLocaleString() : current;
  let delta = null;
  if (previous !== null && previous !== undefined && current !== previous && type === 'number') {
    const diff = current - previous;
    delta = (
      <span className={`text-[0.75em] ml-1 ${diff > 0 ? 'text-tertiary' : 'text-error'}`}>
        {diff > 0 ? '+' : ''}{diff}
      </span>
    );
  }

  return (
    <span className={`transition-colors duration-500 ${highlight}`}>
      {displayValue} {delta}
    </span>
  );
}
