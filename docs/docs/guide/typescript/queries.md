---
order: 5
title: Queries
---

# Queries

The simplest way to read the items in a space is to use the `space.experimental.db.query()` method. It's also possible to obtain strongly typed results as described [below](#typed-queries).

## Untyped Queries

Once access is obtained to a [space](./spaces), objects can be retrieved:

```ts{12,14,16} file=./snippets/read-items.ts#L5-
import { Client } from '@dxos/client';

const client = new Client();

async () => {
  await client.initialize();
  // get a list of all spaces
  const { value: spaces } = client.echo.querySpaces();
  // grab a space
  const space = spaces[0];
  // get all items
  const allObjects = space.experimental.db.query();
  // get items that match a filter
  const tasks = space.experimental.db.query({ type: 'task' });
  // get items that match a predicate
  const finishedTasks = space.experimental.db.query(
    (doc) => doc.type == 'task' && doc.isCompleted
  );
};
```

The result is an iterable collection of objects that can be used like an array.

## Typed Queries

It's possible to receive strongly typed results from a `query`. Pass a type argument to `query<T>` which descends from [`Document`](/api/@dxos/client/classes/Document):

```ts{5,17} file=./snippets/read-items-typed.ts#L5-
import { Client, Document } from '@dxos/client';

const client = new Client();

class Task extends Document {
  public declare type: 'task';
  public declare isCompleted: boolean;
}

async () => {
  await client.initialize();
  // get a list of all spaces
  const { value: spaces } = client.echo.querySpaces();
  // grab a space
  const space = spaces[0];
  // get items that match a filter
  const tasks = space.experimental.db.query<Task>({ type: 'task' });
};
```

The type of the resulting objects must descend from `Document` because ECHO tracks objects returned from `query`. Mutating the objects directly (setting values, modifying arrays, ..., etc.) will cause ECHO to propagate those changes to all listening ECHO peers in the space.

DXOS provides a tool for conveniently generating entity classes (like `Task` above) that work with the `query<T>` interface.

> There are many benefits to expressing the type schema of an application in a language-neutral and inter-operable way. One of them is the ability to generate type-safe data layer code, which makes development faster and safer.

[`Protobuf`](https://protobuf.dev/) is well oriented towards schema migrations, while at the same time being compact and efficient on the wire and in-memory.

Consider this expression of schema declared in [`protobuf`](https://protobuf.dev/):

```proto{6,13} file=../react/snippets/schema.proto
syntax = "proto3";

package example.tasks;

message Task {
  option (object) = true;

  string title = 1;
  bool completed = 2;
}

message TaskList {
  option (object) = true;

  string title = 1;
  repeated Task tasks = 2;
}
```

Using a tool called `dxtype` from `@dxos/echo-schema` classes can be generated for use with DXOS Client.

```bash
dxtype <input protobuf file> <output typescript file>
```

::: note
Note the directives `option (object) = true;` which instruct the framework to generate TypeScript classes from the marked `messages`.
:::

::: info Tip
If you're using one of the DXOS [application templates](../cli/app-templates), this type generation step is pre-configured as a [`prebuild`](https://docs.npmjs.com/cli/v9/using-npm/scripts#pre--post-scripts) script for you.
:::

::: details See TypeScript output from `dxtype`
The output is a typescript file that looks roughly like this:

```ts file=./snippets/schema.ts#L5-
import { DocumentBase, TypeFilter, EchoSchema } from "@dxos/react-client";

export const schema = EchoSchema.fromJson(
  '{ "protobuf generated json here": true }'
);

export class Task extends DocumentBase {
  static readonly type = schema.getType('dxos.tasks.Task');

  static filter(opts?: { title?: string, completed?: boolean }): TypeFilter<Task> {
    return Task.type.createFilter(opts);
  }

  constructor(opts?: { title?: string, completed?: boolean }) {
    super({ ...opts, '@type': Task.type.name }, Task.type);
  }

  declare title: string;
  declare completed: boolean;
}
```

Declared are the ancestor class and specific fields on the type.

There are other utilities like a `filter` you can pass to `useQuery` to locate items of this type.
:::

To use the type declarations, simply import the relevant type like `Task` from the typescript location out of `dxtype` and pass it to `query<T>`:

```ts file=./snippets/read-items-typed-2.ts#L5-
import { Client } from '@dxos/client';
import { Task } from "./schema";

const client = new Client();

async () => {
  await client.initialize();
  // get a list of all spaces
  const { value: spaces } = client.echo.querySpaces();
  // grab a space
  const space = spaces[0];
  // get items that match a filter: type inferred from Task.filter()
  const tasks = space.experimental.db.query(Task.filter());
};
```

The resulting collection is an iterable like `Task[]`.