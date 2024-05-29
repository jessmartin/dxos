//
// Copyright 2024 DXOS.org
//

import { FunctionsPlugin } from '@dxos/agent';
import { type Client } from '@dxos/client';

import { type FunctionsPluginInitializer } from './setup';

/**
 * Deliberately in a non-exported file to keep @dxos/agent as a devDependency.
 */
export const initFunctionsPlugin: FunctionsPluginInitializer = async (client: Client) => {
  const plugin = new FunctionsPlugin();
  await plugin.initialize({ client, clientServices: client.services });
  await plugin.open();
  return {
    close: () => plugin.close(),
  };
};
