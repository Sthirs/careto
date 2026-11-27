import { describe, expect, it } from 'vitest';

import {
  OCCURRED_AT_MAX_AGE_MS,
  parseOccurredAt,
} from '../src/controllers/listItem/occurredAt';

const now = new Date('2026-11-27T12:00:00.000Z');

describe('parseOccurredAt (ADR-0030)', () => {
  it('takes a past ISO time', () => {
    expect(parseOccurredAt('2026-11-27T11:55:30.250Z', now)).toEqual(new Date('2026-11-27T11:55:30.250Z'));
    expect(parseOccurredAt('2026-11-27T12:55:00+01:00', now)).toEqual(new Date('2026-11-27T11:55:00Z'));
  });

  it('means now when missing or malformed', () => {
    expect(parseOccurredAt(undefined, now)).toBe(now);
    expect(parseOccurredAt('', now)).toBe(now);
    expect(parseOccurredAt('yesterday', now)).toBe(now);
    expect(parseOccurredAt('2026-11-27', now)).toBe(now);
    expect(parseOccurredAt('2026-13-45T99:00:00Z', now)).toBe(now);
    expect(parseOccurredAt(['2026-11-27T11:00:00Z'], now)).toBe(now);
  });

  it('means now for a date that does not exist, which Date would roll over', () => {
    const march = new Date('2026-03-02T12:00:00Z');
    expect(parseOccurredAt('2026-02-30T10:00:00Z', march)).toBe(march);
    expect(parseOccurredAt('2026-02-29T10:00:00Z', march)).toBe(march);
    expect(parseOccurredAt('2026-02-28T10:00:00Z', march)).toEqual(new Date('2026-02-28T10:00:00Z'));
  });

  it('never dates a change in the future', () => {
    expect(parseOccurredAt('2026-11-27T12:00:01Z', now)).toBe(now);
  });

  it('means now when older than seven days', () => {
    const edge = new Date(now.getTime() - OCCURRED_AT_MAX_AGE_MS);
    expect(parseOccurredAt(edge.toISOString(), now)).toEqual(edge);
    expect(parseOccurredAt(new Date(edge.getTime() - 1).toISOString(), now)).toBe(now);
  });
});
