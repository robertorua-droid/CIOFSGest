# Manuale Utente

## Accesso

L'applicazione consente:

- accesso con account Firebase
- registrazione di nuovi utenti
- accesso di emergenza `admin/gestionale` solo per casi particolari

Per l'uso in classe è consigliato accedere con utente personale e usare **Firebase**.

## Importazione dati iniziali

Per caricare il dataset del corso:

1. aprire `Impostazioni`
2. entrare in `Avanzate`
3. aprire `Backup & Ripristino`
4. cliccare `Carica esempio incluso`
5. applicare i dati su Firebase

Verificare sempre il badge con la **sorgente dati attiva**.

## Anagrafiche

Sono disponibili:

- anagrafica azienda
- anagrafica clienti
- anagrafica fornitori
- anagrafica prodotti
- anagrafica utenti

## Magazzino

### Carico manuale
Permette di aumentare la giacenza di un prodotto indicando quantità e causale.

### Scarico manuale
Permette di diminuire la giacenza indicando quantità e causale.

### Giacenze
Consente la consultazione rapida della disponibilità.

### Inventario
Permette il confronto tra quantità a sistema e quantità fisica.

## Ordini Cliente

### Nuovo Ordine Cliente
Consente di creare ordini mono-riga o multi-riga.

La numerazione viene proposta automaticamente in modo coerente con gli ordini già presenti.

### Elenco Ordini Cliente
Mostra gli ordini con stato:

- In lavorazione
- Parzialmente Evaso
- Evaso

I ruoli autorizzati possono eliminare un ordine solo se non ha DDT collegati.

## DDT Cliente

### Nuovo DDT Cliente
Permette di evadere totalmente o parzialmente un ordine cliente.

È disponibile un campo **Note** per annotazioni operative o didattiche.

### Elenco DDT Cliente
Mostra i DDT emessi.

I ruoli autorizzati possono eliminare un DDT solo se:

- non è collegato a una fattura
- l'eliminazione è consentita dal ruolo

Se il DDT viene eliminato, il sistema ripristina:

- giacenze
- quantità spedite
- stato ordine collegato

## Fatturazione Cliente

La sezione consente di:

- selezionare DDT cliente da fatturare
- generare anteprima fattura
- confermare fattura definitiva
- esportare il PDF

Se una fattura viene eliminata, i DDT collegati tornano a stato **Da Fatturare**.

## Ordini Fornitore

### Nuovo Ordine Fornitore
Consente di creare ordini acquisto con numerazione progressiva coerente con i dati già presenti.

### Elenco Ordini Fornitore
Stati principali:

- Inviato
- Parzialmente Ricevuto
- Completato
- Aperto - Rifiutato

## DDT Fornitore

### Nuovo DDT Fornitore
Consente di registrare il ricevimento della merce.

Opzioni speciali:

- **Ricezione merce con riserva**
- **Merce rifiutata**
- **Annotazioni**

Quando si seleziona riserva o rifiuto, le annotazioni sono obbligatorie.

Se si registra **Merce rifiutata**:

- la giacenza non aumenta
- l'ordine non viene chiuso come completato
- il documento resta gestibile con un successivo DDT

## PDF

È disponibile l'esportazione PDF per:

- DDT Cliente
- Fatture Cliente

## Statistiche

### Utente User
Vede statistiche sulla movimentazione di magazzino:

- prodotti più movimentati in entrata
- prodotti più movimentati in uscita

### Ruoli elevati
Vedono le statistiche amministrative/commerciali già presenti, come:

- ordini per mese
- valore ordini per cliente

## Backup e Ripristino

In `Impostazioni -> Avanzate -> Backup & Ripristino` sono disponibili:

- Esporta da Firebase
- Esporta backup JSON
- Seleziona file backup
- Applica alla cache locale
- Applica su Firebase
- Carica esempio incluso

Per l'uso didattico è consigliato **Esporta da Firebase**.

## Utenti e fine corso

Il docente principale può:

- eliminare dati di un singolo utente
- eliminare il profilo applicativo di un utente
- eseguire **Reset classe**

Il reset classe:

- cancella i dati Firestore degli utenti `User`
- elimina i loro profili applicativi
- non cancella gli account da Firebase Authentication

Gli account vanno eliminati manualmente dal pannello Firebase.
