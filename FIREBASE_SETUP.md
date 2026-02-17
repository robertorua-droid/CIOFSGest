# Firebase + GitHub Pages (dati per singolo utente)

Questa versione del gestionale usa **Firestore** come archivio remoto (opzionale) e salva i dati nello spazio:

`users/{uid}/...`

dove `{uid}` è l'identificativo restituito da **Firebase Authentication**.

## 1) Firebase Console – configurazione minima

1. **Authentication → Sign-in method**
   - abilita **Anonymous** (consigliato per test veloci).

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
