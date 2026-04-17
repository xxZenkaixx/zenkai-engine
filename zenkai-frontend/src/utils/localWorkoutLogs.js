// * Local-first workout log persistence aligned with existing API contract

const PENDING_KEY = 'zk_pending_logs';

// * Generate unique id for idempotency
export function generateId() {
  return crypto.randomUUID();
}

// * Save log (local-first)
export function saveLog(log) {
  const pending = getPendingLogs();
  pending.push(log);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

// * Get pending logs
export function getPendingLogs() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}

// * Remove synced log (no synced flag system)
export function removeLog(id) {
  const pending = getPendingLogs().filter(l => l.id !== id);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

// * Sync runner — must match existing API payload shape exactly
export async function syncPendingLogs(postFn) {
  const pending = getPendingLogs();

  for (const log of pending) {
    try {
      await postFn(log); // exact same payload as live logging
      removeLog(log.id);
    } catch {
      break; // stop on first failure
    }
  }
}
