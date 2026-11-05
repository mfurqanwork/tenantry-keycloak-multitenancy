# Move a workspace to Enterprise

For operators. A Standard workspace lives in the shared realm; moving it gives it a realm of its own (ADR-0025). Its people keep their Tenantry accounts, roles, projects and audit log. They sign in the first time with **Continue with your Tenantry account** and their old password.

## 1. See what will move

```bash
pnpm ops enterprise migrate --tenant globex --dry-run
```

It lists each person and their role, the open invites (sent again from the new realm), and each company login, with whether its secret was kept when it was linked. Nothing changes.

## 2. Move it

```bash
pnpm ops enterprise migrate --tenant globex
```

- While it runs, changes to people, roles, invites and branding answer "This workspace is moving to Enterprise. Try again in a few minutes." Everything else keeps working.
- If it stops, run the same command again: it carries on where it stopped.
- At the end, the workspace signs in through `ent-globex`. Tokens from the shared realm stop working for it, and both apps send people to the new sign-in page.

To give up before the end, run `--abort`: the half-built realm goes, and the workspace is Standard again, as it was. After the move has finished there is no way back.

## 3. Company logins

A company login linked with `pnpm ops idp link` since Phase 5b moves with its secret and keeps working. One linked earlier is copied switched off, and the move names it. Give it its secret, the same way `idp link` takes one:

```bash
IDP_CLIENT_SECRET=... pnpm ops enterprise idp-secret --tenant globex --alias globex-corp
```

The company must also allow the new realm's sign-in address at their identity provider: `https://<auth>/realms/ent-globex/broker/<alias>/endpoint`.

## 4. Finish

When people have signed in once:

```bash
pnpm ops enterprise migrate --tenant globex --finish
```

The bridge button goes, and the workspace's organization is removed from the shared realm. People keep their shared-realm accounts for any other workspaces they are in. Someone who never used the bridge sets a password with **Forgot password**.

## Console access

In an enterprise workspace, an owner can let an owner or admin into the realm's Keycloak console: on the **Members** page, open the person's menu and choose **Give console access**. They then find **Open the Keycloak console** on the portal's dashboard. They can manage people and groups. They cannot change owners, give anyone console access, or open clients, flows or realm settings (ADR-0026). Making them a member, or removing them, takes it away.
