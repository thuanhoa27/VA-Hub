/**
 * Cong mat khau don gian cho toan app — khong dung thay auth that.
 * Cookie luu SHA-256 cua mat khau (khong luu plaintext), so sanh o middleware.
 */
export const SITE_AUTH_COOKIE = 'site_auth';

export async function hashSitePassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
