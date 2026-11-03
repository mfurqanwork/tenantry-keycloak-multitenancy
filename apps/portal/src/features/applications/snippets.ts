import type { AppView } from './api.js';

export interface Snippet {
  label: string;
  language: 'javascript' | 'bash';
  code: string;
}

// Copy-paste setup per app type, filled with this app's values (ADR-0011). The secret is never filled in:
// it was shown once, and the person pastes it themselves. examples/customer-app is the Node one, running.
export function snippetsFor(app: AppView, secretPlaceholder = '<your client secret>'): Snippet[] {
  const { issuer, clientId, scopes } = app.connection;
  const redirect = app.redirectUris[0] ?? '<your redirect URI>';
  switch (app.type) {
    case 'web':
      return [
        {
          label: 'Node (openid-client)',
          language: 'javascript',
          code: `import * as client from 'openid-client';

const config = await client.discovery(
  new URL('${issuer}'),
  '${clientId}',
  process.env.CLIENT_SECRET, // ${secretPlaceholder}
);

// Sign in: send the person to Keycloak, with PKCE.
const verifier = client.randomPKCECodeVerifier();
const url = client.buildAuthorizationUrl(config, {
  redirect_uri: '${redirect}',
  scope: '${scopes}',
  code_challenge: await client.calculatePKCECodeChallenge(verifier),
  code_challenge_method: 'S256',
});

// Back on ${redirect}: trade the code for tokens.
const tokens = await client.authorizationCodeGrant(config, currentUrl, {
  pkceCodeVerifier: verifier,
});`,
        },
      ];
    case 'spa':
      return [
        {
          label: 'Browser (oidc-client-ts)',
          language: 'javascript',
          code: `import { UserManager } from 'oidc-client-ts';

const manager = new UserManager({
  authority: '${issuer}',
  client_id: '${clientId}',
  redirect_uri: '${redirect}',
  response_type: 'code', // with PKCE, no secret
  scope: '${scopes}',
});

await manager.signinRedirect(); // sign in
const user = await manager.signinRedirectCallback(); // on ${redirect}`,
        },
      ];
    case 'm2m':
      return [
        {
          label: 'Node (openid-client)',
          language: 'javascript',
          code: `import * as client from 'openid-client';

const config = await client.discovery(
  new URL('${issuer}'),
  '${clientId}',
  process.env.CLIENT_SECRET, // ${secretPlaceholder}
);
const { access_token } = await client.clientCredentialsGrant(config);`,
        },
        {
          label: 'curl',
          language: 'bash',
          code: `curl -s ${app.connection.tokenEndpoint} \\
  -d grant_type=client_credentials \\
  -d client_id=${clientId} \\
  -d client_secret="$CLIENT_SECRET"   # ${secretPlaceholder}
# issuer: ${issuer}`,
        },
      ];
    case 'native':
      return [];
  }
}
