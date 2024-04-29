//
// Copyright 2024 DXOS.org
//

import { type Context, LifecycleState, Resource } from '@dxos/context';
import { invariant } from '@dxos/invariant';
import { PublicKey } from '@dxos/keys';
import { type DataService } from '@dxos/protocols/proto/dxos/echo/service';
import { ComplexMap } from '@dxos/util';

import { AutomergeContext } from '../automerge';
import { EchoDatabaseImpl } from '../database';
import { Hypergraph } from '../hypergraph';

export type EchoClientParams = {};

export type ConnectToServiceParams = {
  dataService: DataService;
};

export type CreateDatabaseParams = {
  // TODO(dmaretskyi): Consider changing to string id.
  spaceKey: PublicKey;

  /**
   * Space proxy reference for SDK compatibility.
   */
  // TODO(dmaretskyi): Remove.
  owningObject?: unknown;
};

/**
 * ECHO client.
 * Manages a set of databases and builds a unified hypergraph.
 * Connects to the ECHO host via an ECHO service.
 */
export class EchoClient extends Resource {
  private readonly _graph: Hypergraph;
  private readonly _databases = new ComplexMap<PublicKey, EchoDatabaseImpl>(PublicKey.hash);

  private _dataService: DataService | undefined = undefined;
  private _automergeContext: AutomergeContext | undefined = undefined;

  constructor(params: EchoClientParams) {
    super();
    this._graph = new Hypergraph();
  }

  get graph(): Hypergraph {
    return this._graph;
  }

  /**
   * Connects to the ECHO service.
   * Must be called before open.
   */
  connectToService({ dataService }: ConnectToServiceParams) {
    invariant(this._lifecycleState === LifecycleState.CLOSED);
    this._dataService = dataService;
  }

  disconnectFromService() {
    invariant(this._lifecycleState === LifecycleState.CLOSED);
    this._dataService = undefined;
  }

  protected override async _open(ctx: Context): Promise<void> {
    invariant(this._dataService, 'Invalid state: not connected');
    this._automergeContext = new AutomergeContext(this._dataService, {
      spaceFragmentationEnabled: true,
    });
  }

  protected override async _close(ctx: Context): Promise<void> {
    for (const db of this._databases.values()) {
      this._graph._unregister(db.spaceKey);
      await db.close();
    }
    this._databases.clear();
    await this._automergeContext?.close();
    this._automergeContext = undefined;
  }

  // TODO(dmaretskyi): Make async.
  createDatabase({ spaceKey, owningObject }: CreateDatabaseParams) {
    invariant(this._lifecycleState === LifecycleState.OPEN);
    invariant(!this._databases.has(spaceKey), 'Database already exists.');
    const db = new EchoDatabaseImpl({
      automergeContext: this._automergeContext!,
      graph: this._graph,
      spaceKey,
    });
    this._graph._register(spaceKey, db, owningObject);
    this._databases.set(spaceKey, db);
    return db;
  }
}
