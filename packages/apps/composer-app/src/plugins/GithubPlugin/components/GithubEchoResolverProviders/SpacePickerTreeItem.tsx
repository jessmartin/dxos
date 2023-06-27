//
// Copyright 2023 DXOS.org
//

import { CaretDown, CaretRight } from '@phosphor-icons/react';
import React, { useMemo, useState } from 'react';

import { Document } from '@braneframe/types';
import { Button, Tag, Tooltip, Tree, TreeItem, useTranslation } from '@dxos/aurora';
import { defaultDisabled } from '@dxos/aurora-theme';
import { Space, SpaceState } from '@dxos/client';
import { useMulticastObservable } from '@dxos/react-async';
import { observer, useQuery } from '@dxos/react-client';

import { getSpaceDisplayName } from '../../../SpacePlugin/getSpaceDisplayName';
import { DocumentTreeItem } from './DocumentTreeItem';
import { matchSpace } from './spaceResolvers';

export const SpacePickerTreeItem = observer(
  ({
    identityHex,
    space,
    source,
    id,
    setSpace,
    selected,
  }: {
    identityHex: string;
    space: Space;
    setSpace: (nextSpace: Space | null) => void;
    source: string;
    id: string;
    selected?: boolean;
  }) => {
    const { t } = useTranslation('composer');
    const spaceSate = useMulticastObservable(space.state);
    const disabled = spaceSate !== SpaceState.READY;
    const spaceDisplayName = getSpaceDisplayName(space);
    const documents = useQuery(space, Document.filter());
    const hasDocuments = documents.length > 0;

    const [open, setOpen] = useState(false);

    const nBoundMembers = useMemo(() => {
      return Object.keys(space.properties.members ?? {}).filter((identityHex) =>
        matchSpace(space, identityHex, source, id),
      ).length;
    }, [source, id, space.properties]);

    const OpenTriggerIcon = open ? CaretDown : CaretRight;

    return (
      <TreeItem.Root
        collapsible
        open={open}
        onOpenChange={setOpen}
        classNames={['mbe-2 block', disabled && defaultDisabled]}
        {...(disabled && { 'aria-disabled': true })}
      >
        <div role='none' className='flex items-center gap-2'>
          {hasDocuments ? (
            <TreeItem.OpenTrigger>
              <OpenTriggerIcon />
            </TreeItem.OpenTrigger>
          ) : (
            <TreeItem.OpenTrigger disabled classNames={defaultDisabled}>
              <CaretRight />
            </TreeItem.OpenTrigger>
          )}
          <TreeItem.Heading
            classNames='grow break-words pbs-1 text-base font-medium'
            data-testid='composer.spaceTreeItemHeading'
          >
            {Array.isArray(spaceDisplayName) ? t(...spaceDisplayName) : spaceDisplayName}
          </TreeItem.Heading>
          {nBoundMembers > 0 && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Tag palette='info' aria-label={t('bound members message', { count: nBoundMembers })}>
                  {nBoundMembers}
                </Tag>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side='bottom'>
                  <Tooltip.Arrow />
                  {t('bound members message', { count: nBoundMembers })}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          <Button disabled={selected} density='fine' classNames='shrink-0' onClick={() => setSpace(space)}>
            {t(selected ? 'selected label' : 'select label')}
          </Button>
        </div>
        <TreeItem.Body className='pis-4'>
          {hasDocuments && (
            <Tree.Branch>
              {documents.map((document) => (
                <DocumentTreeItem key={document.id} document={document} />
              ))}
            </Tree.Branch>
          )}
        </TreeItem.Body>
      </TreeItem.Root>
    );
  },
);