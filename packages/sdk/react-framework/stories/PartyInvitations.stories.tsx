//
// Copyright 2021 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { Box, Button, Toolbar } from '@mui/material';

import { encodeInvitation } from '@dxos/client';
import { PublicKey } from '@dxos/crypto';
import {
  ClientInitializer,
  ErrorBoundary,
  ProfileInitializer,
  useClient,
  useParties,
  useSecretGenerator
} from '@dxos/react-client';
import { CopyText, FullScreen, Passcode } from '@dxos/react-components';

import {
  ErrorView,
  JoinPartyDialog,
  PartySharingDialog
} from '../src';
import { Column } from './helpers';

export default {
  title: 'react-framework/PartyInvitations'
};

const Parties = () => {
  const parties = useParties();

  return (
    <Box>
      {parties.map(party => (
        <Box key={party.key.toHex()}>
          <CopyText value={party.key.toHex()} />
        </Box>
      ))}
    </Box>
  );
};

const Sender = () => {
  const [open, setOpen] = useState(true);
  const [partyKey, setPartyKey] = useState<PublicKey>();
  const client = useClient();

  const handleCreateParty = async () => {
    const party = await client.echo.createParty();
    setPartyKey(party.key);
  };

  useEffect(() => {
    void handleCreateParty();
  }, []);

  if (!partyKey) {
    return null;
  }

  return (
    <Box>
      <Toolbar>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Button onClick={handleCreateParty}>Create Party</Button>
      </Toolbar>
      <PartySharingDialog
        partyKey={partyKey}
        open={open}
        onClose={() => setOpen(false)}
        modal={false}
      />
      <Box sx={{ marginTop: 2, padding: 1 }}>
        <Parties />
      </Box>
    </Box>
  );
};

const Receiver = ({ invitationCode }: { invitationCode?: string }) => {
  const [open, setOpen] = useState(true);

  return (
    <Box>
      <Toolbar>
        <Button onClick={() => setOpen(true)}>Open</Button>
      </Toolbar>
      <JoinPartyDialog
        open={open}
        invitationCode={invitationCode}
        onClose={() => setOpen(false)}
        closeOnSuccess={true}
        modal={false}
      />
      <Box sx={{ marginTop: 2, padding: 1 }}>
        <Parties />
      </Box>
    </Box>
  );
};

// TODO(burdon): Error handling, retry, etc.

export const Primary = () => {
  return (
    <FullScreen>
      <ErrorBoundary errorComponent={ErrorView}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-around'
        }}>
          <ClientInitializer>
            <ProfileInitializer>
              <Column>
                <Sender />
              </Column>
            </ProfileInitializer>
          </ClientInitializer>

          <ClientInitializer>
            <ProfileInitializer>
              <Column>
                <Receiver />
              </Column>
            </ProfileInitializer>
          </ClientInitializer>
        </Box>
      </ErrorBoundary>
    </FullScreen>
  );
};

const AutoInvitationGenerator = ({
  onInvite
}: {
  onInvite: (invitationCode: string) => void
}) => {
  const client = useClient();
  const [secretProvider, pin, resetPin] = useSecretGenerator();

  useEffect(() => {
    setImmediate(async () => {
      const party = await client.echo.createParty();
      const invitation = await client.createInvitation(party.key, secretProvider, {
        onFinish: () => {
          resetPin();
        }
      });

      onInvite(encodeInvitation(invitation));
    });
  }, []);

  return (
    <Box>
      {pin && (
        <Passcode value={pin} />
      )}
    </Box>
  );
};

export const Secondary = () => {
  const [invitationCode, setInvitationCode] = useState<string>();

  return (
    <FullScreen>
      <ErrorBoundary errorComponent={ErrorView}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-around'
        }}>
          <ClientInitializer>
            <ProfileInitializer>
              <Column>
                <AutoInvitationGenerator
                  onInvite={invitationCode => setInvitationCode(invitationCode)}
                />
              </Column>
            </ProfileInitializer>
          </ClientInitializer>

          <ClientInitializer>
            <ProfileInitializer>
              <Column>
                {invitationCode && (
                  <Receiver
                    invitationCode={invitationCode}
                  />
                )}
              </Column>
            </ProfileInitializer>
          </ClientInitializer>
        </Box>
      </ErrorBoundary>
    </FullScreen>
  );
};
