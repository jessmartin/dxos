//
// Copyright 2022 DXOS.org
//

import invariant from 'tiny-invariant';

import { Event } from '@dxos/async';
import { DocumentModel } from '@dxos/document-model';
import { DatabaseProxy, Item, ItemManager, QueryOptions } from '@dxos/echo-db';
import { log } from '@dxos/log';
import { EchoObject as EchoObjectProto } from '@dxos/protocols/proto/dxos/echo/object';
import { TextModel } from '@dxos/text-model';

import { base, db } from './defs';
import { EchoObject } from './object';
import { Filter, Query, TypeFilter } from './query';
import { DatabaseRouter } from './router';
import { Text } from './text-object';
import { TypedObject } from './typed-object';

/**
 * Database wrapper.
 */
export class EchoDatabase {
  private readonly _objects = new Map<string, EchoObject>();

  /**
   * @internal
   */
  public readonly _updateEvent = new Event<Item[]>();

  constructor(
    /**
     * @internal
     */
    public readonly _itemManager: ItemManager,
    public readonly _backend: DatabaseProxy,
    private readonly _router: DatabaseRouter,
  ) {
    this._backend.itemUpdate.on(this._update.bind(this));
    this._update([]);
  }

  get objects() {
    return Array.from(this._objects.values());
  }

  /**
   * @deprecated
   */
  get router() {
    return this._router;
  }

  // TODO(burdon): Return type via generic?
  getObjectById<T extends TypedObject>(id: string): T | undefined {
    const obj = this._objects.get(id);
    if (!obj) {
      return undefined;
    }
    if ((obj as any).__deleted === true) {
      return undefined;
    }

    return obj as T;
  }

  /**
   * Add object to the database.
   * Restores the object if it was deleted.
   */
  add<T extends EchoObject>(obj: T): T {
    log('save', { id: obj.id, type: (obj as any).__typename });
    invariant(obj.id); // TODO(burdon): Undefined when running in test.
    invariant(obj[base]);
    if (obj[base]._database) {
      this._backend.mutate({
        objects: [
          {
            objectId: obj[base]._id,
            mutations: [
              {
                action: EchoObjectProto.Mutation.Action.RESTORE,
              },
            ],
          },
        ],
      });
      return obj;
    }

    invariant(!obj[db]);
    obj[base]._database = this;
    this._objects.set(obj[base]._id, obj);

    const batchCreated = this._backend.beginBatch();
    try {
      obj[base]._beforeBind();

      const snapshot = obj[base]._createSnapshot();

      const result = this._backend.mutate({
        objects: [
          {
            objectId: obj[base]._id,
            genesis: {
              modelType: obj[base]._modelConstructor.meta.type,
            },
            snapshot: {
              // TODO(dmaretskyi): Parent id, deleted flag.
              model: snapshot,
            },
          },
        ],
      });
      invariant(result.objectsUpdated.length === 1);

      obj[base]._bind(result.objectsUpdated[0]);
    } finally {
      if (batchCreated) {
        this._backend.commitBatch();
      }
    }

    return obj;
  }

  /**
   * Remove object.
   */
  remove<T extends EchoObject>(obj: T) {
    this._backend.mutate({
      objects: [
        {
          objectId: obj[base]._id,
          mutations: [
            {
              action: EchoObjectProto.Mutation.Action.DELETE,
            },
          ],
        },
      ],
    });
  }

  /**
   * Wait for all pending operations to complete.
   */
  async flush() {
    await this._backend.flush();
  }

  /**
   * Filter by type.
   */
  // TODO(burdon): Additional filters?
  query<T extends TypedObject>(filter: TypeFilter<T>, options?: QueryOptions): Query<T>;
  query(filter?: Filter<any>, options?: QueryOptions): Query;
  query(filter: Filter<any>, options?: QueryOptions): Query {
    return new Query(this._objects, this._updateEvent, filter, options);
  }

  private _update(changed: Item[]) {
    for (const object of this._itemManager.entities.values() as any as Item<any>[]) {
      if (!this._objects.has(object.id)) {
        const obj = this._createObjectInstance(object);
        if (!obj) {
          continue;
        }

        obj[base]._id = object.id;
        this._objects.set(object.id, obj);
        obj[base]._database = this;
        obj[base]._bind(object);
      }
    }

    // Dispatch update events.
    for (const item of changed) {
      const obj = this._objects.get(item.id);
      if (obj) {
        obj[base]._itemUpdate();
      }
    }

    this._updateEvent.emit(changed);
  }

  /**
   * Create object with a proper prototype representing the given item.
   */
  private _createObjectInstance(item: Item<any>): EchoObject | undefined {
    if (item.modelType === DocumentModel.meta.type) {
      const type = item.state['@type'];
      if (!type) {
        return new TypedObject();
      }

      const Proto = this._router.schema?.getPrototype(type);
      if (!Proto) {
        log.warn('Unknown schema type', { type });
        return new TypedObject(); // TODO(burdon): Expando?
      } else {
        return new Proto();
      }
    } else if (item.modelType === TextModel.meta.type) {
      return new Text();
    } else {
      log.warn('Unknown model type', { type: item.modelType });
      return undefined;
    }
  }
}
