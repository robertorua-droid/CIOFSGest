# Gestionale Magazzino Didattico OL

Gestionale web didattico per simulare processi di magazzino, acquisto e vendita in un contesto WMS semplificato ma realistico.

## Funzioni principali

- anagrafiche clienti, fornitori, prodotti, azienda e utenti
- magazzino: carico manuale, scarico manuale, giacenze, inventario
- vendite: ordini cliente, DDT cliente, fatturazione
- acquisti: ordini fornitore, DDT fornitore
- statistiche differenziate per ruolo
- backup/ripristino locale e Firebase
- dataset didattico di esempio incluso
- esportazione PDF per DDT cliente e fatture cliente
- reset classe e pulizia dati Firestore a fine corso

## Modalità dati

Il progetto può lavorare in due modalità:

- **Firebase**: modalità consigliata per attività in classe
- **Locale**: utile per test, debug o uso offline

Nel corso si consiglia di usare Firebase come sorgente dati attiva.

## Ruoli

- **User**: uso operativo standard
- **Supervisor**: funzioni avanzate e gestione documenti riservati
- **Docente principale** (`roberto.rua@gmail.com`): manutenzione utenti e reset classe

## Novità introdotte nelle ultime revisioni

- correzione numerazione ordini cliente e fornitore per evitare duplicati
- persistenza Firebase resa più robusta con identificativi stabili sui documenti
- fix esportazione da Firebase con sincronizzazione preventiva
- eliminazione ordini e DDT con rollback coerente degli stati
- blocco eliminazione DDT cliente se collegato a fattura
- note su DDT cliente
- DDT fornitore con:
  - ricezione con riserva
  - merce rifiutata
  - note obbligatorie nei casi anomali
- statistiche dedicate agli utenti **User** sulla movimentazione di magazzino
- ripristino generazione PDF DDT cliente e fatture cliente
- funzione **Reset classe** riservata al docente principale

## Dataset di esempio

Il menu:

`Impostazioni -> Avanzate -> Backup & Ripristino -> Carica esempio incluso`

carica il dataset ufficiale del corso.

## Reset classe

La funzione **Reset classe**:

- è disponibile solo al docente principale
- cancella i dati Firestore e i profili applicativi degli utenti con ruolo `User`
- non elimina gli account da Firebase Authentication

Dopo il reset, gli account degli allievi vanno rimossi manualmente dal pannello Firebase Authentication.

## Deploy

Il progetto è pensato per pubblicazione statica su GitHub Pages.

Per evitare comportamenti incoerenti dopo un aggiornamento:

1. pubblicare la nuova versione
2. fare refresh forzato del browser
3. fare logout/login
4. verificare la sorgente dati attiva
5. testare 2-3 funzioni chiave

## Struttura documentazione

- `README.md` -> panoramica progetto
- `docs/MANUALE_UTENTE.md` -> uso operativo
- `docs/MANUALE_TECNICO.md` -> architettura e manutenzione
- `docs/HELP.md` -> guida rapida

## Note

Questo progetto è destinato a formazione, laboratori ed esercitazioni guidate.
