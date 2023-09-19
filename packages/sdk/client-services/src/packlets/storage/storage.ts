//

//
// Copyright 2023 DXOS.org
//

import { DX_DATA } from '@dxos/client-protocol';
import { InvalidConfigError } from '@dxos/protocols';
import { Runtime } from '@dxos/protocols/proto/dxos/config';
import { createStorage, StorageType } from '@dxos/random-access-storage';
import { isNode } from '@dxos/util';

import StorageDriver = Runtime.Client.Storage.StorageDriver;

// TODO(burdon): Factor out.
export const createStorageObjects = (config: Runtime.Client.Storage) => {
  const {
    persistent = false,
    keyStore,
    dataStore,
    dataRoot = isNode() ? DX_DATA : 'dxos/storage', // TODO(burdon): Factor out const.
  } = config ?? {};

  if (persistent && dataStore === StorageDriver.RAM) {
    throw new InvalidConfigError('RAM storage cannot be used in persistent mode.');
  }
  if (!persistent && dataStore !== undefined && dataStore !== StorageDriver.RAM) {
    throw new InvalidConfigError('Cannot use a persistent storage in not persistent mode.');
  }
  if (persistent && keyStore === StorageDriver.RAM) {
    throw new InvalidConfigError('RAM key storage cannot be used in persistent mode.');
  }
  if (!persistent && keyStore !== StorageDriver.RAM && keyStore !== undefined) {
    throw new InvalidConfigError('Cannot use a persistent key storage in not persistent mode.');
  }

  return {
    storage: createStorage({
      type: persistent ? toStorageType(dataStore) : StorageType.RAM,
      root: `${dataRoot}/`,
    }),
  };
};

const toStorageType = (type: StorageDriver | undefined): StorageType | undefined => {
  switch (type) {
    case undefined:
      return undefined;
    case StorageDriver.RAM:
      return StorageType.RAM;
    case StorageDriver.CHROME:
      return StorageType.CHROME;
    case StorageDriver.FIREFOX:
      return StorageType.FIREFOX;
    case StorageDriver.IDB:
      return StorageType.IDB;
    case StorageDriver.NODE:
      return StorageType.NODE;
    case StorageDriver.WEBFS:
      return StorageType.WEBFS;
    default:
      throw new Error(`Invalid storage type: ${StorageDriver[type]}`);
  }
};
