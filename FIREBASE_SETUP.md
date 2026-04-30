# Firebase + GitHub Pages - Gestionale Firebase-only v1.68.0

Il gestionale usa Firebase Authentication e Firestore come unico archivio operativo dei dati applicativi. I dati di ciascun utente sono salvati sotto:

`users/{uid}/...`

dove `{uid}` è l'identificativo restituito da Firebase Authentication.

## 1) Firebase Console - configurazione minima

1. **Authentication → Sign-in method**
   - abilita **Email/Password**.

2. **Authentication → Settings → Authorized domains**
   - aggiungi il dominio GitHub Pages o il dominio da cui pubblichi il gestionale.

3. **Firestore Database → Rules**
   - usa regole che consentano a ogni utente di leggere/scrivere il proprio spazio dati.

Esempio base per dati per singolo utente:

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

> Nota: evitare regole aperte, perché chiunque potrebbe scrivere o cancellare dati.

## 2) Configurazione web app

La configurazione Firebase della web app è in:

`src/core/firebaseConfig.js`

Aggiorna lì i valori `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` e `appId`.

## 3) Backup, import e dataset esempio

Vai in **Impostazioni → Avanzate** e usa la card backup/import.

- **Esporta backup Firebase** forza la sincronizzazione e scarica un JSON letto da Firestore.
- **Carica esempio incluso** usa `data/admin_gestionale_backup_2025-11-14.json` solo come sorgente di anteprima.
- **Importa su Firebase** normalizza il JSON nello schema corrente e scrive su Firestore sotto `users/{uid}`.
- L'opzione di svuotamento prima dell'import elimina i documenti Firestore dell'utente corrente prima di riscrivere il dataset.

Non esiste una modalità operativa locale per i dati gestionali e non esistono fallback automatici su cache browser.

## 4) Directory utenti e ruoli (`appUsers`)

Per gestire i ruoli `User` e `Supervisor` dall'app serve una collezione globale:

`appUsers/{uid}`

Esempio regole consigliate:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn(){ return request.auth != null; }
    function isSupervisor(){
      return signedIn() && get(/databases/$(database)/documents/appUsers/$(request.auth.uid)).data.role == 'Supervisor';
    }

    match /users/{uid}/{document=**} {
      allow read, write: if signedIn() && (request.auth.uid == uid || isSupervisor());
    }

    match /appUsers/{uid} {
      allow read: if signedIn() && (request.auth.uid == uid || isSupervisor());
      allow create: if signedIn() && request.auth.uid == uid && request.resource.data.role == 'User';
      allow update: if signedIn() && (
        (request.auth.uid == uid && request.resource.data.role == resource.data.role)
        || isSupervisor()
      );
      allow delete: if isSupervisor();
    }
  }
}
```

Per la prima attivazione del docente come Supervisor puoi aggiungere la sua email in `src/core/config.js`, nell'elenco `SUPERVISOR_EMAILS`.

## 5) Utilizzo Firestore della classe

La card **Utilizzo Firestore (classe)** calcola la somma dei dati di tutti gli utenti. Per usarla, il Supervisor deve poter leggere anche i dati degli altri utenti sotto `users/{uid}/...`.

Regola di lettura ampliata:

```js
match /users/{uid}/{document=**} {
  allow read: if signedIn() && (request.auth.uid == uid || isSupervisor());
  allow write: if signedIn() && request.auth.uid == uid;
}
```

Questo permette al Supervisor di leggere e, dalla versione 1.68.0, cancellare/riscrivere i dataset degli studenti per la pulizia classe. Usa questa regola solo per account docente/supervisor affidabili.

## 6) Verifica finale del pacchetto

Dalla root del progetto esegui:

```bash
npm run verify:firebase-only
```

Il controllo deve terminare con esito positivo prima della pubblicazione o consegna agli allievi.


## Storage browser

La versione 1.41.0 non usa localStorage né sessionStorage. Tutta la persistenza applicativa passa da Firebase/Firestore; il tema non viene salvato nel browser e non esiste un device id persistente.

Aggiornamento 1.44.0: backup, import, export e cancellazione dati Firebase sono ora orchestrati da src/domain/backup.service.js. La schermata Impostazioni mantiene le sole responsabilità UI e invoca il servizio per normalizzazione, controlli di allineamento e operazioni Firestore.

## Verifiche 1.45.0

La versione 1.45.0 mantiene il modello Firebase-only/localStorage-zero e aggiunge test Node.js di regressione sui service di dominio. Eseguire `npm run verify` prima di pubblicare il pacchetto.

## Verifiche 1.46.0

La verifica completa include ora anche `npm run verify:html`, che controlla la coerenza di `index.html` e l'assenza di residui testuali legati alla vecchia modalità locale.


Aggiornamento 1.47.0: il repository Firestore è stato suddiviso in moduli interni per costanti, batch, stato di sincronizzazione e repository operativo. `src/core/firestoreRepo.js` resta una facciata compatibile, quindi non cambiano bootstrap, login, backup o flussi utente.


Aggiornamento 1.50.0: la logica di calcolo delle statistiche è stata separata in `src/domain/stats.service.js`. `src/core/stats.js` mantiene solo rendering Chart.js, aggiornamento DOM e tabelle, riducendo il rischio di regressioni sui KPI. La release 1.50.0 consolida gli step di modularizzazione 14 e 15.

## Verifica versione 1.55.0

Dopo l'aggiornamento eseguire:

```bash
npm run verify
```

La verifica controlla Firebase-only/localStorage-zero, struttura HTML, confini logici dei moduli e test Node.js di dominio.

## Verifica versione 1.56.0

La versione 1.56.0 mantiene il progetto Firebase-only e localStorage-zero. Le modifiche applicative delle schermate principali passano da mutazioni DB controllate; eseguire `npm run verify` per controllare Firebase-only, struttura HTML, confini logici e test di dominio.

## Verifica versione 1.57.0

La versione 1.57.0 mantiene il progetto Firebase-only e localStorage-zero. Il wrapper dati usa mutazioni transazionali su cache in memoria: eseguire `npm run verify` per controllare Firebase-only, struttura HTML, confini logici e test di dominio.

## Verifica versione 1.58.0

La versione 1.58.0 mantiene il progetto Firebase-only e localStorage-zero. I nuovi moduli UI non introducono persistenza locale e continuano a usare il wrapper Firebase-only esistente. Eseguire `npm run verify` per controllare Firebase-only, struttura HTML, confini logici e test di dominio.

## Versione 1.59.0
Nessuna modifica richiesta alla configurazione Firebase. Lo step 19 riguarda la protezione dei rendering HTML dinamici e le verifiche automatiche locali.

## Verifica versione 1.60.0

La versione 1.60.0 mantiene il progetto Firebase-only e localStorage-zero. Il layer di stampa/PDF è separato in `src/printing/`; eseguire `npm run verify` per controllare Firebase-only, struttura HTML, escaping, layer stampa e test di dominio.

## Verifica versione 1.61.0

La versione 1.61.0 mantiene il progetto Firebase-only e localStorage-zero. Viene aggiunto il documento `meta/app` per persistere la revision applicativa e bloccare sovrascritture accidentali se Firebase è cambiato da un altro browser o utente. Non sono richieste modifiche manuali alle regole Firestore già usate dal progetto, purché il percorso `meta/*` sia incluso nelle regole dati dell'ambiente.

## Verifiche finali consigliate

Dalla versione 1.62.0, oltre alla verifica Firebase-only, è disponibile anche:

```bash
npm run verify:browser-smoke
```

Il controllo verifica che la pagina statica carichi le librerie browser attese, il modulo `src/main.js`, le sezioni collegate dalla sidebar e le modali richiamate dai pulsanti.

## Release finale 1.65.0

La release 1.65.0 conferma Firebase/Firestore come unica persistenza del gestionale. Prima della distribuzione eseguire npm run verify oppure i singoli script di verifica indicati nelle note finali di release.


## Aggiornamento 1.66.0
La consultazione dei DDT di reso al fornitore usa la collezione Firestore già prevista `supplierReturnDDTs`. Non sono richieste nuove regole Firebase rispetto alla baseline Firebase-only.

## Aggiornamento 1.67.0
Il Registro Prodotti Macerati legge lo storico già salvato nella collezione `supplierQuarantine`. Non sono richieste nuove collezioni, indici o regole Firebase rispetto alla baseline 1.66.0.


## Aggiornamento 1.67.1 - Patch gestione quarantena fornitori
- Ripristinato il collegamento eventi della modal Gestisci quantità quarantena.
- Il controllo somma si aggiorna di nuovo quando si compilano Svincola, Reso fornitore e Da distruggere.
- La conferma della gestione quarantena torna a generare il DDT di reso al fornitore quando previsto.
- Aggiunto test Node.js dedicato al wiring della UI quarantena per evitare regressioni.


## Pulizia classe supervisor - v1.68.0

La funzione Azioni amministrative classe richiede che il supervisor autorizzato possa:

- leggere `appUsers`;
- cancellare documenti `appUsers/{uid}` degli allievi;
- leggere/cancellare i dataset `users/{uid}` degli utenti della classe.

Il frontend non cancella account Firebase Authentication: per la rimozione completa degli allievi occorre cancellare manualmente gli account da Firebase Console → Authentication, oppure predisporre una Cloud Function/Admin SDK dedicata.

Il file `FIREBASE_RULES_WITH_ROLES.txt` contiene un esempio aggiornato compatibile con la pulizia classe supervisor.
