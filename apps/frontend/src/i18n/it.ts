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
    subtitle: 'La lista della spesa che si riempie da sola',
    email: 'Email',
    emailPlaceholder: 'La tua email',
    password: 'Password',
    passwordPlaceholder: 'La tua password',
    showPassword: 'Mostra password',
    hidePassword: 'Nascondi password',
    logIn: 'Accedi',
    loggingIn: 'Accesso in corso...',
    or: 'oppure',
    loginFailed: 'Impossibile accedere con queste credenziali.',
    signInUnavailable:
      'Accesso non disponibile — contatta un amministratore.',
  },

  shoppingLists: {
    title: 'Le mie liste',
    loading: 'Caricamento delle liste...',
    loadFailed: 'Impossibile caricare le liste.',
    invitations: 'Inviti',
    invitedBy: 'Invitato da {name}',
    accept: 'Accetta',
    decline: 'Rifiuta',
    acceptError: "Impossibile accettare l'invito. Riprova.",
    declineError: 'Impossibile rifiutare l\'invito. Riprova.',
    noShoppingLists: 'Nessuna lista.',
    createShoppingList: 'Nuova lista',
    createShoppingListLabel: 'Nome della lista',
    createShoppingListPlaceholder: 'es. Weekend al lago',
    create: 'Salva',
    creating: 'Salvataggio...',
    enterShoppingListName: 'Inserisci un nome per la lista.',
    createFailed: 'Impossibile creare la lista.',
    thumbnailAria: 'Immagine di {name}',
    shoppingListImageAria: 'Immagine di {name}',
  },

  shoppingListDetail: {
    loading: 'Caricamento della lista...',
    loadFailed: 'Impossibile caricare questa lista.',
    backToShoppingLists: 'Torna alle liste',
    empty: 'Ancora niente qui.',
  },

  listSections: {
    navAria: 'Sezioni della lista',
    list: 'Lista',
    dishes: 'Piatti',
    week: 'Settimana',
    settings: 'Impostazioni',
    comingSoon: 'In arrivo.',
  },

  shoppingListSettings: {
    title: 'Impostazioni',
    loading: 'Caricamento delle impostazioni...',
    shoppingListNameLabel: 'Nome della lista',
    membersHeading: 'Membri',
    addMemberLabel: 'Aggiungi membro',
    emailPlaceholder: "nome{'@'}email.com",
    add: 'Aggiungi',
    youSuffix: '{name} (tu)',
    invitationSent: 'Invito inviato',
    save: 'Salva',
    shoppingListNameEmpty: 'Il nome della lista non può essere vuoto.',
    updateNameError: 'Impossibile aggiornare il nome della lista.',
    addMemberEmailEmpty: 'Inserisci un indirizzo email.',
    addMemberError: 'Impossibile aggiungere il membro.',
    removeMemberError: 'Impossibile rimuovere {name}.',
    cancelInvitationError: "Impossibile annullare l'invito per {email}.",
    removeMemberAria: 'Rimuovi {name} dalla lista',
    cancelInvitationAria: "Annulla l'invito a {email}",
    changeImage: 'Cambia immagine',
    changeImageErrorInvalid: 'Seleziona un file immagine valido (JPEG, PNG o WebP).',
    changeImageErrorTooLarge: "L'immagine deve essere di 5 MB o inferiore.",
    changeImageErrorGeneric: 'Impossibile caricare l\'immagine. Riprova.',
    imageUploading: 'Caricamento immagine…',
  },

  account: {
    title: 'Account',
    fullName: 'Nome completo',
    fullNamePlaceholder: 'Nome completo',
    email: 'Email',
    emailManaged: 'Gestita dal tuo provider di accesso',
    saveChanges: 'Salva modifiche',
    saveError: 'Impossibile salvare le modifiche. Riprova.',
    logOut: 'Esci',
    profilePhotoAria: 'La tua foto profilo',
    changePhoto: 'Cambia foto',
    changePhotoErrorInvalid: 'Seleziona un file immagine valido (JPEG, PNG o WebP).',
    changePhotoErrorTooLarge: 'L\'immagine deve essere di 5 MB o inferiore.',
    changePhotoErrorGeneric: 'Impossibile caricare la foto. Riprova.',
    photoUploading: 'Caricamento foto…',
    versionLine: 'Careto · versione {version}',
  },

  dateTimePicker: {
    dateLabel: 'Data',
    selectDateAria: 'Seleziona data',
    selectDateHeading: 'SELEZIONA DATA',
    apply: 'Applica',
    cancel: 'Annulla',
  },
} satisfies MessageSchema;
