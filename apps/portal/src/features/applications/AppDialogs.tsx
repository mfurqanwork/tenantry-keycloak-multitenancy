import { TextInput } from '@carbon/react';
import { APP_LIMITS, normaliseUris } from '@tenantry/auth';
import { FormDialog, useApi } from '@tenantry/app-kit';
import { useState } from 'react';
import type { AppView } from './api.js';
import { LISTS, listsFor, listsReady, uriProblems, type UriLists } from './uri-lists.js';
import { UriListField } from './UriListField.js';

// Name and URIs; the type stays (delete and register again to change it). Sends the whole form.
export function EditAppDialog({
  app,
  onDone,
  onClose,
}: {
  app: AppView;
  onDone: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [name, setName] = useState(app.name);
  const [lists, setLists] = useState<UriLists>({
    redirectUris: app.redirectUris,
    postLogoutRedirectUris: app.postLogoutRedirectUris,
    webOrigins: app.webOrigins,
  });
  const valid = name.trim() !== '' && name.trim().length <= APP_LIMITS.nameMax && listsReady(app.type, lists);
  return (
    <FormDialog
      heading="Edit app"
      submitLabel="Save"
      canSubmit={valid}
      onSubmit={async () => {
        await api.patch(`/api/apps/${app.id}`, {
          name: name.trim(),
          redirectUris: normaliseUris(lists.redirectUris),
          postLogoutRedirectUris: normaliseUris(lists.postLogoutRedirectUris),
          webOrigins: normaliseUris(lists.webOrigins),
        });
        onDone();
      }}
      onClose={onClose}
    >
      <TextInput
        id="edit-app-name"
        labelText="Name"
        value={name}
        maxLength={APP_LIMITS.nameMax}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      {listsFor(app.type).map((field) => (
        <UriListField
          key={field}
          id={`edit-app-${field}`}
          label={LISTS[field].label}
          helperText={LISTS[field].helper}
          values={lists[field]}
          problems={uriProblems(lists[field], field, app.type)}
          onChange={(values) => {
            setLists({ ...lists, [field]: values });
          }}
        />
      ))}
    </FormDialog>
  );
}

export function RotateSecretDialog({
  app,
  onRotated,
  onClose,
}: {
  app: AppView;
  onRotated: (secret: string) => void;
  onClose: () => void;
}) {
  const api = useApi();
  return (
    <FormDialog
      heading="Rotate secret"
      submitLabel="Rotate secret"
      danger
      canSubmit
      onSubmit={async () => {
        const { clientSecret } = await api.post<{ clientSecret: string }>(`/api/apps/${app.id}/secret`, {});
        onRotated(clientSecret);
      }}
      onClose={onClose}
    >
      <p>
        {app.name} gets a new client secret, shown once. The current secret stops working at once, so update
        the app straight after.
      </p>
    </FormDialog>
  );
}

export function DeleteAppDialog({
  app,
  onDeleted,
  onClose,
}: {
  app: AppView;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [typed, setTyped] = useState('');
  return (
    <FormDialog
      heading="Delete app"
      submitLabel="Delete app"
      danger
      canSubmit={typed === app.name}
      onSubmit={async () => {
        await api.del(`/api/apps/${app.id}`);
        onDeleted();
      }}
      onClose={onClose}
    >
      <p>
        {app.name} stops working at once: nobody can sign in to it, and its client is removed from your realm.
      </p>
      <TextInput
        id="delete-app-confirm"
        labelText={`Type ${app.name} to confirm`}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
      />
    </FormDialog>
  );
}
