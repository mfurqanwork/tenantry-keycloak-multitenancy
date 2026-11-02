// Injection tokens for the two outside systems. Features depend on these, never on pg or HTTP.
export const DB_POOL = Symbol('DB_POOL');
export const DB = Symbol('DB');
export const IDENTITY_DIRECTORY = Symbol('IDENTITY_DIRECTORY');
