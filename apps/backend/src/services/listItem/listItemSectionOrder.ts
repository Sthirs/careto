import { CATALOG_SECTIONS, OWN_ITEMS_SECTION_KEY } from '../catalog/catalogData';
import { getShoppingListForMember } from '../shoppingList/shoppingListMembership';
import { getSectionOrder } from './listItemQueries';
import type { ListItemRepositories } from './listItemRepositories';

export type SectionOrderView = { sectionKeys: string[] };

/** The order a member can change: every section except "Own items". */
async function sortableOrder(
  repositories: ListItemRepositories,
  shoppingListId: string,
): Promise<SectionOrderView> {
  const order = await getSectionOrder(repositories, shoppingListId);
  return { sectionKeys: order.filter((key) => key !== OWN_ITEMS_SECTION_KEY) };
}

export async function getListSectionOrder(
  repositories: ListItemRepositories,
  shoppingListId: string,
  userId: string,
): Promise<SectionOrderView> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  return sortableOrder(repositories, shoppingListId);
}

/** Replaces the list's whole order; the caller passes every section once. */
export async function replaceListSectionOrder(
  repositories: ListItemRepositories,
  shoppingListId: string,
  sectionKeys: readonly string[],
  userId: string,
): Promise<SectionOrderView> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  await repositories.replaceSectionOrder(async (orders) => {
    await orders.delete({ shoppingListId });
    await orders.insert(
      sectionKeys.map((sectionKey, position) => ({ shoppingListId, sectionKey, position })),
    );
  });
  return { sectionKeys: [...sectionKeys] };
}

/** Drops the list's own order, so it follows the default again. */
export async function resetListSectionOrder(
  repositories: ListItemRepositories,
  shoppingListId: string,
  userId: string,
): Promise<SectionOrderView> {
  await getShoppingListForMember(repositories, shoppingListId, userId);
  await repositories.sectionOrderRepository.delete({ shoppingListId });
  return { sectionKeys: CATALOG_SECTIONS.map((section) => section.key) };
}
