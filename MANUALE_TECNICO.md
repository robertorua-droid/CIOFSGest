# Manuale Tecnico

## Architettura generale

Applicazione web client-side pensata per hosting statico, con supporto a:

- persistenza locale
- Firebase Authentication
- Firestore come backend dati utente

## Struttura logica

Macro aree funzionali:

- bootstrap applicazione
- autenticazione e sessione
- repository dati locale/Firebase
- UI e navigazione sezioni
- moduli anagrafiche
- moduli magazzino
- moduli vendite
- moduli acquisti
- report/statistiche
- backup e ripristino

## Persistenza dati

### Modalità locale
I dati vengono salvati in cache/browser.

### Modalità Firebase
I dati utente vengono salvati nello spazio Firestore:

- `users/{uid}/...` per i dati del gestionale
- `appUsers/{uid}` per il profilo applicativo

Questa separazione permette:

- pulizia per singolo utente
- reset classe
- isolamento dati tra allievi

## Ruoli e autorizzazioni applicative

Ruoli principali:

- `User`
- `Supervisor`

Esiste inoltre un utente docente principale identificato da:

- `roberto.rua@gmail.com`

Alcune funzioni di manutenzione sono abilitate solo a tale utente.

## Funzioni amministrative speciali

### Drop dati utente
Cancella i dati Firestore del singolo utente.

### Elimina profilo
Cancella il profilo applicativo da `appUsers`.

### Reset classe
Cancella, per tutti gli utenti `User`:

- dati gestionali Firestore
- profili applicativi

Non elimina gli account da Firebase Authentication.

## Regole Firestore

Per far funzionare correttamente:

- drop dati singolo
- reset classe
- eliminazione profilo

serve che le regole Firestore consentano al docente principale di:

- leggere i profili utenti
- cancellare `appUsers/{uid}`
- cancellare `users/{uid}/{document=**}`

I Supervisor normali non devono avere gli stessi poteri del docente principale.

## Numerazione documenti

La numerazione di:

- ordini cliente
- ordini fornitore

deve essere ricavata non solo dai contatori, ma anche dai documenti già presenti nel dataset, per evitare collisioni.

Ultima revisione:
- proposta numero coerente con il massimo esistente
- controllo finale di unicità al salvataggio

## Stati documentali

### Ordine Cliente
- In lavorazione
- Parzialmente Evaso
- Evaso

La logica corretta richiede:
- `Evaso` se tutte le righe sono complete
- `Parzialmente Evaso` se almeno una riga ha quantità spedita > 0 ma l'ordine non è completo
- `In lavorazione` se nulla è stato spedito

### Ordine Fornitore
- Inviato
- Parzialmente Ricevuto
- Completato
- Aperto - Rifiutato

## DDT Cliente

Caratteristiche:
- creazione da ordine cliente
- evasione totale o parziale
- campo note
- ripristino coerente in caso di eliminazione
- blocco eliminazione se collegato a fattura

## DDT Fornitore

Caratteristiche:
- ricezione normale
- ricezione con riserva
- merce rifiutata
- annotazioni obbligatorie in caso di riserva/rifiuto
- nessun carico di magazzino in caso di rifiuto

## PDF

La generazione PDF per:

- DDT Cliente
- Fatture Cliente

richiede la presenza in pagina delle librerie:

- jsPDF
- jsPDF AutoTable

## Statistiche

### User
Statistiche operative di movimentazione.

### Ruoli elevati
Statistiche direzionali/commerciali.

## Backup

L'export da Firebase deve:

1. attendere la sincronizzazione
2. leggere il remoto aggiornato
3. verificare l'allineamento essenziale
4. esportare il JSON

## Raccomandazioni di manutenzione

Prima di ogni rilascio:

1. test numerazione ordini
2. test DDT cliente totale e parziale
3. test DDT fornitore con riserva e rifiuto
4. test fatturazione multipla
5. test PDF
6. test backup/export Firebase
7. test reset classe su ambiente di prova

## Limiti noti

- eliminazione account Firebase Authentication non gestita dal client
- da eseguire manualmente in Firebase Console
- consigliato uso di ambiente di test prima di interventi massivi
