//
// Copyright 2021 DXOS.org
//

import faker from 'faker';

import { decodeProtobuf } from '../encoding';
import { schemaJson } from '../proto';
import { RegistryClient } from '../registry-client';
import { AccountKey, CID, DXN, RecordMetadata, RegistryType, TypeRecordMetadata } from '../types';

/**
 * Generates a random CID.
 */
export const createCID = (): CID => {
  return CID.from(Uint8Array.from(Array.from({ length: 34 }).map(() => Math.floor(Math.random() * 255))));
};

/**
 * Generates a random DXN.
 * Accepts a custom domain, uses 'example' by default.
 */
export const createDXN = (domain = 'example'): DXN => {
  return DXN.fromDomainName(domain, faker.lorem.words(3).split(' ').join('-'));
};

/**
 * Generates a single resource, optionally generating a random name and type if none are provided.
 */
export const registerMockResource = async (
  registry: RegistryClient,
  params: {
    name?: DXN
    record?: CID
    owner?: AccountKey
    tag?: string
  } = {}
): Promise<void> => {
  return registry.registerResource(
    params.name ?? createDXN(), // TODO(burdon): Either pass in or don't.
    params.record ?? createCID(),
    params.owner ?? AccountKey.random(),
    params.tag ?? 'latest'
  );
};

/**
 * Generates a single random record.
 */
export const registerMockRecord = async (
  registry: RegistryClient,
  params: {
    typeRecord?: CID,
    data?: unknown,
    meta?: RecordMetadata
  }
): Promise<CID> => {
  const typeRecord = params.typeRecord ?? (await getRandomTypeRecord(registry)).cid;
  return registry.registerRecord(
    params.data ?? {},
    typeRecord,
    {
      displayName: params.meta?.displayName ?? faker.lorem.words(3),
      description: params.meta?.description ?? faker.lorem.sentence(),
      tags: params.meta?.tags ?? faker.lorem.words(3).split(' ')
    }
  );
};

export const getRandomTypeRecord = async (registry: RegistryClient) => {
  const types = await registry.getTypeRecords();
  return faker.random.arrayElement(types);
};

export const mockTypeMessageNames = [
  '.dxos.type.App',
  '.dxos.type.Bot',
  '.dxos.type.File',
  '.dxos.type.IPFS',
  '.dxos.type.KUBE',
  '.dxos.type.Service'
];

/**
 * Generates a single random type record.
 */
export const registerMockTypeRecord = (
  registry: RegistryClient,
  params: {
    messageName?: string,
    protobufDefs?: protobuf.Root,
    meta?: TypeRecordMetadata
  } = {}
): Promise<CID> => {
  return registry.registerTypeRecord(
    params.messageName ?? faker.random.arrayElement(mockTypeMessageNames),
    params.protobufDefs ?? decodeProtobuf(JSON.stringify(schemaJson)),
    {
      displayName: params.meta?.displayName ?? faker.lorem.words(3),
      description: params.meta?.description ?? faker.lorem.sentence(),
      tags: params.meta?.tags ?? faker.lorem.words(3).split(' '),
      protobufIpfsCid: params.meta?.protobufIpfsCid ?? createCID().toB58String()
    }
  );
};

/**
 * Generates a static list of predefined type records.
 */
export const registerMockTypes = async (registry: RegistryClient) => Promise.all(
  mockTypeMessageNames.map(messageName => registerMockTypeRecord(registry, { messageName }))
);

export const createMockTypes = (): RegistryType[] => mockTypeMessageNames.map(messageName => ({
  cid: createCID(),
  type: {
    messageName,
    protobufDefs: decodeProtobuf(JSON.stringify(schemaJson)),
    protobufIpfsCid: createCID()
  }
}));
