//
// Copyright 2020 DXOS.org
//

import debug from 'debug';
import React, { MutableRefObject, ReactNode, useEffect, useState } from 'react';

import { Client, ClientOptions } from '@dxos/client';
import { ConfigProvider } from '@dxos/config';
import { MaybeFunction, MaybePromise, getAsyncValue } from '@dxos/util';

import { printBanner } from '../banner';
import { ClientContext } from '../hooks';

const log = debug('dxos:react-client');

export type ClientProvider = MaybeFunction<MaybePromise<Client>>

export interface ClientProviderProps {
  children?: ReactNode

  /**
   * Forward reference to provide client object to outercontainer since it won't have access to the context.
   */
  clientRef?: MutableRefObject<Client | undefined>

  /**
   * Client object or async provider to enable to caller to do custom initialization.
   */
  client?: ClientProvider

  /**
   * Config object or async provider.
   */
  config?: ConfigProvider

  /**
   * Runtime objects.
   */
  options?: ClientOptions

  /**
   * Post initialization hook.
   * @param Client
   */
  onInitialize?: (client: Client) => Promise<void>
}

/**
 * Root component that provides the DXOS client instance to child components.
 * To be used with the `useClient` hook.
 */
export const ClientProvider = ({
  children,
  clientRef,
  client: clientProvider,
  config: configProvider,
  options,
  onInitialize
}: ClientProviderProps) => {
  const [client, setClient] = useState<Client | undefined>(clientProvider instanceof Client ? clientProvider : undefined);

  // Async helpers.
  useEffect(() => {
    if (!client) {
      const done = async (client: Client) => {
        log(`Created client: ${client}`);
        if (clientRef) {
          clientRef.current = client;
        }
        await onInitialize?.(client);
        setClient(client);
        printBanner(client);
      };

      setImmediate(async () => {
        if (clientProvider) {
          // Asynchornously request client.
          const client = await getAsyncValue(clientProvider);
          await done(client);
        } else {
          // Asynchronously construct client (config may be undefined).
          const config = await getAsyncValue(configProvider);
          const client = new Client(config, options);
          await client.initialize();
          await done(client);
        }
      });
    }
  }, []);

  // Console debug access.
  // TODO(burdon): Debug only.
  useEffect(() => {
    if (client) {
      (window as any).__DXOS__ = client.getDevtoolsContext();
    }
  }, [client]);

  if (!client) {
    return null;
  }

  return (
    <ClientContext.Provider value={{ client }}>
      {children}
    </ClientContext.Provider>
  );
};
