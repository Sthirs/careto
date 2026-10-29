// Settings › Store sections (ADR-0026): reorder the sections by keyboard and
// by dragging, save, and see the list sort its items in the new order.
import { expect, test } from '../fixtures/auth';
import { addItemViaApi } from '../fixtures/dishes';
import { createShoppingListViaApi, registerNamedUser } from '../fixtures/lists';
import { ShoppingListDetailPage, StoreSectionsPage } from '../pages';

test('store sections: reorder, save, and the list follows the new order', async ({ pageForUser }) => {
  const owner = await registerNamedUser('Sections');
  const list = await createShoppingListViaApi(owner, [], 'e2e-sections');
  await addItemViaApi(owner, list.id, 'pineapple');
  await addItemViaApi(owner, list.id, 'milk');
  await addItemViaApi(owner, list.id, 'coffee');
  const page = await pageForUser(owner.email, owner.password);
  const detailPage = new ShoppingListDetailPage(page);
  const sectionsPage = new StoreSectionsPage(page);

  await page.goto(`/lists/${list.id}`);
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Pineapple', 'Milk', 'Coffee']);

  await detailPage.openSettings();
  await page.getByRole('link', { name: /Store sections/ }).click();
  await expect(page.getByRole('heading', { name: 'Store sections', level: 1 })).toBeVisible();
  await expect.poll(() => sectionsPage.sectionKeys()).toHaveLength(13);
  expect((await sectionsPage.sectionKeys()).slice(0, 3)).toEqual([
    'fruits-vegetables',
    'bread-pastries',
    'milk-cheese',
  ]);

  // Beverages to the top with the keyboard, then Milk & Cheese dragged above it.
  await sectionsPage.moveUpWithKeyboard('Beverages', 8);
  await expect.poll(async () => (await sectionsPage.sectionKeys())[0]).toBe('beverages');
  await sectionsPage.dragAbove('Milk & Cheese', 'Beverages');
  await expect.poll(async () => (await sectionsPage.sectionKeys()).slice(0, 3)).toEqual([
    'milk-cheese',
    'beverages',
    'fruits-vegetables',
  ]);

  await sectionsPage.save();
  await detailPage.openSection('List');
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Milk', 'Coffee', 'Pineapple']);

  // The order is kept, and resetting goes back to the default.
  await page.goto(`/lists/${list.id}/settings/sections`);
  await expect.poll(async () => (await sectionsPage.sectionKeys())[0]).toBe('milk-cheese');
  await page.getByRole('button', { name: 'Reset to default order' }).click();
  await sectionsPage.save();
  await page.goto(`/lists/${list.id}`);
  await expect.poll(() => detailPage.tileNames(detailPage.toBuyList())).toEqual(['Pineapple', 'Milk', 'Coffee']);
});
