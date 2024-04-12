//
// Copyright 2024 DXOS.org
//

import { getSchema, type Expando, getEchoObjectAnnotation } from '@dxos/echo-schema';
import { invariant } from '@dxos/invariant';

import { jsonSerializer } from './serializer';
import { serializers } from './serializers';
import { TypeOfExpando } from './types';

/**
 * @deprecated Workaround for ECHO not supporting clone.
 */
// TODO(burdon): Remove?
export const cloneObject = async (object: Expando): Promise<Expando> => {
  const schema = getSchema(object);
  const typename = schema ? getEchoObjectAnnotation(schema)?.typename ?? TypeOfExpando : TypeOfExpando;
  const serializer = serializers[typename] ?? jsonSerializer;
  invariant(serializer, `No serializer for type: ${typename}`);
  const data = await serializer.serialize(object, serializers);
  return serializer.deserialize(data, undefined, serializers);
};