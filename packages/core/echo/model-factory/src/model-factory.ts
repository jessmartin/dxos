//
// Copyright 2020 DXOS.org
//

import assert from 'node:assert';

import { Event, scheduleTask } from '@dxos/async';
import { Any } from '@dxos/codec-protobuf';
import { Context } from '@dxos/context';
import { todo } from '@dxos/debug';
import { FeedWriter } from '@dxos/feed-store';
import { PublicKey } from '@dxos/keys';
import { ItemID } from '@dxos/protocols';
import { EchoObject } from '@dxos/protocols/proto/dxos/echo/object';

import { ModelType, ModelMeta, ModelConstructor, validateModelClass } from './types';

/**
 * Creates Model instances from a registered collection of Model types.
 */
export class ModelFactory {
  readonly registered = new Event<ModelConstructor<any>>();

  private _models = new Map<ModelType, { meta: ModelMeta; constructor: ModelConstructor<any> }>();

  hasModel(modelType: ModelType) {
    return this.getModel(modelType) !== undefined;
  }

  getModels() {
    return Array.from(this._models.values());
  }

  getModel(modelType: ModelType) {
    assert(modelType);
    return this._models.get(modelType);
  }

  // TODO(burdon): Remove?
  getModelMeta(modelType: ModelType): ModelMeta {
    if (!this._models.has(modelType)) {
      throw new Error(`Invalid model type: ${modelType}`);
    }

    const { meta } = this._models.get(modelType)!;
    return meta;
  }

  // TODO(burdon): Test if already registered.
  registerModel(constructor: ModelConstructor<any>): this {
    validateModelClass(constructor);
    const { meta } = constructor;
    this._models.set(meta.type, { meta, constructor });

    scheduleTask(new Context(), () => {
      this.registered.emit(constructor);
    });

    return this;
  }

  /**
   * Instantiates new StateManager with the underlying model.
   * @param modelType Model type DXN.
   * @param itemId Id of the item holding the model.
   * @param snapshot Snapshot defining the intial state. `{}` can be provided for empty state.
   * @param memberKey IDENTITY key of the member authoring the model's mutations.
   * @param writeStream Stream for outbound messages.
   * @deprecated
   */
  createModel(
    modelType: ModelType,
    itemId: ItemID,
    _snapshot: EchoObject,
    _memberKey: PublicKey, // TODO(burdon): Change to client ID?
    _writeStream?: FeedWriter<Any>
  ): any {
    assert(itemId);
    const _constructor = this._models.get(modelType)?.constructor;
    return todo();
  }
}
