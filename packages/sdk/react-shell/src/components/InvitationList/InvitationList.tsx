//
// Copyright 2023 DXOS.org
//
import React from 'react';

import { List } from '@dxos/aurora';
import type { CancellableInvitationObservable } from '@dxos/react-client/invitations';

import { InvitationListItem, InvitationListItemProps } from './InvitationListItem';
import { SharedInvitationListProps } from './InvitationListProps';

export interface InvitationListProps
  extends Omit<InvitationListItemProps, 'invitation' | 'value'>,
    Pick<SharedInvitationListProps, 'send'> {
  invitations: CancellableInvitationObservable[];
  InvitationListItem?: React.ComponentType<InvitationListItemProps>;
}

export const InvitationList = ({ invitations, send, ...invitationProps }: InvitationListProps) => {
  const { InvitationListItem: Item = InvitationListItem } = invitationProps;
  return (
    <List classNames='flex flex-col gap-2'>
      {invitations.map((invitation) => {
        const value = invitation.get().invitationId;
        return <Item key={value} send={send} invitation={invitation} {...invitationProps} />;
      })}
    </List>
  );
};
