# Changelog

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
