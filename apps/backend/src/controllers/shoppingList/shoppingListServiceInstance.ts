import { ShoppingListService } from '../../services/shoppingListService';

/**
 * The single, module-level `ShoppingListService` instance shared by every list
 * handler module. It is instantiated exactly once, at import time, exactly as
 * the pre-split `shoppingListController.ts` did — the handler modules import this
 * instance rather than constructing their own.
 */
export const shoppingListService = new ShoppingListService();
