import type { ListItemStatus } from '../../entities/ListItem';
import * as listItemMutations from './listItemMutations';
import * as listItemOverrides from './listItemOverrides';
import * as listItemQueries from './listItemQueries';
import * as listItemSectionOrder from './listItemSectionOrder';
import {
  createListItemRepositories,
  type ListItemRepositories,
} from './listItemRepositories';

/** Facade over the list-item modules, mirroring `ShoppingListService`. */
export class ListItemService {
  private repositories: ListItemRepositories = createListItemRepositories();

  async getListItems(shoppingListId: string, userId: string) {
    return listItemQueries.getListItems(this.repositories, shoppingListId, userId);
  }

  async addListItem(
    shoppingListId: string,
    input: listItemMutations.AddListItemInput,
    userId: string,
  ) {
    return listItemMutations.addListItem(this.repositories, shoppingListId, input, userId);
  }

  async setListItemStatus(
    shoppingListId: string,
    itemId: string,
    status: ListItemStatus,
    userId: string,
  ) {
    return listItemMutations.setListItemStatus(
      this.repositories,
      shoppingListId,
      itemId,
      status,
      userId,
    );
  }

  async removeListItem(shoppingListId: string, itemId: string, userId: string) {
    return listItemMutations.removeListItem(this.repositories, shoppingListId, itemId, userId);
  }

  async setListItemOverride(
    shoppingListId: string,
    itemId: string,
    override: listItemOverrides.ListItemOverride,
    userId: string,
  ) {
    return listItemOverrides.setListItemOverride(
      this.repositories,
      shoppingListId,
      itemId,
      override,
      userId,
    );
  }

  async getSectionOrder(shoppingListId: string, userId: string) {
    return listItemSectionOrder.getListSectionOrder(this.repositories, shoppingListId, userId);
  }

  async replaceSectionOrder(shoppingListId: string, sectionKeys: string[], userId: string) {
    return listItemSectionOrder.replaceListSectionOrder(
      this.repositories,
      shoppingListId,
      sectionKeys,
      userId,
    );
  }

  async resetSectionOrder(shoppingListId: string, userId: string) {
    return listItemSectionOrder.resetListSectionOrder(this.repositories, shoppingListId, userId);
  }
}
