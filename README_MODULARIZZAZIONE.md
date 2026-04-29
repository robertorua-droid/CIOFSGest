# Gestionale OL - Versione Modularizzata

Questa versione è stata riorganizzata per rendere il progetto **più leggibile, separato per aree funzionali** e con un **core condiviso** (DB + eventi + utilities).

## Struttura

- `src/core/`
  - `app.js` → crea e pubblica `App` (anche su `window.App` per debug)
  - `db.js` → DB con **cache singleton** + evento `db:changed`
  - `events.js` → event bus
  - `utils.js`, `ui.js`, `home.js`, `stats.js`

- `src/domain/`
  - `inventory.service.js` → variazioni di giacenza centralizzate (`adjustStockBatch`)
  - `masterdata.service.js` → CRUD anagrafiche centralizzato (clienti/fornitori/prodotti)

- `src/features/`
  - `login/` → login + router sidebar
  - `anagrafiche/` → clienti / fornitori / prodotti (UI)
  - `magazzino/` → carico/scarico manuale, giacenze, inventario
  - `vendite/` → ordini cliente, DDT, fatture
  - `acquisti/` → ordini fornitore, DDT in entrata
  - `impostazioni/` → azienda, utenti, avanzate (export/import/reset)

- `legacy/`
  - contiene i file originali monolitici, lasciati a scopo didattico/confronto (non vengono più caricati da `index.html`).

## Nota esecuzione (ES Modules)
`index.html` carica `src/main.js` come **ES Module**.  
Apri il progetto con un piccolo server (es. *Live Server* di VS Code), non con doppio click su `file://`.

## Eventi principali
- `logged-in` → emesso dopo login, usato dalle feature per inizializzarsi
- `db:changed` → emesso ad ogni `App.db.save(db)`
- `products:changed`, `customers:changed`, `suppliers:changed` → emessi dai service di anagrafiche
- `inventory:changed` → emesso dal service magazzino

## Miglioria chiave
Il DB è ora **un singleton in memoria**: evita incongruenze tra moduli e rende la base molto più “modulare”.
