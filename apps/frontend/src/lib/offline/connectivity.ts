import { ref } from 'vue';

/**
 * Whether the browser believes it is online. `false` is reliable ("no
 * network at all"); `true` is not, so the outbox still treats a failed
 * request as offline (ADR-0030).
 */
export const browserOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    browserOnline.value = true;
  });
  window.addEventListener('offline', () => {
    browserOnline.value = false;
  });
}
