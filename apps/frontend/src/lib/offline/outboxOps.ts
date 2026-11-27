import { api } from '@/lib/api';
import type { AddItemInput, ListItem, ListItemStatus } from '@/types/listItem';

/**
 * One change a member made to a list, waiting to reach the server (ADR-0030).
 * `occurredAt` is when they tapped; the server dates the change with it.
 */
export type OutboxOp = { id: string; listId: string; occurredAt: string } & (
  | {
      kind: 'add';
      /** The id the item shows under until the server gives it a real one. */
      tempItemId: string;
      input: AddItemInput;
    }
  | { kind: 'status'; itemId: string; status: ListItemStatus }
  | { kind: 'remove'; itemId: string }
);

/** An op as a caller describes it; the outbox stamps the id and the time. */
export type NewOutboxOp = OutboxOp extends infer Op
  ? Op extends OutboxOp
    ? Omit<Op, 'id' | 'occurredAt'>
    : never
  : never;

export const OCCURRED_AT_HEADER = 'X-Occurred-At';

/** A shop's flaky connection can hang a request; give up and retry instead. */
export const SEND_TIMEOUT_MS = 15_000;

/** Ids of items the server has not created yet. */
export const TEMP_ID_PREFIX = 'local:';

export const isTempId = (id: string): boolean => id.startsWith(TEMP_ID_PREFIX);

export const newTempId = (): string => `${TEMP_ID_PREFIX}${randomId()}`;

export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The item an op acts on, or null for an add. */
export const targetOf = (op: OutboxOp): string | null => (op.kind === 'add' ? null : op.itemId);

/**
 * Sends one op through the shared `api` instance, so the ADR-0018
 * refresh-and-retry still applies. Resolves to the item the server answered
 * with, or null for a removal.
 */
export async function sendOp(op: OutboxOp): Promise<ListItem | null> {
  const base = `/lists/${op.listId}/items`;
  const config = {
    headers: { [OCCURRED_AT_HEADER]: op.occurredAt },
    timeout: SEND_TIMEOUT_MS,
  };

  if (op.kind === 'add') {
    const { data } = await api.post<{ item: ListItem }>(base, op.input, config);
    return data.item;
  }
  if (op.kind === 'status') {
    const { data } = await api.patch<{ item: ListItem }>(
      `${base}/${op.itemId}`,
      { status: op.status },
      config,
    );
    return data.item;
  }
  await api.delete(`${base}/${op.itemId}`, config);
  return null;
}

/**
 * The ops left once `done` reached the server: an add hands its real item id
 * to the later ops of its temporary item.
 */
export function afterSent(ops: OutboxOp[], done: OutboxOp, item: ListItem | null): OutboxOp[] {
  const rest = ops.filter((op) => op.id !== done.id);
  if (done.kind !== 'add' || !item) return rest;
  return rest.map((op) =>
    op.kind !== 'add' && op.itemId === done.tempItemId ? { ...op, itemId: item.id } : op,
  );
}

/**
 * The ops left once `dropped` was refused: the later ops of an add that never
 * landed have nothing to act on, so they go too.
 */
export function afterDropped(ops: OutboxOp[], dropped: OutboxOp): OutboxOp[] {
  const rest = ops.filter((op) => op.id !== dropped.id);
  if (dropped.kind !== 'add') return rest;
  return rest.filter((op) => targetOf(op) !== dropped.tempItemId);
}
