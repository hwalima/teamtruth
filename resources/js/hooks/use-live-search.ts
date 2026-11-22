import { useEffect, useRef } from 'react';

/**
 * Runs `search` shortly after the user stops typing, so results update as
 * they type. Nothing runs on the first render, only when `value` changes.
 *
 *     useLiveSearch(filters.data.search, () => apply());
 */
export function useLiveSearch(value: string | null | undefined, search: () => void, delay = 350) {
    const latest = useRef(search);
    latest.current = search;
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const timer = window.setTimeout(() => latest.current(), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);
}
