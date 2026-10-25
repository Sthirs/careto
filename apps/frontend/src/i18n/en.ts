/**
 * English message catalog.
 *
 * Source of truth for the entire i18n tree: every other locale MUST
 * `satisfies MessageSchema` against `typeof en`. Keys are kept flat at the
 * leaf and namespaced by feature area so review diffs stay localised.
 *
 * Every user-visible string from the frontend .vue components and
 * composables is listed here.
 */
export const en = {
  common: {
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    apply: 'Apply',
    back: 'Back',
    signOut: 'Sign Out',
    language: 'Language',
    delete: 'Delete',
    deleting: 'Deleting…',
    settings: 'Settings',
    loading: 'Loading…',
    close: 'Close',
    saveChanges: 'Save Changes',
  },

  app: {
    // Fallback title used by AppTopbar when no route meta or page title is set.
    fallbackTitle: 'App',
    // aria-label for the avatar button in the topbar that opens the account page.
    openAccountPageAria: 'Open account page',
  },

  auth: {
    // OAuth callback screen.
    signingIn: 'Signing you in…',
    redirectingToLogin: 'Redirecting to login…',
    missingToken: 'Missing authentication token.',
    // Shown on /login?error=… — the OAuth callback already redirected with
    // error=oauth_failed, and ADR-0018's expiry handler adds error=expired.
    sessionExpired: 'Your session expired. Please sign in again.',
    oauthFailed: 'Sign-in failed. Please try again.',
  },

  login: {
    subtitle: 'The grocery list that fills itself',
    email: 'Email',
    emailPlaceholder: 'Your email',
    password: 'Password',
    passwordPlaceholder: 'Your password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    logIn: 'Sign in',
    loggingIn: 'Signing in...',
    // Divider between the local form and the OAuth button.
    or: 'or',
    loginFailed: 'We could not log you in with those credentials.',
    signInUnavailable: 'Sign-in is not available — contact an administrator.',
  },

  shoppingLists: {
    // Page heading of the lists overview screen.
    title: 'My lists',
    loading: 'Loading your lists...',
    loadFailed: 'We could not load your lists.',
    invitations: 'Invitations',
    // Invitation card meta line, e.g. "Invited by Bob".
    invitedBy: 'Invited by {name}',
    accept: 'Accept',
    decline: 'Decline',
    acceptError: 'Could not accept the invitation. Please try again.',
    declineError: 'Could not decline the invitation. Please try again.',
    noShoppingLists: 'No lists yet.',
    createShoppingList: 'New list',
    createShoppingListLabel: 'List name',
    createShoppingListPlaceholder: 'e.g. Weekend at the lake',
    create: 'Save',
    creating: 'Saving...',
    enterShoppingListName: 'Enter a list name.',
    createFailed: 'We could not create your list.',
    // aria-labels (chrome): rendered when no list image is set, the prefix
    // wraps the dynamic list name. Keeping the prefix as a key makes the
    // list name still flow in via {name}.
    thumbnailAria: '{name} thumbnail',
    shoppingListImageAria: '{name} image',
  },

  shoppingListDetail: {
    // Page title — composed with the list name, e.g. "Home Settings".
    settingsTitleSuffix: '{name} Settings',
    loading: 'Loading list...',
    loadFailed: 'We could not load this list.',
    backToShoppingLists: 'Back to lists',
    toggleSettings: 'Toggle settings',
    settings: 'Settings',
    empty: 'Nothing here yet.',
  },

  shoppingListSettings: {
    backToShoppingList: 'Back to list',
    loading: 'Loading settings...',
    shoppingListNameLabel: 'LIST NAME',
    addMembersLabel: 'ADD MEMBERS',
    emailPlaceholder: "user{'@'}example.com",
    add: 'ADD',
    membersLabel: 'MEMBERS ({count})',
    youLabel: 'You',
    pendingInvitationsLabel: 'PENDING INVITATIONS',
    save: 'Save',
    shoppingListNameEmpty: 'List name cannot be empty.',
    updateNameError: 'Could not update the list name.',
    addMemberEmailEmpty: 'Please enter an email address.',
    addMemberError: 'Could not add member.',
    removeMemberError: 'Could not remove {name}.',
    cancelInvitationError: 'Could not cancel invitation for {email}.',
    removeMemberAria: 'Remove member',
    cancelInvitationAria: 'Cancel invitation',
    changeImage: 'Change image',
    changeImageErrorInvalid: 'Please select a valid image file (JPEG, PNG, or WebP).',
    changeImageErrorTooLarge: 'Image must be 5 MB or smaller.',
    changeImageErrorGeneric: 'Could not upload the image. Please try again.',
    imageUploading: 'Uploading image…',
  },

  account: {
    title: 'Account',
    accountDetails: 'Account Details',
    fullName: 'Full name',
    fullNamePlaceholder: 'Full name',
    emailAddress: 'Email address',
    saveChanges: 'Save Changes',
    saveError: 'Could not save your changes. Please try again.',
    signOut: 'Sign Out',
    signOutAria: 'Sign out',
    backToShoppingLists: 'Back to lists',
    changePhoto: 'Change photo',
    changePhotoErrorInvalid: 'Please select a valid image file (JPEG, PNG, or WebP).',
    changePhotoErrorTooLarge: 'Image must be 5 MB or smaller.',
    changePhotoErrorGeneric: 'Could not upload the photo. Please try again.',
    photoUploading: 'Uploading photo…',
    versionLabel: 'Version',
  },

  dateTimePicker: {
    dateLabel: 'Date',
    selectDateAria: 'Select date',
    selectDateHeading: 'SELECT DATE',
    apply: 'Apply',
    cancel: 'Cancel',
  },
} as const;

/**
 * Widens every leaf of `en` to `string` so that `it satisfies MessageSchema`
 * enforces SHAPE (key presence + depth) without demanding literal-equality of
 * the English text. Auto-translation is the whole point of having two locales.
 */
type WidenLeaves<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly WidenLeaves<U>[]
    : T extends object
      ? { readonly [K in keyof T]: WidenLeaves<T[K]> }
      : never;

export type MessageSchema = WidenLeaves<typeof en>;
