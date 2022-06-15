//
// Copyright 2020 DXOS.org
//

//
// TODO(burdon): Factor out helpers.
//

import assert from 'assert';
import stableStringify from 'json-stable-stringify';

import { createKeyPair, KeyPair, PublicKey, PublicKeyLike, PUBLIC_KEY_LENGTH, SECRET_KEY_LENGTH } from '@dxos/crypto';

import { KeyChain, KeyRecord, KeyType, createDateTimeString } from '../proto';
import { MakeOptional } from '../typedefs';
import { SecretKey } from './keytype';

/**
 * Checks for a valid publicKey Buffer.
 */
// TODO(burdon): Move to dxos/crypto.
export function isValidPublicKey (key: PublicKeyLike, keyType?: KeyType): key is PublicKeyLike {
  try {
    PublicKey.from(key);
    if (keyType && [KeyType.PARTY, KeyType.IDENTITY, KeyType.FEED, KeyType.DEVICE].includes(keyType)) {
      assert(PublicKey.from(key).asUint8Array().length === PUBLIC_KEY_LENGTH);
    }
    return true;
  } catch (e: any) {
  }
  return false;
}

/**
 * Checks for a valid publicKey Buffer.
 */
// TODO(burdon): Move to dxos/crypto.
export function assertValidPublicKey (key: PublicKeyLike, keyType?: KeyType): asserts key is PublicKeyLike {
  assert(key);
  assert(isValidPublicKey(key, keyType));
}

/**
 * Checks for a valid secretKey Buffer.
 */
// TODO(burdon): Move to dxos/crypto.
export function assertValidSecretKey (key?: SecretKey, keyType?: KeyType): asserts key is SecretKey {
  assert(key);
  if (keyType && [KeyType.PARTY, KeyType.IDENTITY, KeyType.FEED, KeyType.DEVICE].includes(keyType)) {
    assert(key.length === SECRET_KEY_LENGTH);
  }
}

/**
 * Checks for a valid publicKey/secretKey KeyPair.
 */
// TODO(burdon): Move to dxos/crypto.
export function assertValidKeyPair (keyRecord: any): asserts keyRecord is KeyPair {
  const { publicKey, secretKey, type } = keyRecord;
  assertValidPublicKey(publicKey, type);
  assertValidSecretKey(secretKey, type);
}

/**
 * Checks that the KeyRecord contains no secrets (ie, secretKey and seedPhrase).
 */
export const assertNoSecrets = (keyRecord: Omit<KeyRecord, 'key'>) => {
  assert(keyRecord);
  // TODO(marik-d): Check if booleans are used anywhere.
  // TODO(marik-d): Check if seed phrase is stored in key records.
  assert(!keyRecord.secretKey || (keyRecord.secretKey as any) === true);
  assert(!(keyRecord as any).seedPhrase || ((keyRecord as any).seedPhrase as any) === true);
};

/**
 * Obscures the value of secretKey and seedPhrase with a boolean.
 */
export const stripSecrets = (keyRecord: KeyRecord): KeyRecord => {
  assert(keyRecord);
  // eslint-disable-next-line unused-imports/no-unused-vars
  const { secretKey, seedPhrase, ...stripped } = keyRecord as any;
  return stripped;
};

/**
 * Checks that there are no unknown attributes on the KeyRecord.
 */
export const assertValidAttributes = (keyRecord: Partial<KeyRecord>) => {
  // TODO(burdon): Define protocol buffer.
  const ALLOWED_FIELDS = [
    'type', 'key', 'publicKey', 'secretKey', 'hint', 'own', 'trusted', 'added', 'created'
  ];

  Object.keys(keyRecord).forEach(key => {
    assert(ALLOWED_FIELDS.find(k => k === key));
  });
};

/**
 * Create a new KeyRecord with the indicated attributes.
 * @param attributes Valid attributes above.
 * @param keyPair If undefined then a public/private key pair will be generated.
 */
export const createKeyRecord = (attributes: Partial<KeyRecord> = {},
  keyPair: MakeOptional<KeyPair, 'secretKey'> = createKeyPair()): KeyRecord => {
  const { publicKey: rawPublicKey, secretKey } = keyPair;
  const publicKey = PublicKey.from(rawPublicKey);

  // Disallow invalid attributes.
  assertValidAttributes(attributes);

  return {
    type: KeyType.UNKNOWN,
    hint: false,
    own: !!secretKey,
    trusted: true,
    created: createDateTimeString(),

    // Overrides the defaults above.
    ...attributes,

    publicKey,
    secretKey
  };
};

/**
 * Utility method to produce stable output for signing/verifying.
 */
// TODO(burdon): Factor out.
export const canonicalStringify = (obj: any) => {
  return stableStringify(obj, {
    /* The point of signing and verifying is not that the internal, private state of the objects be
     * identical, but that the public contents can be verified not to have been altered. For that reason,
     * really private fields (indicated by '__') are not included in the signature.
     * This gives a mechanism for attaching other attributes to an object without breaking the signature.
     * We also skip @type.
     */
    replacer: (key: any, value: any) => {
      if (key.toString().startsWith('__') || key.toString() === '@type') {
        return undefined;
      }
      if (value) {
        if (PublicKey.isPublicKey(value)) {
          return value.toHex();
        }
        if (Buffer.isBuffer(value)) {
          return value.toString('hex');
        }
        if (value instanceof Uint8Array || (value.data && value.type === 'Buffer')) {
          return Buffer.from(value).toString('hex');
        }
      }
      return value;
    }
  });
};

/**
 * Is object `key` a KeyChain?
 */
export const isKeyChain = (key: any = {}): key is KeyChain => {
  return isValidPublicKey(key.publicKey) && key.message && key.message.signed && Array.isArray(key.message.signatures);
};

/**
 * Checks conformity and normalizes the KeyRecord. (Used before storing, so that only well-formed records are stored.)
 * @return A normalized copy of keyRecord.
 */
export const checkAndNormalizeKeyRecord = (keyRecord: Omit<KeyRecord, 'key'>) => {
  assert(keyRecord);
  assertValidAttributes(keyRecord);

  const { publicKey, secretKey, ...rest } = keyRecord;
  assertValidPublicKey(publicKey);
  if (secretKey) {
    assertValidSecretKey(secretKey);
  }

  return createKeyRecord(
    {
      added: createDateTimeString(),
      ...rest
    },
    {
      publicKey: PublicKey.from(publicKey).asBuffer(),
      secretKey: secretKey ? Buffer.from(secretKey) : undefined
    }
  );
};
