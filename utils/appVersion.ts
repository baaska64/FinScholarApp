/**
 * Version comparison for the update prompt.
 *
 * Lives here rather than inside the modal so it can be tested — deciding
 * whether to nag someone about an update is exactly the kind of thing that
 * should not be exercised only by shipping it. Versions are the three-part
 * `major.minor.patch` strings in app.json; anything missing counts as 0, and
 * anything unparseable counts as "not newer" so a bad row in `app_versions`
 * cannot pop a dialog on every launch.
 */

function parseVersion(value: unknown): number[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  // Tolerate a leading "v" and a build suffix ("1.2.3-beta.1").
  const core = trimmed.replace(/^v/i, '').split(/[-+]/)[0];
  const parts = core.split('.');
  // The leading segment has to be a number, or this is not a version at all —
  // otherwise "latest" would parse as 0.0.0 and every launch would prompt.
  if (!/^\d+$/.test(parts[0] ?? '')) return [];
  return parts.slice(0, 3).map((part) => {
    const num = Number.parseInt(part, 10);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  });
}

/** True when `latest` is ahead of `current`. Equal or older versions are false. */
export function isNewerVersion(current: unknown, latest: unknown): boolean {
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);
  if (latestParts.length === 0) return false;
  // With no readable current version we cannot claim anything is newer.
  if (currentParts.length === 0) return false;

  for (let i = 0; i < 3; i++) {
    const a = latestParts[i] ?? 0;
    const b = currentParts[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}
