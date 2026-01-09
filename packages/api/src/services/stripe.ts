/**
 * Stripe Webhook Verification
 *
 * Implements Stripe webhook signature verification using crypto.subtle (Web Crypto API).
 * Compatible with Cloudflare Workers and other edge runtimes.
 *
 * Reference: https://stripe.com/docs/webhooks/signatures
 */

/**
 * Verify Stripe webhook signature
 *
 * @param payload - Raw request body (text)
 * @param signature - Stripe-Signature header value
 * @param secret - Webhook secret from Stripe dashboard
 * @param tolerance - Maximum age in seconds (default: 300 = 5 minutes)
 * @returns true if signature is valid, false otherwise
 */
export async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance = 300
): Promise<boolean> {
  // Parse signature header
  // Format: "t=1614024000,v1=abc123,v1=def456"
  const signatureData = parseSignatureHeader(signature);

  if (!signatureData.timestamp || signatureData.signatures.length === 0) {
    return false;
  }

  // Check timestamp tolerance (prevent replay attacks)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - signatureData.timestamp) > tolerance) {
    console.warn(
      `Webhook timestamp outside tolerance: ${currentTime - signatureData.timestamp}s ago`
    );
    return false;
  }

  // Construct signed payload
  const signedPayload = `${signatureData.timestamp}.${payload}`;

  // Compute expected signature
  const expectedSignature = await computeHmacSha256(signedPayload, secret);

  // Compare with provided signatures (constant-time comparison)
  for (const sig of signatureData.signatures) {
    if (constantTimeCompare(expectedSignature, sig)) {
      return true;
    }
  }

  console.warn('Stripe webhook signature mismatch');
  return false;
}

/**
 * Parse Stripe-Signature header
 *
 * Example: "t=1614024000,v1=abc123,v1=def456"
 */
function parseSignatureHeader(header: string): {
  timestamp: number;
  signatures: string[];
} {
  const parts = header.split(',');
  let timestamp = 0;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }

  return { timestamp, signatures };
}

/**
 * Compute HMAC-SHA256 using Web Crypto API
 *
 * @param message - Message to hash
 * @param secret - Secret key
 * @returns Hex-encoded signature
 */
async function computeHmacSha256(message: string, secret: string): Promise<string> {
  // Convert secret to crypto key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Compute HMAC
  const messageData = encoder.encode(message);
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  // Convert to hex string
  return bufferToHex(signature);
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison (prevents timing attacks)
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings match
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
