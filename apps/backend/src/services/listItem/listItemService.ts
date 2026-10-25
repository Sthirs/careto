import type { ListItemStatus } from '../../entities/ListItem';
import * as listItemMutations from './listItemMutations';
import * as listItemQueries from './listItemQueries';
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
}
