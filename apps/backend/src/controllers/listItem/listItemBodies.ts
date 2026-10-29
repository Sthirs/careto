import { CUSTOM_ITEM_NAME_MAX_LENGTH } from '../../entities/ListCustomItem';
import { LIST_ITEM_STATUSES, type ListItemStatus } from '../../entities/ListItem';
import {
  CATALOG_SECTIONS,
  OWN_ITEMS_SECTION_KEY,
} from '../../services/catalog/catalogData';
import type { AddListItemInput, ListItemOverride } from '../../services/listItemService';
import { isUuid } from '../../utils/uuid';

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

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
    return isUuid(customItemId)
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

const SECTION_KEYS: readonly string[] = CATALOG_SECTIONS.map((section) => section.key);
const ITEM_KEYS = new Set(CATALOG_SECTIONS.flatMap((section) => section.items));

export type ItemUpdate = { status: ListItemStatus } | ListItemOverride;

/**
 * Whitelist parse of `PATCH /lists/:id/items/:itemId`: exactly one of
 * `status`, `iconKey` (a catalog item key) or `sectionKey` (a catalog section
 * other than "Own items"); `null` clears an override (ADR-0026).
 */
export function parseItemUpdateBody(body: unknown): Parsed<ItemUpdate> {
  const fields = (body ?? {}) as Record<string, unknown>;
  const given = (['status', 'iconKey', 'sectionKey'] as const).filter(
    (field) => fields[field] !== undefined,
  );
  if (given.length !== 1) {
    return { ok: false, message: 'Provide exactly one of status, iconKey or sectionKey.' };
  }

  const { status, iconKey, sectionKey } = fields;
  if (given[0] === 'status') {
    return LIST_ITEM_STATUSES.includes(status as ListItemStatus)
      ? { ok: true, value: { status: status as ListItemStatus } }
      : { ok: false, message: `status must be one of ${LIST_ITEM_STATUSES.join(', ')}.` };
  }

  if (given[0] === 'iconKey') {
    return iconKey === null || ITEM_KEYS.has(iconKey as string)
      ? { ok: true, value: { iconKey: iconKey as string | null } }
      : { ok: false, message: 'iconKey must be a catalog item key or null.' };
  }

  return sectionKey === null || SECTION_KEYS.includes(sectionKey as string)
    ? { ok: true, value: { sectionKey: sectionKey as string | null } }
    : { ok: false, message: 'sectionKey must be a catalog section key or null.' };
}

/**
 * `PUT /lists/:id/section-order`: every catalog section except
 * `${OWN_ITEMS_SECTION_KEY}`, each exactly once.
 */
export function parseSectionOrderBody(body: unknown): Parsed<string[]> {
  const { sectionKeys } = (body ?? {}) as { sectionKeys?: unknown };
  const message = `sectionKeys must list every section except ${OWN_ITEMS_SECTION_KEY} once.`;
  if (!Array.isArray(sectionKeys) || sectionKeys.length !== SECTION_KEYS.length) {
    return { ok: false, message };
  }
  const unique = new Set(sectionKeys);
  const complete =
    unique.size === SECTION_KEYS.length && SECTION_KEYS.every((key) => unique.has(key));
  return complete ? { ok: true, value: sectionKeys as string[] } : { ok: false, message };
}
