import type { MessageSchema } from './en';

/**
 * Italian message catalog.
 *
 * `satisfies MessageSchema` proves the deep key tree is identical to `en`
 * (missing/extra keys are a compile error) while preserving the literal string
 * types so call-sites keep autocomplete.
 *
 * Strings asserted by e2e (Appendix A binding subset) are kept exactly as
 * specified:
 *   - common.signOut       -> "Esci"
 *   - common.saving        -> "Salvataggio…"
 *   - common.language      -> "Lingua"
 *   - account.accountDetails -> "Dettagli account"
 *   - account.fullName       -> "Nome completo"
 *   - account.emailAddress   -> "Indirizzo email"
 *   - account.saveChanges    -> "Salva modifiche"
 *   - account.saveError      -> "Impossibile salvare le modifiche. Riprova."
 *
 * Other keys are best-effort first-pass Italian.
 */
export const it = {
  common: {
    save: 'Salva',
    saving: 'Salvataggio…',
    cancel: 'Annulla',
    apply: 'Applica',
    back: 'Indietro',
    signOut: 'Esci',
    language: 'Lingua',
    delete: 'Elimina',
    deleting: 'Eliminazione…',
    settings: 'Impostazioni',
    loading: 'Caricamento…',
    close: 'Chiudi',
    saveChanges: 'Salva modifiche',
  },

  app: {
    fallbackTitle: 'App',
    openAccountPageAria: 'Apri la pagina account',
  },

  auth: {
    signingIn: 'Accesso in corso…',
    redirectingToLogin: 'Reindirizzamento al login…',
    missingToken: 'Token di autenticazione mancante.',
    sessionExpired: 'La tua sessione è scaduta. Accedi di nuovo.',
    oauthFailed: 'Accesso non riuscito. Riprova.',
  },

  login: {
    welcome: 'Bentornato',
    subtitle: 'La tua lista della spesa, già pronta',
    email: 'Email',
    password: 'Password',
    showPassword: 'Mostra password',
    hidePassword: 'Nascondi password',
    logIn: 'Accedi',
    loggingIn: 'Accesso in corso...',
    loginFailed: 'Impossibile accedere con queste credenziali.',
    signInUnavailable:
      'Accesso non disponibile — contatta un amministratore.',
  },

  shoppingLists: {
    title: 'Careto',
    loading: 'Caricamento delle liste...',
    loadFailed: 'Impossibile caricare le liste.',
    invitations: 'Inviti',
    invitedBy: 'Invitato da {name}',
    accept: 'Accetta',
    decline: 'Rifiuta',
    acceptError: "Impossibile accettare l'invito. Riprova.",
    declineError: 'Impossibile rifiutare l\'invito. Riprova.',
    noShoppingLists: 'Nessuna lista.',
    createShoppingList: '+ Crea lista',
    createShoppingListLabel: 'Nome della lista',
    createShoppingListPlaceholder: 'Nome della lista',
    create: 'Crea',
    creating: 'Creazione...',
    enterShoppingListName: 'Inserisci un nome per la lista.',
    createFailed: 'Impossibile creare la lista.',
    thumbnailAria: 'Immagine di {name}',
    shoppingListImageAria: 'Immagine di {name}',
  },

  shoppingListDetail: {
    settingsTitleSuffix: 'Impostazioni di {name}',
    loading: 'Caricamento della lista...',
    loadFailed: 'Impossibile caricare questa lista.',
    backToShoppingLists: 'Torna alle liste',
    toggleSettings: 'Apri le impostazioni',
    settings: 'Impostazioni',
    empty: 'Ancora niente qui.',
  },

  shoppingListSettings: {
    backToShoppingList: 'Torna alla lista',
    loading: 'Caricamento delle impostazioni...',
    shoppingListNameLabel: 'NOME DELLA LISTA',
    addMembersLabel: 'AGGIUNGI MEMBRI',
    emailPlaceholder: "utente{'@'}esempio.com",
    add: 'AGGIUNGI',
    membersLabel: 'MEMBRI ({count})',
    youLabel: 'Tu',
    pendingInvitationsLabel: 'INVITI IN SOSPESO',
    save: 'Salva',
    shoppingListNameEmpty: 'Il nome della lista non può essere vuoto.',
    updateNameError: 'Impossibile aggiornare il nome della lista.',
    addMemberEmailEmpty: 'Inserisci un indirizzo email.',
    addMemberError: 'Impossibile aggiungere il membro.',
    removeMemberError: 'Impossibile rimuovere {name}.',
    cancelInvitationError: "Impossibile annullare l'invito per {email}.",
    removeMemberAria: 'Rimuovi membro',
    cancelInvitationAria: "Annulla l'invito",
    changeImage: 'Cambia immagine',
    changeImageErrorInvalid: 'Seleziona un file immagine valido (JPEG, PNG o WebP).',
    changeImageErrorTooLarge: "L'immagine deve essere di 5 MB o inferiore.",
    changeImageErrorGeneric: 'Impossibile caricare l\'immagine. Riprova.',
    imageUploading: 'Caricamento immagine…',
  },

  account: {
    title: 'Account',
    accountDetails: 'Dettagli account',
    fullName: 'Nome completo',
    fullNamePlaceholder: 'Nome completo',
    emailAddress: 'Indirizzo email',
    saveChanges: 'Salva modifiche',
    saveError: 'Impossibile salvare le modifiche. Riprova.',
    signOut: 'Esci',
    signOutAria: 'Esci',
    backToShoppingLists: 'Torna alle liste',
    changePhoto: 'Cambia foto',
    changePhotoErrorInvalid: 'Seleziona un file immagine valido (JPEG, PNG o WebP).',
    changePhotoErrorTooLarge: 'L\'immagine deve essere di 5 MB o inferiore.',
    changePhotoErrorGeneric: 'Impossibile caricare la foto. Riprova.',
    photoUploading: 'Caricamento foto…',
    versionLabel: 'Versione',
  },

  dateTimePicker: {
    dateLabel: 'Data',
    selectDateAria: 'Seleziona data',
    selectDateHeading: 'SELEZIONA DATA',
    apply: 'Applica',
    cancel: 'Annulla',
  },
} satisfies MessageSchema;
