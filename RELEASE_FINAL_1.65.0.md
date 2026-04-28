# Release finale 1.65.0 - Chiusura refactoring strutturale

Data: 2026-04-25

Questa release chiude il ciclo di refactoring strutturale avviato per rendere il gestionale Firebase-only, eliminare le dipendenze da localStorage e ridurre la fragilità prima di nuove evoluzioni funzionali.

## Baseline consolidata

- Persistenza applicativa esclusivamente su Firebase/Firestore.
- Nessun uso di localStorage o sessionStorage nel codice applicativo.
- Bootstrap e caricamento dati Firebase-only.
- Service di dominio separati per vendite, acquisti, backup, statistiche, inventario e anagrafiche.
- Mutazioni DB controllate con draft isolato e rollback su errore.
- Guardia conflitti Firestore basata su meta.revision.
- UI principali spezzate in moduli dedicati.
- Escaping HTML centralizzato sui rendering dinamici.
- Layer stampa/PDF separato.
- Smoke test DOM/browser leggero senza dipendenze esterne.

## Comandi di verifica consigliati

```bash
npm run verify
```

In ambienti dove il runner aggregato resta agganciato dopo output TAP positivo, eseguire i controlli singolarmente:

```bash
npm run verify:firebase-only
npm run verify:html
npm run verify:structure
npm run verify:html-escaping
npm run verify:printing
npm run verify:browser-smoke
npm run verify:release
bash tools/run-domain-tests.sh
```

## Nota operativa

Da questa baseline conviene aggiungere nuove funzioni solo con la stessa disciplina: service di dominio testabile, mutazione DB controllata, verifica strutturale e changelog aggiornato.


## Evoluzione successiva 1.66.0
Dopo la closure 1.65.0 è stata aggiunta la consultazione dei DDT di reso al fornitore nella pagina Elenco DDT Fornitore, tramite tab Ricevuti dal Fornitore / Resi al Fornitore.
