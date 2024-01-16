//
// Copyright 2023 DXOS.org
// Copyright 2024 Automerge
// Ref: https://github.com/automerge/automerge-codemirror
//

import { type StateField } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';

import { next as automerge } from '@dxos/automerge/automerge';

import {
  getLastHeads,
  getPath,
  isReconcileTx,
  reconcileAnnotationType,
  updateHeads,
  type IDocHandle,
  type Value,
} from './defs';
import { updateAutomerge } from './update-automerge';
import { updateCodeMirror } from './update-codemirror';

type Doc<T> = automerge.Doc<T>;
type Heads = automerge.Heads;

type ChangeFn = (atHeads: Heads, change: (doc: Doc<unknown>) => void) => Heads | undefined;

/**
 * TODO(burdon): Comment.
 */
export class PatchSemaphore {
  _inReconcile = false;
  _queue: Array<ChangeFn> = [];

  constructor(private readonly _field: StateField<Value>) {}

  reconcile = (handle: IDocHandle, view: EditorView) => {
    if (this._inReconcile) {
      return;
    }
    this._inReconcile = true;

    const path = getPath(view.state, this._field);
    const oldHeads = getLastHeads(view.state, this._field);
    let selection = view.state.selection;

    // First undo all the unreconciled transactions.
    const transactions = view.state.field(this._field).unreconciledTransactions.filter((tx) => !isReconcileTx(tx));
    const toInvert = transactions.slice().reverse();
    for (const tx of toInvert) {
      const inverted = tx.changes.invert(tx.startState.doc);
      selection = selection.map(inverted);
      view.dispatch({
        changes: inverted,
        annotations: reconcileAnnotationType.of(true),
      });
    }

    // Apply the unreconciled transactions to the document.
    let newHeads = updateAutomerge(this._field, handle, transactions, view.state);

    // NOTE: null and undefined each come from automerge and repo respectively.
    if (newHeads === null || newHeads === undefined) {
      // TODO: @alexjg this is the call that's resetting the editor state on click
      newHeads = automerge.getHeads(handle.docSync()!);
    }

    // Now get the diff between the updated state of the document and the heads and apply that to the codemirror doc.
    const diff = automerge.equals(oldHeads, newHeads) ? [] : automerge.diff(handle.docSync()!, oldHeads, newHeads);
    updateCodeMirror(view, selection, path, diff);

    view.dispatch({
      effects: updateHeads(newHeads),
      annotations: reconcileAnnotationType.of({}),
    });

    this._inReconcile = false;
  };
}