import { ref, type Ref } from 'vue';

import { insertionIndex } from '@/lib/sectionOrder';

/** Within this many px of the scroller's edge, a drag scrolls it. */
const EDGE_PX = 56;
const SCROLL_STEP_PX = 10;

/**
 * Pointer-driven reordering of the store sections (ADR-0026): press a row's
 * grip and move. Hand-written like the sheet drag (ADR-0021), because HTML5
 * drag and drop never fires on touch screens. Rows are the elements under
 * `listRef` marked `[data-section-row]`.
 */
export function useSectionDrag(
  listRef: Ref<HTMLElement | null>,
  scrollerRef: Ref<HTMLElement | null>,
  onDrop: (from: number, insertAt: number) => void,
) {
  /** The row being dragged, its vertical offset, and where it would land. */
  const dragIndex = ref<number | null>(null);
  const dragY = ref(0);
  const overIndex = ref<number | null>(null);

  let pointerId: number | null = null;
  let startY = 0;
  let startScroll = 0;

  const rowMiddles = () =>
    Array.from(listRef.value?.querySelectorAll<HTMLElement>('[data-section-row]') ?? []).map(
      (row, index) => {
        const rect = row.getBoundingClientRect();
        // The dragged row is offset by the drag; measure where it rests.
        const offset = index === dragIndex.value ? dragY.value : 0;
        return rect.top - offset + rect.height / 2;
      },
    );

  const autoScroll = (y: number) => {
    const scroller = scrollerRef.value;
    if (!scroller) return;
    const { top, bottom } = scroller.getBoundingClientRect();
    if (y < top + EDGE_PX) scroller.scrollTop -= SCROLL_STEP_PX;
    else if (y > bottom - EDGE_PX) scroller.scrollTop += SCROLL_STEP_PX;
  };

  const onPointerDown = (index: number, event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    pointerId = event.pointerId;
    startY = event.clientY;
    startScroll = scrollerRef.value?.scrollTop ?? 0;
    dragIndex.value = index;
    dragY.value = 0;
    overIndex.value = null;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || dragIndex.value === null) return;
    autoScroll(event.clientY);
    const scrolled = (scrollerRef.value?.scrollTop ?? 0) - startScroll;
    dragY.value = event.clientY - startY + scrolled;
    overIndex.value = insertionIndex(rowMiddles(), event.clientY);
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const from = dragIndex.value;
    const to = overIndex.value;
    pointerId = null;
    dragIndex.value = null;
    overIndex.value = null;
    dragY.value = 0;
    // A cancelled drag (scroll takeover, system gesture) drops nothing.
    if (event.type === 'pointercancel') return;
    if (from !== null && to !== null && to !== from && to !== from + 1) onDrop(from, to);
  };

  return { dragIndex, dragY, overIndex, onPointerDown, onPointerMove, onPointerEnd };
}
