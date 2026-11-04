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
