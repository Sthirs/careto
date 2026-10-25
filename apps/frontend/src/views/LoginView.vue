<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive({
  email: 'demo@careto.local',
  password: 'password123',
});

const errorMessage = ref('');
const showPassword = ref(false);
const oauthConfig = ref<{ enabled: boolean; buttonText: string; autoLaunch: boolean } | null>(null);
const authConfig = ref<{ localLoginEnabled: boolean; localRegistrationEnabled: boolean } | null>(null);

const redirectTarget = computed(() => String(route.query.redirect ?? '/lists'));

/**
 * Surface the `?error=` the redirecting caller set. Both producers already
 * existed or arrive with ADR-0018 — `oauth_failed` from AuthCallbackView and
 * `expired` from the session-expiry handler in main.ts — but nothing rendered
 * them, so the user was bounced here with no explanation.
 */
const ERROR_MESSAGE_KEYS: Record<string, string> = {
  expired: 'auth.sessionExpired',
  oauth_failed: 'auth.oauthFailed',
};

const submit = async () => {
  errorMessage.value = '';

  try {
    await authStore.login(form);
    await router.push(redirectTarget.value);
  } catch {
    errorMessage.value = t('login.loginFailed');
  }
};

onMounted(async () => {
  const errorKey = ERROR_MESSAGE_KEYS[String(route.query.error ?? '')];
  if (errorKey) errorMessage.value = t(errorKey);

  try {
    const { data } = await api.get('/auth/oauth/config');
    oauthConfig.value = data;
    if (data.autoLaunch && data.enabled) {
      window.location.href = '/api/auth/oauth';
    }
  } catch {
    // OAuth config endpoint unavailable — hide the button
  }
  try {
    const { data } = await api.get('/auth/config');
    authConfig.value = data;
  } catch {
    // auth/config unavailable — default to showing form
  }
});
</script>

<template>
  <main class="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col px-6 pt-4 pb-7">
    <div class="flex flex-1 flex-col items-center justify-center gap-3.5 py-8 text-center">
      <div class="flex h-37 w-37 items-center justify-center rounded-full bg-[#F3EBDD] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        <img src="/careto-trolley.svg" alt="Careto logo" class="h-31 w-31" />
      </div>
      <h1 class="mt-1.5 text-5xl leading-none font-black tracking-[-0.02em] text-white">Careto</h1>
      <p class="text-[17px] font-bold text-text-secondary">{{ t('login.subtitle') }}</p>
    </div>

    <div class="flex flex-col gap-3">
      <form
        v-if="authConfig === null || authConfig.localLoginEnabled"
        class="flex flex-col gap-3"
        @submit.prevent="submit"
      >
        <div class="flex flex-col gap-1.5">
          <label for="email" class="pl-1 text-sm font-extrabold text-text-secondary">{{ t('login.email') }}</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            autocomplete="username"
            required
            :placeholder="t('login.emailPlaceholder')"
            class="h-13 w-full rounded-xl bg-white px-4 text-[17px] text-ink outline-none placeholder:text-[#6B7680] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="password" class="pl-1 text-sm font-extrabold text-text-secondary">{{ t('login.password') }}</label>
          <div class="relative">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :placeholder="t('login.passwordPlaceholder')"
              class="h-13 w-full rounded-xl bg-white px-4 pr-14 text-[17px] text-ink outline-none placeholder:text-[#6B7680] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
            <button
              type="button"
              class="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg focus-visible:outline-3 focus-visible:outline-accent"
              :aria-label="showPassword ? t('login.hidePassword') : t('login.showPassword')"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <img v-if="showPassword" src="/icons/eye-pwd-show.svg" alt="" aria-hidden="true" class="h-5 w-[22px] brightness-[0.45]" />
              <img v-else src="/icons/eye-pwd-hide.svg" alt="" aria-hidden="true" class="h-5 w-[22px] brightness-[0.45]" />
            </button>
          </div>
        </div>

        <p v-if="errorMessage" role="alert" class="rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-semibold text-white">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="authStore.isLoading"
          class="mt-1.5 flex h-13.5 w-full items-center justify-center rounded-full bg-brand-500 text-lg font-extrabold text-white transition hover:bg-brand-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ authStore.isLoading ? t('login.loggingIn') : t('login.logIn') }}
        </button>
      </form>

      <p
        v-else-if="!oauthConfig?.enabled"
        class="rounded-xl border border-outline bg-surface px-4 py-4 text-center text-sm text-text-secondary"
      >
        {{ t('login.signInUnavailable') }}
      </p>

      <template v-if="oauthConfig?.enabled">
        <div
          v-if="authConfig === null || authConfig.localLoginEnabled"
          aria-hidden="true"
          class="flex items-center gap-3 text-sm font-bold text-text-muted"
        >
          <span class="h-px flex-1 bg-divider"></span>{{ t('login.or') }}<span class="h-px flex-1 bg-divider"></span>
        </div>
        <a
          href="/api/auth/oauth"
          class="flex h-13.5 w-full items-center justify-center gap-2.5 rounded-full border-2 border-outline text-[17px] font-extrabold text-white transition hover:bg-white/5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 7a4 4 0 1 1-3.5 6L4 20.5V17h3v-3h3l1.5-1.5A4 4 0 0 1 15 7z M16 10h.01" />
          </svg>
          {{ oauthConfig.buttonText }}
        </a>
      </template>
    </div>
  </main>
</template>
