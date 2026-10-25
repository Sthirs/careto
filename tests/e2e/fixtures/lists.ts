/*
 * API-only list setup for specs whose subject is NOT list creation or
 * invitation: they build their list over the API so the UI steps under test
 * stay short, and so they never touch the shared demo user's lists list.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { registerViaApi, uniqueValue, type RegisteredUser } from './auth';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

async function api<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseURL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${await response.text()}`);
  }
  return (response.status === 204 ? {} : await response.json()) as T;
}

/** Registers a fresh user whose display name starts with `firstName`. */
export async function registerNamedUser(firstName: string): Promise<RegisteredUser> {
  const suffix = uniqueValue(firstName.toLowerCase());
  return registerViaApi(`${suffix}@careto.local`, 'password123', `${firstName} ${suffix.slice(-6)}`);
}

/** Owner creates a list; every other user is invited and accepts over the API. */
export async function createShoppingListViaApi(
  owner: RegisteredUser,
  members: RegisteredUser[],
  namePrefix = 'e2e-list',
): Promise<{ id: string; name: string }> {
  const name = uniqueValue(namePrefix);
  const { shoppingList } = await api<{ shoppingList: { id: string } }>(owner.token, 'POST', '/lists', { name });

  for (const member of members) {
    const { invitation } = await api<{ invitation: { id: string } }>(
      owner.token,
      'POST',
      `/lists/${shoppingList.id}/members`,
      { email: member.email },
    );
    await api(member.token, 'POST', `/lists/${shoppingList.id}/invitations/${invitation.id}/accept`);
  }

  return { id: shoppingList.id, name };
}

/** Invites an email without accepting, leaving a pending invitation. */
export async function inviteViaApi(owner: RegisteredUser, shoppingListId: string, email: string): Promise<void> {
  await api(owner.token, 'POST', `/lists/${shoppingListId}/members`, { email });
}

/** Uploads tests/e2e/fixtures/test-image.png as the user's profile picture. */
export async function uploadAvatarViaApi(user: RegisteredUser): Promise<string> {
  const formData = new FormData();
  const png = readFileSync(resolve('tests/e2e/fixtures/test-image.png'));
  formData.append('image', new Blob([png], { type: 'image/png' }), 'avatar.png');
  const response = await fetch(`${baseURL}/api/auth/me/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: formData,
  });
  if (response.status !== 200) {
    throw new Error(`avatar upload failed with ${response.status}`);
  }
  const { user: updated } = (await response.json()) as { user: { imageUrl: string } };
  return updated.imageUrl;
}
