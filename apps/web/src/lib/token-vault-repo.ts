import {
  decryptTokenPayload,
  encryptTokenPayload,
  mergeRefreshToken,
  type GoogleTokenPayload
} from '@powerlifting/data';

import { getPrismaClient } from './prisma';

const inMemoryVault = new Map<string, string>();

function tokenKey(userId: string): string {
  return `${userId}:google`;
}

function getEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY_BASE64;
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY_BASE64 is required for token-vault operations.');
  }

  return key;
}

export async function getGoogleTokenPayload(userId: string): Promise<GoogleTokenPayload | null> {
  const prisma = getPrismaClient();

  if (prisma) {
    try {
      const record = await prisma.oAuthTokenVault.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: 'google'
          }
        }
      });

      if (!record) {
        return null;
      }

      return decryptTokenPayload(JSON.parse(record.encryptedPayload), getEncryptionKey());
    } catch {
      // Fall through to in-memory fallback.
    }
  }

  const raw = inMemoryVault.get(tokenKey(userId));
  if (!raw) {
    return null;
  }

  return decryptTokenPayload(JSON.parse(raw), getEncryptionKey());
}

export async function saveGoogleTokenPayload(
  userId: string,
  payload: GoogleTokenPayload
): Promise<GoogleTokenPayload> {
  const existing = await getGoogleTokenPayload(userId);
  const merged = mergeRefreshToken(existing, payload);

  const encrypted = encryptTokenPayload(merged, getEncryptionKey());
  const encryptedJson = JSON.stringify(encrypted);

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      await prisma.oAuthTokenVault.upsert({
        where: {
          userId_provider: {
            userId,
            provider: 'google'
          }
        },
        create: {
          userId,
          provider: 'google',
          encryptedPayload: encryptedJson
        },
        update: {
          encryptedPayload: encryptedJson
        }
      });

      return merged;
    } catch {
      // Fall through to in-memory fallback.
    }
  }

  inMemoryVault.set(tokenKey(userId), encryptedJson);
  return merged;
}

async function refreshGoogleAccessToken(payload: GoogleTokenPayload): Promise<GoogleTokenPayload> {
  if (!payload.refresh_token) {
    throw new Error('No refresh token available for Google token refresh.');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for token refresh.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: payload.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const refreshed = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    refresh_token?: string;
  };

  return mergeRefreshToken(payload, {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? null,
    expiry_date: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
    scope: refreshed.scope,
    token_type: refreshed.token_type
  });
}

export async function getValidGoogleAccessToken(
  userId: string
): Promise<{ accessToken: string; expiryDate: number | null } | null> {
  const payload = await getGoogleTokenPayload(userId);
  if (!payload) {
    return null;
  }

  const expiry = payload.expiry_date ?? null;
  const stillValid = expiry ? expiry - Date.now() > 60_000 : true;

  if (stillValid) {
    return {
      accessToken: payload.access_token,
      expiryDate: expiry
    };
  }

  const refreshed = await refreshGoogleAccessToken(payload);
  await saveGoogleTokenPayload(userId, refreshed);

  return {
    accessToken: refreshed.access_token,
    expiryDate: refreshed.expiry_date ?? null
  };
}
