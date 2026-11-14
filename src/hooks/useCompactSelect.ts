import { useEffect, useState } from 'react';
import { SELECT_COMPACT_QUERY } from '../lib/selectOptions';

export function useCompactSelect(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(SELECT_COMPACT_QUERY).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(SELECT_COMPACT_QUERY);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}
