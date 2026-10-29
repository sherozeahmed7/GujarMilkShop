/**
 * Formats a user identifier (name or email) into a clean, human-readable display name.
 * Prevents raw email addresses (e.g. admin@gujarmilkshop.com) from appearing in the UI.
 */
export function formatUserName(val?: string | null): string {
  if (!val || !val.trim() || val.trim() === '—') return '—';
  const trimmed = val.trim();
  if (trimmed.includes('@')) {
    const prefix = trimmed.split('@')[0];
    if (prefix.toLowerCase() === 'admin') return 'Admin';
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return trimmed;
}
