export const DEMO_EMAIL = 'demo@careto.local';

export const COMMON_PASSWORD = 'password123';

/** The demo user's list with a seeded purchase history (ADR-0027). */
export const AUTO_FILL_SEED_LIST_NAME = 'Dispensa';

export type SeedUser = {
  email: string;
  displayName: string;
};

export type SeedShoppingList = {
  name: string;
  memberEmails: string[];
};

export const SEED_USERS: SeedUser[] = [
  { email: 'alice@careto.local', displayName: 'Alice Rossi' },
  { email: 'bob@careto.local', displayName: 'Bob Bianchi' },
  { email: 'carol@careto.local', displayName: 'Carol Colombo' },
];

export const SEED_SHOPPING_LISTS: SeedShoppingList[] = [
  { name: 'Marcà de Rialto', memberEmails: [DEMO_EMAIL, 'alice@careto.local'] },
  { name: 'Spesa dea setimana', memberEmails: [DEMO_EMAIL, 'alice@careto.local', 'bob@careto.local'] },
  { name: 'Office Pantry', memberEmails: ['alice@careto.local', 'carol@careto.local'] },
];
