# Gestionale OL - Versione modularizzata Firebase-only v1.42.0

Questa versione mantiene il refactoring Firebase-only e avvia la separazione della logica di dominio delle vendite dalla UI. L'applicazione è organizzata per aree funzionali, con un core condiviso per bootstrap, eventi, utilità, cache di sessione e sincronizzazione Firestore.

## Struttura

- `src/core/`
  - `app.js` → crea e pubblica `App` anche su `window.App` per debug controllato in browser.
  - `db.js` → wrapper dati Firebase-only con cache di sessione esclusivamente in memoria.
  - `firestoreRepo.js` → lettura/scrittura/diff delle collezioni Firestore.
  - `firebase.js`, `firebaseConfig.js`, `userDirectory.js` → Auth, configurazione e directory ruoli.
  - `events.js`, `utils.js`, `ui.js`, `home.js`, `stats.js`, `theme.js`.

- `src/domain/`
  - `inventory.service.js` → variazioni di giacenza centralizzate.
  - `masterdata.service.js` → CRUD anagrafiche centralizzato.
  - `backupMapper.js` → normalizzazione dei backup JSON precedenti verso lo schema corrente.
  - `sales.service.js` → logica di dominio per ordini cliente, DDT cliente, fatture e rollback documenti.

- `src/features/`
  - `login/` → autenticazione Firebase e ingresso applicativo.
  - `anagrafiche/` → clienti, fornitori, prodotti.
  - `magazzino/` → movimenti manuali, giacenze, inventario.
  - `vendite/` → UI e orchestrazione dei flussi per ordini cliente, DDT e fatture.
  - `acquisti/` → ordini fornitore, DDT in entrata, quarantena e resi fornitore.
  - `impostazioni/` → azienda, utenti Firebase, backup/import Firestore, release e changelog.

## Persistenza dati

Firestore è l'unica persistenza dei dati applicativi. `App.db` mantiene una cache normalizzata in memoria valida solo per la sessione corrente e sincronizza tramite `firestoreRepo`.

`localStorage` e `sessionStorage` non sono usati in nessuna parte del progetto. Il tema UI segue la preferenza di sistema all’avvio e il toggle resta valido solo nella sessione corrente.

## Bootstrap

1. `src/main.js` inizializza tema, sidebar, feature e badge sorgente dati.
2. `App.boot()` inizializza Firebase.
3. I dati applicativi vengono caricati da Firestore solo dopo una sessione Firebase valida.
4. Se Firestore non è leggibile, l'errore resta esplicito: non esiste fallback operativo locale.

## Eventi principali

- `logged-in` → emesso dopo login Firebase e caricamento Firestore.
- `db:changed` → emesso a ogni salvataggio in cache di sessione o caricamento remoto.
- `sync:status` → stato della sincronizzazione Firestore.
- `products:changed`, `customers:changed`, `suppliers:changed` → eventi dai servizi anagrafiche.
- `inventory:changed` → evento dal servizio magazzino.

## Verifica Node.js

Eseguire dalla root del progetto:

```bash
npm run verify
```

`verify` esegue sia `verify:firebase-only` sia `test:domain`. Lo script Firebase-only controlla sintassi JavaScript, metadati di versione, assenza della cartella `legacy/`, assenza di riferimenti operativi alla vecchia modalità locale e assenza totale di `localStorage`/`sessionStorage`.

## Esecuzione

`index.html` carica `src/main.js` come ES Module. Aprire il progetto con un piccolo server statico, per esempio Live Server di VS Code, non con doppio click su `file://`.

## Refactor Vendite 1.42.0

La logica di calcolo e mutazione dati delle vendite è stata spostata in `src/domain/sales.service.js`. La feature `src/features/vendite/index.js` resta responsabile di DOM, modali, toast, stampa e chiamate ai servizi. Questa separazione permette test Node.js sui casi di dominio senza browser.

Aggiornamento 1.43.0: la logica di dominio dell’area Acquisti/Fornitori è stata separata in src/domain/purchasing.service.js. La feature acquisti mantiene UI, rendering e orchestrazione, mentre stato ordine, DDT, quarantena, resi e rollback sono coperti da test Node.js.

Aggiornamento 1.44.0: backup, import, export e cancellazione dati Firebase sono ora orchestrati da src/domain/backup.service.js. La schermata Impostazioni mantiene le sole responsabilità UI e invoca il servizio per normalizzazione, controlli di allineamento e operazioni Firestore.

## Step 12 - Test dominio consolidati

La versione 1.45.0 consolida i test Node.js sui service di dominio già estratti. La nuova suite `tests/domain-regressions.test.mjs` copre casi trasversali su normalizzazione schema, vendite, acquisti/quarantena e backup Firebase-only. L'obiettivo è ridurre regressioni prima di ulteriori separazioni UI/HTML.

## Step 13 - Pulizia prudente index.html

La versione 1.46.0 non separa ancora `index.html` in template esterni, per evitare regressioni su hosting statico e apertura browser-native. Sono stati aggiunti marker strutturali per le aree principali e una verifica Node.js dedicata alla coerenza degli id e dei target di navigazione.


Aggiornamento 1.47.0: il repository Firestore è stato suddiviso in moduli interni per costanti, batch, stato di sincronizzazione e repository operativo. `src/core/firestoreRepo.js` resta una facciata compatibile, quindi non cambiano bootstrap, login, backup o flussi utente.


Aggiornamento 1.50.0: la logica di calcolo delle statistiche è stata separata in `src/domain/stats.service.js`. `src/core/stats.js` mantiene solo rendering Chart.js, aggiornamento DOM e tabelle, riducendo il rischio di regressioni sui KPI. La release 1.50.0 consolida gli step di modularizzazione 14 e 15.

## Aggiornamento 1.55.0 - Confini logici consolidati

La struttura `core / domain / features` è stata ulteriormente rafforzata:

- le regole pure di inventario e anagrafiche sono in `inventory.rules.js` e `masterdata.rules.js`;
- i service applicativi mantengono l'orchestrazione verso `App.db.mutate()` ed eventi UI;
- i permessi documentali sono centralizzati in `permissions.service.js`;
- le regole di integrità referenziale sono in `referentialIntegrity.service.js`;
- la verifica `npm run verify` controlla Firebase-only, HTML, struttura logica e test dominio.

Il flusso consigliato resta: UI → service applicativo → regole pure → mutazione DB controllata → Firestore.

## Aggiornamento 1.56.0 - Mutazioni DB controllate estese

- i moduli feature non chiamano più direttamente `App.db.save()`; le modifiche passano da `App.db.mutate(label, updater)`;
- vendite, acquisti, impostazioni, login e inventario fisico hanno mutazioni etichettate per ridurre salvataggi sparsi e regressioni;
- gli aggiornamenti stock/quarantena dei flussi documentali più critici sono stati portati dentro la mutazione del flusso applicativo;
- `tools/verify-structure.mjs` controlla che nei moduli feature non ricompaiano salvataggi diretti o shortcut inventario fuori mutazione.

## Aggiornamento 1.57.0 - Mutazioni DB transazionali

- `App.db.mutate(label, updater)` usa ora un runner dedicato in `src/core/dbMutation.js`.
- L'updater lavora su un draft isolato del database in memoria: lo stato condiviso viene sostituito e sincronizzato solo se la mutazione termina senza errori.
- Le mutazioni annidate sono bloccate per evitare salvataggi parziali difficili da tracciare.
- Gli updater asincroni non sono ammessi: le operazioni remote devono essere eseguite prima/dopo la mutazione, non dentro il draft.
- La verifica strutturale controlla che non ricompaiano salvataggi DB diretti fuori dal wrapper dati.

## Aggiornamento 1.58.0 - Split UI features

La versione 1.58.0 separa ulteriormente le UI grandi senza modificare i flussi funzionali. Vendite usa moduli dedicati per rendering ordini, DDT e fatture; Acquisti usa moduli dedicati per ordini, DDT/resi e quarantena; Impostazioni è ora divisa in moduli UI per azienda, utenti, avanzate e release/changelog.

Gli entrypoint `index.js` restano responsabili di inizializzazione, wiring eventi e compatibilità con il resto dell'app. La logica di dominio continua a vivere nei service e le modifiche dati continuano a passare da `App.db.mutate()`.

## 1.59.0 - Audit escaping HTML dinamico
Lo step 19 consolida la protezione dei rendering basati su `innerHTML`: i dati provenienti da Firebase o inseriti dagli utenti devono passare da `App.utils.escapeHtml()` prima di essere interpolati in template HTML. Il controllo `npm run verify:html-escaping` verifica i punti più critici e viene incluso nel comando `npm run verify`.

## 1.60.0 - Layer stampa/PDF separato

La versione 1.60.0 estrae la generazione PDF dai moduli UI principali. I file `src/features/vendite/index.js` e `src/features/acquisti/index.js` restano responsabili di modali, eventi e feedback utente, mentre la costruzione dei PDF passa a `src/printing/sales.print.js` e `src/printing/purchasing.print.js`. Gli helper comuni sono in `src/printing/common.print.js`.

La verifica `tools/verify-printing.mjs`, inclusa in `npm run verify`, controlla che la logica `jsPDF` non ricompaia nei moduli feature di vendite e acquisti.

## 1.61.0 - Guardia conflitti Firestore

Lo step 21 completa la base `meta.revision`: la revision viene persistita in `meta/app` e il wrapper DB confronta la revision remota prima di ogni sync. Se un altro browser o utente ha già salvato una versione più recente, la sincronizzazione viene bloccata e l'utente deve ricaricare i dati da Firebase prima di proseguire.

Il controllo è implementato in `src/core/firestore/conflict.js` e integrato da `src/core/db.js` tramite `repo.assertRemoteRevision(...)`.

## Verifiche smoke browser/DOM

Dalla versione 1.62.0 il progetto include `tools/verify-browser-smoke.mjs`, una verifica Node.js leggera che simula una smoke checklist browser senza introdurre dipendenze esterne. Controlla id essenziali, script browser, ordine Bootstrap/main module, collegamenti sidebar/sezioni, modali Bootstrap e grafo degli import locali da `src/main.js`.

## Release finale 1.65.0

La versione 1.65.0 chiude il refactoring strutturale. La baseline stabile mantiene la sequenza architetturale UI -> service di dominio -> mutazioni DB controllate -> cache di sessione -> Firestore. Sono inclusi controlli automatici su Firebase-only/localStorage-zero, struttura HTML, confini logici, escaping HTML, layer stampa/PDF, smoke test browser/DOM e coerenza release.


## Aggiornamento 1.66.0 - DDT Fornitore a tab
La sezione `Elenco DDT Fornitore` è ora divisa in due tab: `Ricevuti dal Fornitore` per i DDT in ingresso e `Resi al Fornitore` per i DDT di reso generati dalla quarantena. La scelta mantiene distinti i flussi documentali in entrata e in uscita senza aggiungere una nuova area applicativa.
