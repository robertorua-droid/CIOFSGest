# Gestionale Magazzino Didattico – Versione OL

Questa &egrave; la versione **OL** del Gestionale Magazzino Didattico pensata per l'uso in laboratorio
e come esercitazione per gli allievi (anche tramite QR code).

## Tecnologie utilizzate

- HTML5 + CSS3
- JavaScript (jQuery)
- Bootstrap 5
- Chart.js
- Local Storage del browser (nessun server richiesto)

## Funzionalit&agrave; principali

- Gestione anagrafiche:
  - Clienti, Fornitori, Prodotti
  - Utenti e Azienda
- Magazzino:
  - Carico e scarico manuale
  - Consultazione giacenze
  - Inventario completo
- Ciclo attivo:
  - Ordini cliente
  - DDT cliente
  - Fatturazione da DDT
- Ciclo passivo:
  - Ordini fornitore
  - DDT fornitore (merce in entrata)
- Statistiche:
  - Per ruolo **User**: focus sulle giacenze
  - Per **Supervisor/Admin**: focus sulle vendite
- Funzioni avanzate:
  - Esporta / Importa dati (.json)
  - Cancella tutti i dati
  - Invia i dati al docente tramite Formspree

## Primo accesso

Al primo avvio, se non esistono utenti nel Local Storage, il gestionale crea automaticamente un utente di setup:

- **Username**: `admin`
- **Password**: `gestionale`
- **Ruolo**: Admin

Con queste credenziali si attiva una **modalit&agrave; guidata di prima configurazione**:

- Nel men&ugrave; sono visibili solo:
  - Impostazioni &gt; Anagrafica azienda
  - Impostazioni &gt; Anagrafica utenti
  - Impostazioni &gt; Avanzate
- L'obiettivo &egrave; permettere allo studente di:
  - Inserire i dati dell'azienda (classe/gruppo)
  - Creare il proprio utente personale con ruolo appropriato

Appena esiste almeno un altro utente con ruolo **Admin**, le credenziali `admin/gestionale` vengono disabilitate
e non saranno pi&ugrave; utilizzabili per accedere.

## Invio dei dati al docente

Nella sezione **Impostazioni &gt; Avanzate** &egrave; presente il pulsante:

> **Invia dati per verifica**

Questo pulsante:

1. Raccoglie tutti i dati del gestionale (anagrafiche, documenti, note).
2. Prepara un payload JSON con:
   - Cognome e nome dell'utente loggato
   - Ruolo
   - Timestamp ISO
   - Contenuto del database locale
3. Invia il tutto all'indirizzo configurato su Formspree (`https://formspree.io/f/xwpagyqy`).

## Help integrato

Il pulsante **Help (F1)** apre in una **nuova scheda** il manuale utente, con contenuti che variano in base al ruolo:

- Ruolo **User**: guida semplificata
- Ruoli **Supervisor/Admin**: guida completa con flusso documentale

## Struttura dei file

- `index.html` – Struttura principale dell'applicazione
- `style.css` – Stili grafici
- `script.js` – Logica applicativa (gestione dati, flussi documentali, grafici, login, invio dati)
- `Manuale Utente.txt` – Manuale utente in formato testuale
- `admin_gestionale_backup_2025-11-14.json` – Esempio di file di backup dati

Carica tutti questi file in una cartella (ad esempio in un repository GitHub),
apri `index.html` con un browser moderno e il gestionale &egrave; pronto per l'uso.


### Novità
- Badge di stato con tooltip (ordini, DDT, fatture)
- Benvenuto in home con Nome Cognome sincronizzato
