import { AppDataSource } from '../../db/data-source';

/**
 * Moves overrides still kept on `list_items` rows (ADR-0026) to
 * `list_item_overrides` (ADR-0029), then clears the old columns so a cleared
 * override is never copied back. Idempotent: safe on every startup.
 */
export async function migrateItemOverrides(): Promise<void> {
  await AppDataSource.transaction(async (manager) => {
    await manager.query(`
      INSERT INTO list_item_overrides
        (shopping_list_id, catalog_item_key, custom_item_id, icon_key, section_key)
      SELECT shopping_list_id, catalog_item_key, custom_item_id, icon_key, section_key
      FROM list_items
      WHERE icon_key IS NOT NULL OR section_key IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await manager.query(`
      UPDATE list_items SET icon_key = NULL, section_key = NULL
      WHERE icon_key IS NOT NULL OR section_key IS NOT NULL
    `);
  });
}
