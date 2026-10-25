/**
 * Unit tests for `notificationMessages.ts` (ADR-0020's server-side
 * localization exception to ADR-0014). Pure functions, no mocks needed.
 */
import { describe, expect, it } from 'vitest';

import { renderNotification } from '../../src/services/push/notificationMessages';

const baseParams = {
  actorName: 'Alice',
  shoppingListName: 'Weekly Groceries',
  url: '/lists/g1',
};

describe('renderNotification', () => {
  it('renders English copy for language "en"', () => {
    const { title, body } = renderNotification(
      'invitation.created',
      'en',
      baseParams,
    );
    expect(title).toBe('List invitation');
    expect(body).toContain('Alice');
    expect(body).toContain('Weekly Groceries');
  });

  it('renders Italian copy for language "it"', () => {
    const { body } = renderNotification(
      'invitation.created',
      'it',
      baseParams,
    );
    expect(body).toContain('ti ha invitato');
    expect(body).toContain('Weekly Groceries');
  });

  it('falls back to English for an unrecognized language', () => {
    const en = renderNotification('invitation.created', 'en', baseParams);
    const unknown = renderNotification('invitation.created', 'fr', baseParams);
    expect(unknown).toEqual(en);
  });
});
