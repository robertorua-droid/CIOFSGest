import { createFirestoreRepository } from './firestore/repository.js';

export function firestoreRepo(fs, rootPath) {
  return createFirestoreRepository(fs, rootPath);
}
