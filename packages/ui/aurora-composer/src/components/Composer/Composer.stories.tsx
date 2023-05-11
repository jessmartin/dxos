//
// Copyright 2023 DXOS.org
//

import '@dxosTheme';
import React, { useState } from 'react';

import { useId } from '@dxos/aurora';
import { PublicKey, Text } from '@dxos/client';
import { TextKind } from '@dxos/protocols/proto/dxos/echo/model/text';
import { observer, useIdentity, useQuery, useSpace } from '@dxos/react-client';
import { ClientSpaceDecorator, textGenerator, useDataGenerator } from '@dxos/react-client/testing';

import { ComposerDocument, schema } from '../../testing';
import { Composer, ComposerProps } from './Composer';

export default {
  component: Composer
};

const render = observer(({ spaceKey, ...args }: Pick<ComposerProps, 'slots'> & { spaceKey: PublicKey }) => {
  const [generate, setGenerate] = useState(false);
  const generateId = useId('generate');

  const identity = useIdentity();
  const space = useSpace(spaceKey);
  const [document] = useQuery(space, ComposerDocument.filter());

  useDataGenerator({
    generator: generate ? textGenerator : undefined,
    options: { text: document?.content.content }
  });

  return (
    <main className='flex-1 min-w-0 p-4'>
      <div id={generateId} className='flex'>
        <input type='checkbox' onChange={(event) => setGenerate(event.target.checked)} />
        Generate Data
      </div>
      {document?.content.toString().length}
      <Composer identity={identity} space={space} text={document?.content} {...args} />
    </main>
  );
});

export const Markdown = {
  render,
  decorators: [
    ClientSpaceDecorator({
      schema,
      count: 2,
      onCreateSpace: async (space) => {
        const document = new ComposerDocument({ content: new Text('Hello, Storybook!') });
        await space?.db.add(document);
      }
    })
  ]
};

export const Rich = {
  render,
  args: {
    slots: {
      editor: {
        className: 'z-0 rounded bg-white text-neutral-900 w-full p-4 dark:bg-neutral-850 dark:text-white min-bs-[12em]'
      }
    }
  },
  decorators: [
    ClientSpaceDecorator({
      schema,
      count: 2,
      onCreateSpace: async (space) => {
        const document = new ComposerDocument({ content: new Text('Hello, Storybook!', TextKind.RICH) });
        await space?.db.add(document);
      }
    })
  ]
};