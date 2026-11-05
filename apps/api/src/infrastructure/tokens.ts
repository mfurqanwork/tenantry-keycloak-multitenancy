// Injection tokens for the two outside systems. Features depend on these, never on pg or HTTP.
export const DB_POOL = Symbol('DB_POOL');
export const DB = Symbol('DB');
export const IDENTITY_DIRECTORY = Symbol('IDENTITY_DIRECTORY');
// One member directory per tenant, whatever its tier (Standard: organizations; Enterprise: its realm).
export const MEMBER_DIRECTORIES = Symbol('MEMBER_DIRECTORIES');
export const SECRET_STORE = Symbol('SECRET_STORE');
export const REALM_PROVISIONER = Symbol('REALM_PROVISIONER');
// Customer apps of one enterprise tenant, in its realm (ADR-0011).
export const REALM_APPS = Symbol('REALM_APPS');
// The native SCIM of one enterprise realm, behind the gateway (ADR-0024).
export const REALM_SCIM = Symbol('REALM_SCIM');
// Console access to one enterprise realm (ADR-0026).
export const REALM_CONSOLE = Symbol('REALM_CONSOLE');
// A move to Enterprise (ADR-0025): the new realm's members, its bridge, and its copied company logins.
export const REALM_MEMBERS = Symbol('REALM_MEMBERS');
export const REALM_BRIDGE = Symbol('REALM_BRIDGE');
export const REALM_IDPS = Symbol('REALM_IDPS');
