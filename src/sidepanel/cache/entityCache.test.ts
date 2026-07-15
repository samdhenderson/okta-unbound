import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOrFetch,
  invalidate,
  peek,
  peekEntry,
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
      expect(peekEntry('k')).toEqual({ data: 'v', isFresh: false });
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
