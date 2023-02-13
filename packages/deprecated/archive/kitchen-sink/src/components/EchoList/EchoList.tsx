//
// Copyright 2020 DXOS.org
//

import React from 'react';

import { List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material';

import { DocumentModel } from '@dxos/document-model';
import { Item } from '@dxos/echo-db';
import { ItemAdapter } from '@dxos/react-client-testing';
import { BoxContainer } from '@dxos/react-components-deprecated';

export interface EchoListProps {
  items?: Item<DocumentModel>[];
  itemAdapter: ItemAdapter;
}

export const EchoList = ({ items = [], itemAdapter }: EchoListProps) => (
  <BoxContainer expand column>
    <BoxContainer expand scrollY>
      <List
        dense
        disablePadding
        sx={{
          width: '100%'
        }}
      >
        {items.map((item) => {
          const { icon: Icon } = itemAdapter.meta?.(item.type!) ?? {};
          return (
            <ListItemButton key={item.id} dense>
              {Icon && (
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
              )}
              <ListItemText primary={itemAdapter.title(item)} secondary={itemAdapter.description(item)} />
            </ListItemButton>
          );
        })}
      </List>
    </BoxContainer>

    <Toolbar>
      <Typography>{items?.length} Items.</Typography>
    </Toolbar>
  </BoxContainer>
);