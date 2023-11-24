//
// Copyright 2023 DXOS.org
//

import '@dxosTheme';

import { faker } from '@faker-js/faker';
import React, { useEffect, useState } from 'react';

import { View as ViewType, types } from '@braneframe/types';
import { createSpaceObjectGenerator, TestSchemaType } from '@dxos/echo-generator';
import { useClient } from '@dxos/react-client';
import { type Space } from '@dxos/react-client/echo';
import { ClientSpaceDecorator, FullscreenDecorator } from '@dxos/react-client/testing';

import { Explorer } from './Explorer';

faker.seed(1);

const Story = () => {
  const client = useClient();
  const [space, setSpace] = useState<Space>();
  const [view, setView] = useState<ViewType>();
  useEffect(() => {
    const space = client.spaces.default;

    const generator = createSpaceObjectGenerator(space);
    generator.addSchemas();
    generator.createObjects({ [TestSchemaType.organization]: 20, [TestSchemaType.contact]: 50 });

    const view = space.db.add(new ViewType({}));

    setSpace(space);
    setView(view);
  }, []);

  if (!space || !view) {
    return null;
  }

  return <Explorer space={space} />;
};

export default {
  component: Explorer,
  render: Story,
  decorators: [
    FullscreenDecorator(),
    ClientSpaceDecorator({
      schema: types,
    }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export const Default = {};