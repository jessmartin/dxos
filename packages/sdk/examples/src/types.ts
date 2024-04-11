//
// Copyright 2024 DXOS.org
//

import * as S from '@effect/schema/Schema';

import { TypedObject } from '@dxos/echo-schema';

export class TaskType extends TypedObject({ typename: 'dxos.docs.Task', version: '0.1.0' })({
  title: S.string,
  completed: S.boolean,
}) {}
