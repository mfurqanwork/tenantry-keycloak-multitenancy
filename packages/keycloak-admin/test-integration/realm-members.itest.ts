import { randomBytes } from 'node:crypto';
import { createRealmMembers } from '../src/realms/realm-members.js';
import { runRealmMemberContract } from '../src/testing/member-contract.js';
import { mailsTo } from './mailpit.js';
import { baseUrl, bootstrap, provisionTestRealm } from './stack.js';

runRealmMemberContract('Keycloak realm', async () => {
  const { realm, secret } = await provisionTestRealm('mc', 'Contract Co');
  return {
    members: createRealmMembers({ baseUrl, realm, clientSecret: secret }),
    async completeSignUp(kcUserId) {
      await bootstrap('PUT', `/${realm}/users/${kcUserId}/reset-password`, {
        type: 'password',
        value: `Pw-${randomBytes(12).toString('base64url')}`,
        temporary: false,
      });
    },
    emailsTo: mailsTo,
    async cleanup() {
      await bootstrap('DELETE', `/${realm}`);
    },
  };
});
