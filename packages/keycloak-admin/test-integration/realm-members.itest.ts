import { randomBytes } from 'node:crypto';
import { createRealmMembers } from '../src/realms/realm-members.js';
import { runRealmMemberContract } from '../src/testing/member-contract.js';
import { mailsTo } from './mailpit.js';
import { baseUrl, bootstrap, provisionTestRealm, testProvisioner } from './stack.js';

runRealmMemberContract('Keycloak realm', async () => {
  const { realm, secret } = await provisionTestRealm('mc', 'Contract Co');
  await testProvisioner().ensureGroups(realm);
  const groupId = async (name: string) =>
    (
      (await (await bootstrap('GET', `/${realm}/groups?search=${name}&exact=true`)).json()) as {
        id: string;
        name: string;
      }[]
    ).find((g) => g.name === name)?.id ?? '';
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
    async joinGroup(kcUserId, group) {
      await bootstrap('PUT', `/${realm}/users/${kcUserId}/groups/${await groupId(group)}`);
    },
    async leaveGroup(kcUserId, group) {
      await bootstrap('DELETE', `/${realm}/users/${kcUserId}/groups/${await groupId(group)}`);
    },
    async isEmailVerified(kcUserId) {
      const user = (await (await bootstrap('GET', `/${realm}/users/${kcUserId}`)).json()) as {
        emailVerified: boolean;
      };
      return user.emailVerified;
    },
    async cleanup() {
      await bootstrap('DELETE', `/${realm}`);
    },
  };
});
