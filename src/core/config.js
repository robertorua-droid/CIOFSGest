export const config = {
  DB_KEY: 'gestionale_ol_db',
  PERSISTENCE_KEY: 'gestionale_ol_persist_mode',

  // Email che devono avere accesso completo (ruolo Supervisor).
  // Inserisci qui l'email del docente (minuscole), es:
  // 'docente@scuola.it'
  SUPERVISOR_EMAILS: ['roberto.rua@gmail.com'],

  // Ruolo di default per chi si registra
  DEFAULT_ROLE: 'User'
};
