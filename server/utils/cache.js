/* =========================================================
   NEXUS Dashboard - In-memory TTL Cache
   -----------------------------------------------------------
   Deliberately simple: a single-process Map with a TTL.
   No Redis - this is a single-owner dashboard with one cache
   key, so an external cache store would be pure overhead
   (see architecture audit, constraint: no Redis/queues unless
   there is a concrete need).

   Supports "stale reads" so the GitHub service can fall back
   to the last known-good payload when a live fetch fails.
   ========================================================= */

"use strict";

class TTLCache {
  constructor() {
    this._store = new Map();
  }

  /**
   * Store a value with a given TTL (ms).
   */
  set(key, value, ttlMs) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      storedAt: Date.now()
    });
  }

  /**
   * Return the value only if it hasn't expired yet, else null.
   */
  get(key) {
    const entry = this._store.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      return null;
    }

    return entry.value;
  }

  /**
   * Return the value regardless of expiry (for error fallback),
   * along with how old it is. Returns null if nothing was ever cached.
   */
  getStale(key) {
    const entry = this._store.get(key);

    if (!entry) return null;

    return {
      value: entry.value,
      ageMs: Date.now() - entry.storedAt
    };
  }

  delete(key) {
    this._store.delete(key);
  }

  has(key) {
    return this.get(key) !== null;
  }
}

module.exports = { TTLCache };
