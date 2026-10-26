import { Router } from 'express';

import { acceptInvitation, cancelInvitation, createShoppingList, declineInvitation, getShoppingList, listShoppingLists, updateShoppingList, addMember, removeMember, updateShoppingListImage } from '../controllers/shoppingListController';
import {
  addDishToList,
  createDish,
  deleteDish,
  getDish,
  listDishes,
  removeDishFromList,
  updateDish,
  updateDishImage,
  updateDishPause,
} from '../controllers/dishController';
import { addItem, listItems, removeItem, updateItemStatus } from '../controllers/listItemController';
import { requireAuth } from '../middleware/auth';
import { uploadSingleImage } from '../middleware/upload';
import { requireUuidParams } from '../middleware/uuidParams';

export const shoppingListRouter = Router();

// Every route below with a path id is authenticated first, then has its ids
// checked for UUID shape before any handler can hand them to Postgres.
const authed = [requireAuth, requireUuidParams];

shoppingListRouter.get('/', requireAuth, listShoppingLists);
shoppingListRouter.get('/:id', ...authed, getShoppingList);
shoppingListRouter.post('/', requireAuth, createShoppingList);
shoppingListRouter.patch('/:id', ...authed, updateShoppingList);
shoppingListRouter.post('/:id/image', ...authed, uploadSingleImage, updateShoppingListImage);
shoppingListRouter.post('/:id/members', ...authed, addMember);
shoppingListRouter.delete('/:id/members/:userId', ...authed, removeMember);
shoppingListRouter.post('/:id/invitations/:invitationId/accept', ...authed, acceptInvitation);
shoppingListRouter.post('/:id/invitations/:invitationId/decline', ...authed, declineInvitation);
shoppingListRouter.delete('/:id/invitations/:invitationId', ...authed, cancelInvitation);
shoppingListRouter.get('/:id/items', ...authed, listItems);
shoppingListRouter.post('/:id/items', ...authed, addItem);
shoppingListRouter.patch('/:id/items/:itemId', ...authed, updateItemStatus);
shoppingListRouter.delete('/:id/items/:itemId', ...authed, removeItem);
shoppingListRouter.get('/:id/dishes', ...authed, listDishes);
shoppingListRouter.post('/:id/dishes', ...authed, createDish);
shoppingListRouter.get('/:id/dishes/:dishId', ...authed, getDish);
shoppingListRouter.put('/:id/dishes/:dishId', ...authed, updateDish);
shoppingListRouter.patch('/:id/dishes/:dishId', ...authed, updateDishPause);
shoppingListRouter.delete('/:id/dishes/:dishId', ...authed, deleteDish);
shoppingListRouter.post('/:id/dishes/:dishId/image', ...authed, uploadSingleImage, updateDishImage);
shoppingListRouter.post('/:id/dishes/:dishId/list', ...authed, addDishToList);
shoppingListRouter.delete('/:id/dishes/:dishId/list', ...authed, removeDishFromList);
