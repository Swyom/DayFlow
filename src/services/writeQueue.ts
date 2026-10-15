/**
 * Serialises writes of a changing value and coalesces bursts.
 *
 * Calling the returned `save()` schedules a write of `read()`'s value at the time
 * the write *starts*. While a write is in flight, further calls share one follow-up
 * write, so a burst of N changes costs at most two writes and the last one always
 * contains the latest value. Each call's promise rejects if its write fails; a
 * failure never blocks later writes.
 */
export function createWriteQueue<T>(read: () => T, write: (value: T) => Promise<void>): () => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  let pending: Promise<void> | null = null;

  return function save() {
    if (pending) return pending;
    const next = tail
      .catch(() => undefined)
      .then(() => {
        pending = null;
        return write(read());
      });
    pending = next;
    tail = next;
    return next;
  };
}
