import { useEffect, useRef, useState } from "react";

/**
 * Progressive renderer: returns a slice of `items` that grows as the user
 * approaches the sentinel. Resets to `pageSize` whenever `items` reference
 * (or `resetKey`) changes — useful when filters/search alter the underlying list.
 */
export function useInfiniteSlice<T>(
  items: T[],
  opts: { pageSize?: number; resetKey?: string } = {}
) {
  const pageSize = opts.pageSize ?? 24;
  const [count, setCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset window when source data or filter key changes
  useEffect(() => {
    setCount(pageSize);
  }, [items, opts.resetKey, pageSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(c + pageSize, items.length));
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [items.length, pageSize]);

  const visible = items.slice(0, count);
  const hasMore = count < items.length;

  return { visible, hasMore, sentinelRef, total: items.length, shown: visible.length };
}
