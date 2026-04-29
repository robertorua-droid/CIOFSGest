# Firebase + GitHub Pages (dati per singolo utente)

Questa versione del gestionale usa **Firestore** come archivio remoto (opzionale) e salva i dati nello spazio:

`users/{uid}/...`

dove `{uid}` è l'identificativo restituito da **Firebase Authentication**.

## 1) Firebase Console – configurazione minima

1. **Authentication → Sign-in method**
   - abilita **Email/Password** (consigliato) e, se vuoi, anche **Anonymous** come fallback.

2. **Authentication → Settings → Authorized domains**
   - aggiungi: `robertorua-droid.github.io`

3. **Firestore Database → Rules**
   - regole consigliate (per singolo utente):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

> Nota: evitare regole “aperte” (database pubblico) perché chiunque può scrivere/cancellare dati.

## 2) Dove mettere la configurazione

La configurazione web app è in:

`src/core/firebaseConfig.js`

## 3) Test import backup (JSON)

Vai in **Impostazioni → Avanzate** e usa la card:

**Test Import Backup (JSON → Schema → Firebase)**

- “Carica esempio incluso” usa il file:
  `data/admin_gestionale_backup_2025-11-14.json`
- Puoi anche caricare un tuo file `.json`
- Dopo l’anteprima:
  - **Importa nel gestionale (locale)**: carica il DB nel browser
  - **Importa su Firebase (utente)**: salva su Firestore sotto `users/{uid}`

## 4) Attivare Firebase come archivio principale

In **Impostazioni → Avanzate** abilita lo switch:

“Usa Firebase come archivio principale”

e premi “Scarica da Firebase” (oppure importa prima un backup su Firebase).


## Directory utenti e ruoli (appUsers)

Per gestire i ruoli (User/Supervisor) dall'app serve una collezione globale `appUsers/{uid}`.
Esempio regole consigliate:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn(){ return request.auth != null; }
    function isSupervisor(){
      return signedIn() && get(/databases/$(database)/documents/appUsers/$(request.auth.uid)).data.role == 'Supervisor';
    }

    // Dati gestionali per singolo utente
    match /users/{uid}/{document=**} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }

    // Directory utenti globale (ruoli)
    match /appUsers/{uid} {
      allow read: if signedIn() && (request.auth.uid == uid || isSupervisor());

      // Ogni utente può creare il proprio profilo SOLO con ruolo User
      allow create: if signedIn() && request.auth.uid == uid && request.resource.data.role == 'User';

      // L'utente può aggiornare il proprio profilo ma NON cambiare ruolo
      allow update: if signedIn() && (
        (request.auth.uid == uid && request.resource.data.role == resource.data.role)
        || isSupervisor()
      );

      allow delete: if isSupervisor();
    }
  }
}
```

> Nota: per la prima attivazione del docente come Supervisor puoi aggiungere la sua email in `src/core/config.js` (SUPERVISOR_EMAILS).


### Nota Docente
Nel file `src/core/config.js` trovi già impostata l’email docente `roberto.rua@gmail.com` in `SUPERVISOR_EMAILS`. Se vuoi cambiarla, modifica quell’elenco e ripubblica su GitHub.


## 5) Utilizzo Firestore (classe)

La card “Utilizzo Firestore (classe)” (in Impostazioni → Avanzate) calcola la somma dei dati di **tutti gli utenti**.
Per farlo, il Supervisor deve poter **leggere** anche i dati degli altri utenti sotto `users/{uid}/...`.

Aggiungi quindi `|| isSupervisor()` alle regole di lettura:

```js
match /users/{uid}/{document=**} {
  allow read: if signedIn() && (request.auth.uid == uid || isSupervisor());
  allow write: if signedIn() && request.auth.uid == uid;
}
```

Nota: questo non permette al Supervisor di modificare i dati degli studenti (solo leggere).
