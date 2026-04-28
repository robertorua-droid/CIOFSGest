function cloneDb(db) {
  return JSON.parse(JSON.stringify(db));
}

function isPromiseLike(value) {
  return value && typeof value === 'object' && typeof value.then === 'function';
}

function asyncMutationError(label) {
  return new Error(`Mutazione DB asincrona non supportata: "${label}". Usa operazioni sincrone sul draft.`);
}

/**
 * Crea un runner transazionale per le mutazioni del DB in memoria.
 *
 * Le feature ricevono una copia normalizzata dello stato corrente; solo se
 * l'updater termina senza errori la copia viene salvata e sincronizzata.
 * In caso di eccezione lo stato condiviso resta invariato.
 */
export function createMutationRunner({ ensure, save, emit }) {
  if (typeof ensure !== 'function') throw new Error('Mutation runner: ensure mancante.');
  if (typeof save !== 'function') throw new Error('Mutation runner: save mancante.');

  let activeLabel = null;

  return function mutate(label, updater) {
    if (typeof updater !== 'function') throw new Error('Mutazione DB non valida.');
    const mutationLabel = String(label || 'db:mutation');

    if (activeLabel) {
      throw new Error(`Mutazione DB annidata non consentita: "${mutationLabel}" durante "${activeLabel}".`);
    }

    const before = ensure();
    const draft = cloneDb(before);
    activeLabel = mutationLabel;

    try {
      if (updater.constructor?.name === 'AsyncFunction') {
        throw asyncMutationError(mutationLabel);
      }
      const result = updater(draft);
      if (isPromiseLike(result)) {
        throw asyncMutationError(mutationLabel);
      }
      save(draft);
      emit?.('db:mutation', { label: mutationLabel, result });
      return result;
    } catch (error) {
      emit?.('db:mutation:error', {
        label: mutationLabel,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      activeLabel = null;
    }
  };
}
