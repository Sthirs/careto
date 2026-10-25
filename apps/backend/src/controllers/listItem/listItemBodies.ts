import { CUSTOM_ITEM_NAME_MAX_LENGTH } from '../../entities/ListCustomItem';
import { LIST_ITEM_STATUSES, type ListItemStatus } from '../../entities/ListItem';
import type { AddListItemInput } from '../../services/listItemService';

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whitelist parse of `POST /lists/:id/items` (ADR-0010 discipline): exactly
 * one of `catalogItemKey`, `customItemId`, `customName`; nothing else is read.
 */
export function parseAddItemBody(body: unknown): Parsed<AddListItemInput> {
  const { catalogItemKey, customItemId, customName } = (body ?? {}) as Record<
    string,
    unknown
  >;
  const given = [catalogItemKey, customItemId, customName].filter(
    (value) => value !== undefined,
  );
  if (given.length !== 1) {
    return {
      ok: false,
      message: 'Provide exactly one of catalogItemKey, customItemId or customName.',
    };
  }

  if (catalogItemKey !== undefined) {
    return typeof catalogItemKey === 'string' && catalogItemKey.length > 0
      ? { ok: true, value: { catalogItemKey } }
      : { ok: false, message: 'catalogItemKey must be a non-empty string.' };
  }

  if (customItemId !== undefined) {
    return typeof customItemId === 'string' && UUID_PATTERN.test(customItemId)
      ? { ok: true, value: { customItemId } }
      : { ok: false, message: 'customItemId must be a UUID.' };
  }

  const name = typeof customName === 'string' ? customName.trim() : '';
  if (name.length === 0 || name.length > CUSTOM_ITEM_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `customName must be 1-${CUSTOM_ITEM_NAME_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: { customName: name } };
}

export function parseStatusBody(body: unknown): Parsed<ListItemStatus> {
  const { status } = (body ?? {}) as { status?: unknown };
  return LIST_ITEM_STATUSES.includes(status as ListItemStatus)
    ? { ok: true, value: status as ListItemStatus }
    : { ok: false, message: `status must be one of ${LIST_ITEM_STATUSES.join(', ')}.` };
}
