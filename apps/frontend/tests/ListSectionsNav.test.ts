import { describe, it, expect } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';

import ListSectionsNav, { type ListSection } from '@/components/list-sections/ListSectionsNav.vue';
import { i18n, setAppLocale } from '@/i18n';

const mountNav = (current: ListSection) =>
  mount(ListSectionsNav, {
    props: { shoppingListId: 'list-1', shoppingListName: 'Home', current },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  });

describe('ListSectionsNav', () => {
  it('links the four sections of the list, forwarding the list name as history state', () => {
    setAppLocale('en');
    const links = mountNav('list-detail').findAllComponents(RouterLinkStub);

    expect(links.map((l) => l.text())).toEqual(['List', 'Dishes', 'Week', 'Settings']);
    expect(links.map((l) => l.props('to'))).toEqual(
      ['list-detail', 'list-dishes', 'list-week', 'list-settings'].map((name) => ({
        name,
        params: { id: 'list-1' },
        state: { shoppingListName: 'Home' },
      })),
    );
    // Sections are siblings (ADR-0022): tabs replace instead of pushing.
    expect(links.every((l) => l.attributes('replace') !== undefined)).toBe(true);
  });

  it('marks only the current section with aria-current and the accent colour', () => {
    const links = mountNav('list-settings').findAll('a');

    expect(links.map((l) => l.attributes('aria-current'))).toEqual([
      undefined,
      undefined,
      undefined,
      'page',
    ]);
    expect(links[3].classes()).toContain('text-accent');
    expect(links[0].classes()).not.toContain('text-accent');
  });

  it('labels the bar and its tabs in the active locale', () => {
    setAppLocale('it');
    const wrapper = mountNav('list-week');

    expect(wrapper.find('nav').attributes('aria-label')).toBe('Sezioni della lista');
    expect(wrapper.findAll('a').map((l) => l.text())).toEqual([
      'Lista',
      'Piatti',
      'Settimana',
      'Impostazioni',
    ]);
    setAppLocale('en');
  });
});
