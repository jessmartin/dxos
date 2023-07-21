//
// Copyright 2022 DXOS.org
//

import React from 'react';

import { truncateKey } from '@dxos/debug';
import { useContacts } from '@dxos/react-client/halo';

import { Table } from '../util';

export const Contacts = () => {
  const contacts = useContacts();

  return (
    <Table
      rows={contacts}
      columns={[
        {
          key: 'public_key',
          color: 'blue',
          value: (key) => truncateKey(key),
        },
        {
          key: 'display_name',
        },
      ]}
    />
  );
};
