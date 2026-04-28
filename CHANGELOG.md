# Changelog

## 1.67.0 - Registro prodotti macerati
- aggiunta sotto Magazzino la vista `Registro Prodotti Macerati`.
- il registro espone in sola consultazione le quantità chiuse dalla quarantena fornitori come `Da distruggere` / `destroy`.
- la vista usa i dati già presenti in `supplierQuarantine`, senza introdurre nuova persistenza e senza creare lo storico completo per prodotto.
- aggiunti `src/domain/macerated.service.js`, `src/features/magazzino/macerated.ui.js` e `tests/macerated.service.test.mjs`.

## 1.66.0 - Consultazione DDT resi fornitore
- Riorganizzata la sezione Elenco DDT Fornitore con due tab: Ricevuti dal Fornitore e Resi al Fornitore.
- Integrato nella pagina DDT Fornitore l'elenco dei DDT di reso al fornitore, mantenendoli separati dai DDT ricevuti.
- Mantenute consultazione dettaglio, salvataggio dati reso, marcatura spedito e stampa PDF dei resi al fornitore.
- Aggiornati smoke test browser/DOM per distinguere correttamente target Bootstrap tab e target modal.

## 1.65.0 - Chiusura refactoring strutturale
- Consolidata la chiusura del refactoring dopo Firebase-only, localStorage-zero, service di dominio, mutazioni controllate, split UI, escaping HTML, layer stampa, guardia conflitti Firestore e smoke test DOM.
- Aggiunta verifica finale di release per controllare coerenza tra package.json, release.json, changelog, documentazione e script di verifica.
- Allineati manuali e guide alla struttura stabile del progetto e alla procedura consigliata di verifica prima della distribuzione.
- Preparato il pacchetto finale 1.65.0 come baseline stabile per nuove evoluzioni funzionali future.

## 1.62.0 - Smoke test browser/DOM
- aggiunto `tools/verify-browser-smoke.mjs` per controllare una smoke checklist browser/DOM senza dipendenze esterne.
- aggiunto `tools/browser-smoke-lib.mjs` con funzioni testabili per parser HTML leggero, controllo modali, sidebar e grafo import locali.
- aggiunto `tests/browser-smoke.test.mjs` e incluso il test nel runner dominio.
- aggiornato `npm run verify` includendo Firebase-only, struttura HTML, struttura logica, escaping, stampa e smoke test browser/DOM.

## 1.61.0 - Guardia conflitti Firestore
- persistita `meta.revision` su Firestore nel nuovo documento `meta/app`.
- il wrapper DB confronta la revision remota con la revision caricata in sessione prima di sincronizzare modifiche locali.
- se Firebase è stato aggiornato da un altro browser o utente, il salvataggio viene bloccato con errore esplicito e richiesta di ricarica.
- aggiunti `src/core/firestore/conflict.js` e `tests/firestore.conflict.test.mjs`, inclusi nelle verifiche di struttura e nei test dominio.

## 1.60.0 - Layer stampa/PDF separato
- estratta la generazione PDF DDT cliente e fatture in `src/printing/sales.print.js`.
- estratta la generazione PDF dei resi fornitore in `src/printing/purchasing.print.js`.
- aggiunti helper comuni in `src/printing/common.print.js` per jsPDF, righe anagrafiche, descrizioni e nomi file sicuri.
- aggiunti `tests/printing.test.mjs` e `tools/verify-printing.mjs`, inclusi in `npm run verify`.

## 1.59.0 - Audit escaping HTML dinamico
- estesa la protezione `escapeHtml` ai rendering dinamici di anagrafiche, magazzino, statistiche, utenti, release e dettagli documento.
- protette celle tabellari, option, attributi `data-*`, note e descrizioni generate da dati utente o da Firebase.
- aggiunta la verifica Node.js `tools/verify-html-escaping.mjs`.
- aggiornato `npm run verify` includendo il controllo escaping insieme a Firebase-only, HTML structure, structure e test dominio.


## 1.58.0 - Split UI features
- spezzati i rendering principali di Vendite in moduli UI dedicati a ordini, DDT e fatture.
- spezzati i rendering principali di Acquisti in moduli UI dedicati a ordini, DDT/resi e quarantena.
- separata la schermata Impostazioni in moduli UI dedicati ad azienda, utenti, avanzate e release/changelog.
- mantenuti invariati i flussi operativi: i nuovi moduli UI delegano ai service e al wrapper DB esistenti.
- rafforzata la verifica struttura sui nuovi confini UI e sulle mutazioni DB controllate.

## 1.57.0 - Mutazioni DB transazionali
- introdotto `src/core/dbMutation.js` per applicare le mutazioni su un draft isolato dello stato in memoria.
- `App.db.mutate()` salva e sincronizza solo se l'updater termina senza errori; in caso contrario la cache condivisa resta invariata.
- bloccate mutazioni annidate e updater asincroni per evitare stati parziali o salvataggi non deterministici.
- anche le note della home passano da `db.mutate()`, eliminando gli ultimi salvataggi DB diretti fuori dal wrapper dati.
- aggiunti test Node.js sul runner di mutazione e rafforzata `verify:structure`.

## 1.56.0 - Mutazioni DB controllate estese
- esteso l’uso di `App.db.mutate()` ai flussi principali di vendite, acquisti, impostazioni, login e inventario fisico.
- rimossi i salvataggi diretti `App.db.save()` dai moduli feature: il salvataggio resta centralizzato nel wrapper dati.
- spostati gli aggiornamenti stock/quarantena dei flussi documentali complessi dentro la stessa mutazione applicativa del documento collegato.
- rafforzata `verify:structure` per intercettare regressioni su salvataggi diretti o scorciatoie inventario fuori mutazione.

## 1.55.0 - Consolidamento struttura logica e sicurezza UI
- centralizzati permessi documentali in `permissions.service.js` e regole di integrità referenziale in `referentialIntegrity.service.js`.
- introdotto `escapeHtml` tra le utility comuni e applicata una prima protezione ai rendering principali di vendite e acquisti.
- rafforzata la mutazione DB controllata con `App.db.mutate()` e progressione `meta.revision` a ogni salvataggio.
- aggiunti test Node.js per permessi, integrità referenziale, utility HTML e regole pure inventario/anagrafiche.
- aggiunta `verify:structure` per controllare i nuovi confini logici tra UI, service e regole di dominio.

## 1.51.0 - Regole inventario e anagrafiche testabili
- estratte regole pure per inventario e quarantena in `src/domain/inventory.rules.js`.
- estratte regole pure per anagrafiche in `src/domain/masterdata.rules.js`.
- `inventory.service.js` e `masterdata.service.js` usano una mutazione applicativa controllata e mantengono eventi/UI invariati.
- aggiunti test Node.js dedicati alle regole pure e al comportamento stock/anagrafiche.


## 1.50.0 - Refactor statistiche e consolidamento modularizzazione
- estratta in `src/domain/stats.service.js` la logica di calcolo per movimenti, vendite per mese/cliente e qualità fornitore.
- `src/core/stats.js` resta dedicato a rendering Chart.js, DOM e tabelle statistiche.
- aggiunti test Node.js per statistiche movimento, vendite, percentuali e qualità fornitore.
- consolidata la release finale 1.50.0 dopo i controlli su Firebase-only, HTML, service e zip.

## 1.47.0 - Split repository Firestore
- suddiviso il repository Firestore in moduli dedicati a costanti, batch, stato diff e repository operativo.
- mantenuta una facciata compatibile in `src/core/firestoreRepo.js` per non cambiare i punti di integrazione esistenti.
- aggiunti test Node.js su diff delle collezioni, stato di sincronizzazione e collezioni critiche Firebase-only.
- confermati gli script di verifica Firebase-only/localStorage-zero, struttura HTML e test di dominio.

## 1.46.0 - Pulizia prudente index HTML
- ripulito `index.html` dai residui testuali del vecchio accesso locale `admin / gestionale`.
- aggiunti marker strutturali per rendere più manutenibile il file senza introdurre template esterni o bundler.
- aggiunta la verifica Node.js `verify:html` su testi obsoleti, id duplicati e target della sidebar.
- aggiornato `npm run verify` includendo Firebase-only, struttura HTML e test di dominio.

## 1.45.0 - Test dominio consolidati
- aggiunta una suite di regressione Node.js trasversale per schema dati, vendite, acquisti, quarantena e backup.
- estesa la copertura dei casi legacy normalizzati e dei campi Firebase-only più critici.
- confermati i test di dominio esistenti senza introdurre nuove funzionalità.
- aggiornata la verifica Firebase-only/localStorage-zero alla versione corrente.

## 1.44.0 - Refactor backup e import Firebase-only
- estratta in `src/domain/backup.service.js` la logica per preview backup, normalizzazione import, export Firestore allineato, import e wipe Firebase.
- `src/features/impostazioni/index.js` resta responsabile di UI, binding eventi, conferme e toast.
- aggiunti test Node.js per backup/import/export Firebase-only.
- aggiornati script di verifica e versione del pacchetto.

## 1.43.0 - Refactor dominio acquisti
- estratta in `src/domain/purchasing.service.js` la logica di dominio per ordini fornitore, DDT in entrata, quarantena e resi fornitore.
- `src/features/acquisti/index.js` resta responsabile soprattutto di rendering, binding DOM, modali e orchestrazione UI.
- aggiunti test Node.js per ricezione fornitore, stato ordine, DDT con riserva/respingimento, rollback DDT e gestione quarantena.
- confermata la verifica Firebase-only/localStorage-zero dopo il refactoring.

## 1.42.0 - Refactor dominio vendite
- estratta in `src/domain/sales.service.js` la logica di dominio per ordini cliente, DDT cliente e fatture.
- `src/features/vendite/index.js` resta responsabile soprattutto di rendering, binding DOM e orchestrazione dei flussi UI.
- aggiunti test Node.js per stato ordine, apertura ordini, creazione DDT, rollback DDT, generazione fatture e rollback fatture.
- aggiunti gli script `test:domain` e `verify` per consolidare le verifiche del refactoring.

## 1.41.0 - Rimozione completa localStorage
- rimosso ogni uso di localStorage dal progetto: nessuna persistenza browser resta attiva.
- il tema UI usa solo prefers-color-scheme all’avvio e il toggle resta valido per la sessione corrente senza salvataggio locale.
- rimosso il device id persistente Firebase perché non è necessario distinguere browser o dispositivi dello stesso utente.
- aggiornata la verifica Node.js per fallire su qualunque riferimento a localStorage o sessionStorage nel pacchetto.

## 1.40.0 - Finalizzazione Firebase-only
- finalizzata la documentazione Firebase-only con guida utente, setup Firebase, manuale tecnico e note di verifica.
- aggiunto uno script Node.js di verifica del pacchetto per intercettare riferimenti operativi a modalità locale e fallback localStorage.
- consolidata la release finale del refactoring Firebase-only e allineati package, release.json e changelog alla versione 1.40.0.
- pulito il changelog rimuovendo una voce duplicata della 1.33.0 senza alterare la cronologia funzionale.

## 1.38.0 - Pulizia legacy Firebase-only
- rimossa la cartella `legacy/` con i vecchi moduli monolitici non più caricati dall’applicazione.
- aggiornati i riferimenti tecnici residui a modalità locale e DB locale nei commenti e nella guida di modularizzazione.
- pulita la documentazione Firebase setup dalle istruzioni obsolete per attivare o importare in modalità locale.
- aggiornata la parte iniziale del manuale utente rimuovendo credenziali locali e riferimenti a Local Storage.

## 1.37.0 - Backup e import Firebase-only
- backup, revisione dati e import leggono/scrivono esclusivamente tramite Firebase/Firestore.
- il dataset esempio viene caricato solo come preview per successivo import su Firebase, senza applicazioni locali.
- dopo l'import su Firebase la cache di sessione viene ricaricata da Firestore, senza reload e senza fallback locali.

## 1.36.0 - Repository dati Firebase-only
- separata esplicitamente la cache di sessione in memoria dalla persistenza Firestore nel wrapper dati.
- la sincronizzazione usa snapshot normalizzati e stato diff mantenuto solo in memoria, senza percorsi di persistenza locale.
- allineata la repository Firestore includendo anche la collezione supplierReturnDDTs nel caricamento e nella sincronizzazione.

## 1.35.0 - Fallback locali disabilitati
- disabilitati esplicitamente i percorsi legacy di caricamento locale e cambio modalità non Firebase.
- la gestione utenti è ora Firebase-only: rimossi i rami operativi per utenti locali e i campi locali dal modal.
- gli alias legacy di migrazione/pull verso locale restituiscono errori espliciti invece di attivare fallback silenziosi.

## 1.34.0 - Bootstrap Firebase-only
- bootstrap aggiornato: Firebase viene inizializzato all’avvio e Firestore viene caricato solo quando è disponibile una sessione autenticata
- caricamento dati applicativi reso Firebase-only: rimossi i fallback operativi e la lettura/scrittura del DB da localStorage nel wrapper dati
- login aggiornato per popolare la cache in memoria direttamente da Firestore dopo l’autenticazione

## 1.33.0 - Gestione quantità quarantena
- nuovo pulsante "Gestisci quantità quarantena" con ripartizione obbligatoria tra svincolo, reso e distruzione
- controllo automatico della somma delle quantità e conferma finale unica in Modalità A
- generazione del DDT di reso solo per la quota resa e storico quarantena distinto per ogni esito


## 1.32.1 - Impaginazione PDF reso fornitore
- nuova impaginazione del PDF del DDT di reso fornitore con intestazione Mittente/Destinatario
- tabella articoli resa con codice, descrizione, quantità e motivazione del reso
- piede documento con colli, vettore, stato reso e note di trasporto

## 1.32.0 - Flusso completo reso fornitore
- evoluzione del reso fornitore con stato Preparato / Spedito al fornitore
- dettaglio reso con causale, numero colli, vettore e note di trasporto modificabili
- elenco Resi Fornitore aggiornato con stato e PDF del reso arricchito con i nuovi dati documentali

## 1.31.0 - Elenco resi fornitore
- nuova voce Fornitori -> Elenco Resi Fornitore con storico dei DDT di reso generati dalla quarantena
- dettaglio dedicato del reso con riferimenti a ordine e DDT origine
- stampa PDF del DDT di reso fornitore

## 1.30.0 - Chiusura quarantena fornitori
- nuove azioni in Quarantena Fornitori: Svincola, Reso fornitore, Da distruggere
- generazione automatica del DDT di reso al fornitore per le quantità chiuse come reso
- scarico automatico della quantità dalla quarantena in caso di reso o distruzione
- storico delle chiusure quarantena nella schermata dedicata

## 1.29.0 - Allineamento inventario
- nuovo pulsante in Inventario per allineare le giacenze disponibili ai conteggi fisici inseriti
- conferma esplicita con frase di sicurezza prima del riallineamento
- riallineamento diretto delle quantità disponibili senza passare dai movimenti manuali

## 1.28.0 - Quarantena fornitori
- merce con riserva caricata in quarantena e non nella giacenza disponibile
- nuova schermata Quarantena Fornitori
- ordini fornitore lasciati aperti fino alla gestione della quarantena
- colonne Disponibile / In quarantena nelle giacenze e prodotti
