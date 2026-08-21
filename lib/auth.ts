/**
 * Cổng mật khẩu.
 *
 * App deploy lên Vercel có URL công khai, mà API key nằm trên server đó —
 * ai biết link đều có thể bấm sinh bài và đốt tiền. Đây là lớp chặn duy nhất.
 *
 * Dùng Web Crypto chứ không dùng `node:crypto` vì middleware chạy trên Edge
 * runtime, nơi không có module Node. Web Crypto có ở cả hai nơi.
 */
export const COOKIE_NAME = "ban-viet-phien";
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Cookie có dạng `<hạn>.<chữ ký>`. Hạn nằm trong phần được ký nên sửa được là hỏng chữ ký. */
export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = await sign(payload, secret);
  if (!constantTimeEqual(signature, expected)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

/**
 * So sánh không phụ thuộc thời gian. `timingSafeEqual` của Node không dùng
 * được trên Edge nên viết tay: luôn duyệt hết chuỗi, gom khác biệt bằng XOR.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
