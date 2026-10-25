export type NotificationKind = 'invitation.created';

export type NotificationParams = {
  actorName: string;
  shoppingListName: string;
  url: string;
};

type Catalog = Record<
  NotificationKind,
  {
    title: (params: NotificationParams) => string;
    body: (params: NotificationParams) => string;
  }
>;

/**
 * Notification copy, keyed by event kind then rendered per recipient
 * language (ADR-0020 — server-side localization, a scoped exception to
 * ADR-0014's frontend-only i18n, because the recipient's device is not
 * connected when this text is composed). English is the fallback for any
 * language not in this catalog.
 */
const CATALOG: Record<'en' | 'it', Catalog> = {
  en: {
    'invitation.created': {
      title: () => 'List invitation',
      body: (p) => `${p.actorName} invited you to join "${p.shoppingListName}"`,
    },
  },
  it: {
    'invitation.created': {
      title: () => 'Invito a una lista',
      body: (p) => `${p.actorName} ti ha invitato a unirti alla lista "${p.shoppingListName}"`,
    },
  },
};

export const renderNotification = (
  kind: NotificationKind,
  language: string,
  params: NotificationParams,
): { title: string; body: string } => {
  const locale = language === 'it' ? 'it' : 'en';
  const entry = CATALOG[locale][kind];
  return {
    title: entry.title(params),
    body: entry.body(params),
  };
};
