import { createJsonRequest, createMultipartRequest, ensureBackendAvailable, registerUser, uniqueValue } from './helpers/api';
import { createSoloShoppingList, UNKNOWN_ID } from './helpers/lists';

describe('POST /api/lists/:id/image', () => {
  beforeAll(async () => {
    await ensureBackendAvailable();
  });

  const smallPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const smallPngBuffer = Buffer.from(smallPngBase64, 'base64');

  const createPngBlob = () => new Blob([smallPngBuffer], { type: 'image/png' });

  it('uploads a small PNG as a list member and returns 200 with imageUrl as data:image/webp;base64', async () => {
    const registerResponse = await registerUser('lists-image-member');

    const shoppingListName = uniqueValue('list-with-image');
    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const formData = new FormData();
    formData.append('image', createPngBlob(), 'shoppingList.png');

    const response = await createMultipartRequest<{
      shoppingList: { id: string; name: string; imageUrl: string | null; memberCount: number; members: Array<{ id: string; email: string; displayName: string }> };
    }>(`/api/lists/${shoppingListId}/image`, formData, registerResponse.body.token);

    expect(response.status).toBe(200);
    expect(response.body.shoppingList.imageUrl).toBeDefined();
    expect(response.body.shoppingList.imageUrl).toMatch(/^data:image\/webp;base64,/);
  });

  it('persists the imageUrl — GET /api/lists/:id returns the same imageUrl', async () => {
    const registerResponse = await registerUser('lists-image-persist');

    const shoppingListName = uniqueValue('list-persist-image');
    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const formData = new FormData();
    formData.append('image', createPngBlob(), 'shoppingList.png');

    const uploadResponse = await createMultipartRequest<{
      shoppingList: { id: string; name: string; imageUrl: string | null; memberCount: number; members: Array<{ id: string; email: string; displayName: string }> };
    }>(`/api/lists/${shoppingListId}/image`, formData, registerResponse.body.token);

    expect(uploadResponse.status).toBe(200);

    const getResponse = await createJsonRequest<{
      shoppingList: { id: string; name: string; imageUrl: string | null; memberCount: number; members: Array<{ id: string; email: string; displayName: string }> };
    }>(`/api/lists/${shoppingListId}`, {
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
    });

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.shoppingList.imageUrl).toBe(uploadResponse.body.shoppingList.imageUrl);
  });

  it('rejects non-member users with 403', async () => {
    const user1Response = await registerUser('lists-image-owner');
    const user2Response = await registerUser('lists-image-nonmember');
    const shoppingListName = uniqueValue('exclusive-list-image');

    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Response.body.token}` },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const formData = new FormData();
    formData.append('image', createPngBlob(), 'shoppingList.png');

    const response = await createMultipartRequest<{ message: string }>(
      `/api/lists/${shoppingListId}/image`,
      formData,
      user2Response.body.token,
    );

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/list not found or you are not a member/i);
  });

  it('returns 404 for unknown list id', async () => {
    const registerResponse = await registerUser('lists-image-notfound');
    const fakeShoppingListId = '00000000-0000-0000-0000-000000000000';

    const formData = new FormData();
    formData.append('image', createPngBlob(), 'shoppingList.png');

    const response = await createMultipartRequest<{ message: string }>(
      `/api/lists/${fakeShoppingListId}/image`,
      formData,
      registerResponse.body.token,
    );

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/list not found or you are not a member/i);
  });

  it('rejects unsupported MIME type (text/plain) with 415', async () => {
    const registerResponse = await registerUser('lists-image-mime');

    const shoppingListName = uniqueValue('list-mime-test');
    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const textBlob = new Blob(['not an image'], { type: 'text/plain' });

    const formData = new FormData();
    formData.append('image', textBlob, 'file.txt');

    const response = await createMultipartRequest<{ message: string }>(
      `/api/lists/${shoppingListId}/image`,
      formData,
      registerResponse.body.token,
    );

    expect(response.status).toBe(415);
  });

  it('rejects missing file with 400', async () => {
    const registerResponse = await registerUser('lists-image-missing');

    const shoppingListName = uniqueValue('list-missing-file');
    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const formData = new FormData();
    // No file appended

    const response = await createMultipartRequest<{ message: string }>(
      `/api/lists/${shoppingListId}/image`,
      formData,
      registerResponse.body.token,
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/image file is required/i);
  });

  it('rejects invalid/corrupt image data with 422', async () => {
    const registerResponse = await registerUser('lists-image-corrupt');

    const shoppingListName = uniqueValue('list-corrupt-image');
    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);
    const shoppingListId = createShoppingListResponse.body.shoppingList.id;

    const corruptBlob = new Blob(['not a valid image'], { type: 'image/png' });

    const formData = new FormData();
    formData.append('image', corruptBlob, 'corrupt.png');

    const response = await createMultipartRequest<{ message: string }>(
      `/api/lists/${shoppingListId}/image`,
      formData,
      registerResponse.body.token,
    );

    expect(response.status).toBe(422);
  });

  it('exposes member imageUrl in GET /api/lists after user uploads avatar via POST /api/auth/me/image', async () => {
    const registerResponse = await registerUser('lists-member-avatar');

    const avatarFormData = new FormData();
    avatarFormData.append('image', createPngBlob(), 'avatar.png');

    const avatarResponse = await createMultipartRequest<{
      user: { id: string; email: string; displayName: string; imageUrl: string | null };
    }>('/api/auth/me/image', avatarFormData, registerResponse.body.token);

    expect(avatarResponse.status).toBe(200);
    expect(avatarResponse.body.user.imageUrl).toMatch(/^data:image\/webp;base64,/);
    const uploadedImageUrl = avatarResponse.body.user.imageUrl;

    const shoppingListName = uniqueValue('list-member-avatar');
    const createShoppingListResponse = await createJsonRequest<{ shoppingList: { id: string } }>('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
      body: JSON.stringify({ name: shoppingListName }),
    });

    expect(createShoppingListResponse.status).toBe(201);

    const shoppingListsResponse = await createJsonRequest<{
      shoppingLists: Array<{
        id: string;
        name: string;
        imageUrl: string | null;
        memberCount: number;
        members: Array<{ id: string; email: string; displayName: string; imageUrl: string | null }>;
      }>;
      invitations: unknown[];
    }>('/api/lists', {
      headers: { Authorization: `Bearer ${registerResponse.body.token}` },
    });

    expect(shoppingListsResponse.status).toBe(200);
    expect(shoppingListsResponse.body.shoppingLists.length).toBeGreaterThan(0);

    const shoppingList = shoppingListsResponse.body.shoppingLists.find((g) => g.name === shoppingListName);
    expect(shoppingList).toBeDefined();
    expect(shoppingList!.members.length).toBe(1);

    const member = shoppingList!.members[0];
    expect(member.imageUrl).toBe(uploadedImageUrl);
    expect(member.imageUrl).toMatch(/^data:image\/webp;base64,/);
  });

  it('rejects unauthenticated uploads with 401', async () => {
    const formData = new FormData();
    formData.append('image', createPngBlob(), 'shoppingList.png');

    const response = await createMultipartRequest(`/api/lists/${UNKNOWN_ID}/image`, formData);

    expect(response.status).toBe(401);
  });

  it('rejects files over 5 MB with 413 and keeps the list without an image', async () => {
    const { shoppingListId, owner } = await createSoloShoppingList('lists-image-oversize');
    const formData = new FormData();
    formData.append('image', new Blob([Buffer.alloc(6 * 1024 * 1024)], { type: 'image/png' }), 'large.png');

    const response = await createMultipartRequest(`/api/lists/${shoppingListId}/image`, formData, owner.token);

    expect(response.status).toBe(413);
    const shoppingList = await createJsonRequest<{ shoppingList: { imageUrl: string | null } }>(`/api/lists/${shoppingListId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(shoppingList.body.shoppingList.imageUrl).toBeNull();
  });
});
