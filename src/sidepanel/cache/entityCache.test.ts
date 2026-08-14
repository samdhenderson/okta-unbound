import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_ENTRIES,
  getOrFetch,
  invalidate,
  peek,
  peekEntry,
  peekFetchedAt,
  registerDerived,
  resetEntityCache,
  serializeKey,
  setEntry,
  subscribe,
} from './entityCache';

describe('entityCache', () => {
  beforeEach(() => {
    resetEntityCache();
    vi.useRealTimers();
  });

  describe('serializeKey', () => {
    it('joins composite keys without colliding on concatenation', () => {
      expect(serializeKey(['a', 'b'])).not.toBe(serializeKey(['ab']));
      expect(serializeKey('x')).toBe('x');
    });
  });

  describe('set / peek', () => {
    it('round-trips a fresh value', () => {
      setEntry(['groupMembers', 'g1'], [{ id: 'u1' }]);
      expect(peek(['groupMembers', 'g1'])).toEqual([{ id: 'u1' }]);
    });

    it('treats a value past its TTL as stale (peek → null, peekEntry → isFresh:false)', () => {
      vi.useFakeTimers();
      setEntry('k', 'v', { ttl: 1000 });
      vi.advanceTimersByTime(1500);
      expect(peek('k')).toBeNull();
      expect(peekEntry('k')).toEqual({
        data: 'v',
        isFresh: false,
        // Present since `PeekedEntry` gained a write timestamp; the exact epoch is
        // not what this case is about. `fetchedAt`'s own behaviour is covered below.
        fetchedAt: expect.any(Number),
      });
    });

    it('reports when the entry was written, without counting as a read', () => {
      vi.useFakeTimers();
      setEntry('k', 'v');
      const writtenAt = peekFetchedAt('k');
      expect(writtenAt).toEqual(expect.any(Number));
      expect(peekEntry('k')?.fetchedAt).toBe(writtenAt);

      // Staleness must not change the answer: "how old is this" is still
      // answerable once the TTL has lapsed.
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(peekFetchedAt('k')).toBe(writtenAt);

      expect(peekFetchedAt('never-written')).toBeNull();
    });
  });

  describe('getOrFetch de-duplication', () => {
    it('coalesces concurrent calls for the same key into one fetch', async () => {
      const fetcher = vi.fn().mockResolvedValue('result');
      const [a, b] = await Promise.all([getOrFetch('k', fetcher), getOrFetch('k', fetcher)]);
      expect(a).toBe('result');
      expect(b).toBe('result');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('serves a fresh cache hit without calling the fetcher', async () => {
      setEntry('k', 'cached');
      const fetcher = vi.fn().mockResolvedValue('fresh');
      expect(await getOrFetch('k', fetcher)).toBe('cached');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('does not cache rejections — a retry re-invokes the fetcher', async () => {
      const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
      await expect(getOrFetch('k', fetcher)).rejects.toThrow('boom');
      expect(await getOrFetch('k', fetcher)).toBe('ok');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('force bypasses a fresh entry and refetches', async () => {
      setEntry('k', 'cached');
      const fetcher = vi.fn().mockResolvedValue('fresh');
      expect(await getOrFetch('k', fetcher, { force: true })).toBe('fresh');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('removes an exact key without touching siblings', () => {
      setEntry(['groupMembers', 'g1'], 'a');
      setEntry(['groupMembers', 'g2'], 'b');
      invalidate(['groupMembers', 'g1']);
      expect(peek(['groupMembers', 'g1'])).toBeNull();
      expect(peek(['groupMembers', 'g2'])).toBe('b');
    });

    it('removes every entry under a prefix', () => {
      setEntry(['groupMembers', 'g1'], 'a');
      setEntry(['groupMembers', 'g2'], 'b');
      setEntry(['userDetails', 'u1'], 'c');
      invalidate(['groupMembers']);
      expect(peek(['groupMembers', 'g1'])).toBeNull();
      expect(peek(['groupMembers', 'g2'])).toBeNull();
      expect(peek(['userDetails', 'u1'])).toBe('c');
    });
  });

  describe('registerDerived', () => {
    it('drops a derived entry when its source is invalidated', () => {
      registerDerived('breakdown', 'members');
      setEntry(['members', 'g1'], ['u1']);
      setEntry(['breakdown', 'g1'], { direct: 1 });

      invalidate(['members', 'g1']);

      expect(peek(['members', 'g1'])).toBeNull();
      expect(peek(['breakdown', 'g1'])).toBeNull();
    });

    it('leaves a different scope alone', () => {
      registerDerived('breakdown', 'members');
      setEntry(['breakdown', 'g1'], { direct: 1 });
      setEntry(['breakdown', 'g2'], { direct: 2 });

      invalidate(['members', 'g1']);

      expect(peek(['breakdown', 'g1'])).toBeNull();
      expect(peek(['breakdown', 'g2'])).toEqual({ direct: 2 });
    });

    it('drops the derived entry even when the source is not cached', () => {
      // The source may have expired, or the caller may be invalidating
      // pre-emptively straight after a write. Neither should strand the derived.
      registerDerived('breakdown', 'members');
      setEntry(['breakdown', 'g1'], { direct: 1 });

      invalidate(['members', 'g1']);

      expect(peek(['breakdown', 'g1'])).toBeNull();
    });

    it('cascades through a prefix invalidation of the whole source family', () => {
      registerDerived('breakdown', 'members');
      setEntry(['breakdown', 'g1'], { direct: 1 });
      setEntry(['breakdown', 'g2'], { direct: 2 });

      invalidate(['members']);

      expect(peek(['breakdown', 'g1'])).toBeNull();
      expect(peek(['breakdown', 'g2'])).toBeNull();
    });

    it('terminates on a circular registration', () => {
      registerDerived('ping', 'pong');
      registerDerived('pong', 'ping');
      setEntry(['ping', 'x'], 1);
      setEntry(['pong', 'x'], 2);

      invalidate(['ping', 'x']);

      expect(peek(['ping', 'x'])).toBeNull();
      expect(peek(['pong', 'x'])).toBeNull();
    });

    it('notifies a subscriber on the derived key', () => {
      registerDerived('breakdown', 'members');
      const cb = vi.fn();
      setEntry(['breakdown', 'g1'], { direct: 1 });
      subscribe(['breakdown', 'g1'], cb);

      invalidate(['members', 'g1']);

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('eviction', () => {
    /** Fill the store past capacity with plain, unsubscribed entries. */
    const fill = (count: number, tag = 'e') => {
      for (let i = 0; i < count; i++) setEntry([tag, String(i)], i);
    };

    it('holds the store at MAX_ENTRIES', () => {
      fill(MAX_ENTRIES + 25);
      let size = 0;
      for (let i = 0; i < MAX_ENTRIES + 25; i++) {
        if (peek(['e', String(i)]) !== null) size++;
      }
      expect(size).toBe(MAX_ENTRIES);
    });

    it('evicts the least recently read entry first', () => {
      // Fake timers, not wall clock: 500 writes can land inside one millisecond,
      // which would leave every `lastRead` tied and the eviction order decided by
      // sort stability rather than by recency. Advancing the clock explicitly is
      // what makes "e/0 was read more recently" true rather than probable.
      vi.useFakeTimers();
      try {
        fill(MAX_ENTRIES);
        vi.advanceTimersByTime(1000);
        // Touch the oldest-written entry so it is the most recently *read*.
        expect(peek(['e', '0'])).toBe(0);

        setEntry(['e', 'overflow'], 'new');

        expect(peek(['e', '0'])).toBe(0);
        expect(peek(['e', '1'])).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('evicts an expired entry before a live one, regardless of read order', () => {
      setEntry(['expired', 'a'], 'gone', { ttl: -1 });
      fill(MAX_ENTRIES - 1);
      // `expired/a` was written first and never re-read, but it is also the only
      // expired entry — expiry outranks recency.
      setEntry(['e', 'overflow'], 'new');

      expect(peek(['expired', 'a'])).toBeNull();
      expect(peek(['e', '0'])).toBe(0);
    });

    it('never evicts a subscribed entry, even past capacity', () => {
      setEntry(['pinned', 'p'], 'keep');
      const unsubscribe = subscribe(['pinned', 'p'], () => {});
      fill(MAX_ENTRIES + 50);

      expect(peek(['pinned', 'p'])).toBe('keep');
      unsubscribe();
    });

    it('never evicts an in-flight entry', async () => {
      // The gate is constructed here, not inside the fetcher: `getOrFetch` defers
      // the fetcher to a microtask, so `release` would still be unassigned below.
      let release!: (value: string) => void;
      const gate = new Promise<string>((r) => {
        release = r;
      });
      const pending = getOrFetch(['inflight', 'x'], () => gate);
      fill(MAX_ENTRIES + 50);

      release('done');
      await expect(pending).resolves.toBe('done');
      expect(peek(['inflight', 'x'])).toBe('done');
    });
  });

  describe('subscribe', () => {
    it('notifies on set and on invalidate, and stops after unsubscribe', () => {
      const cb = vi.fn();
      const unsubscribe = subscribe('k', cb);
      setEntry('k', '1');
      invalidate('k');
      expect(cb).toHaveBeenCalledTimes(2);

      unsubscribe();
      setEntry('k', '2');
      expect(cb).toHaveBeenCalledTimes(2);
    });
  });
});
