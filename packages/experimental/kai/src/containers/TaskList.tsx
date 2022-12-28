//
// Copyright 2022 DXOS.org
//

import { PlusCircle } from 'phosphor-react';
import React, { FC } from 'react';

import { id } from '@dxos/echo-schema';
import { getSize } from '@dxos/react-uikit';

import { Card, Input, Table } from '../components';
import { useQuery, useSubscription, useSpace } from '../hooks';
import { createTask, Task } from '../proto';

export const TaskList: FC<{ completed?: boolean; readonly?: boolean; title?: string }> = ({
  completed = undefined,
  readonly = false,
  title = 'Tasks'
}) => {
  const { database: db } = useSpace();
  const tasks = useQuery(db, Task.filter({ completed }));

  const handleCreate = async () => {
    await createTask(db);
  };

  const Menubar = () => (
    <button className='mr-2' onClick={handleCreate}>
      <PlusCircle className={getSize(6)} />
    </button>
  );

  // TODO(burdon): Delete row.
  // TODO(burdon): Ordered list (linked list?)
  // TODO(burdon): Split current task if pressing Enter in the middle.
  // TODO(burdon): Delete key to potentially remove task.
  // TODO(burdon): Tab to indent.
  // TODO(burdon): Track index position; move up/down.
  // TODO(burdon): Scroll into view.
  // TODO(burdon): Highlight active row.
  return (
    <Card title={title} className='bg-teal-400' menubar={!readonly && <Menubar />}>
      <div className='p-3'>
        {tasks.map((task) => (
          <TaskItem key={task[id]} task={task} />
        ))}
      </div>
    </Card>
  );
};

export const TaskItem: FC<{ task: Task }> = ({ task }) => {
  const { database: db } = useSpace();
  useSubscription(db, [task, task.assignee]);

  return (
    <Table
      sidebar={
        <input
          type='checkbox'
          spellCheck={false}
          checked={!!task.completed}
          onChange={() => (task.completed = !task.completed)}
        />
      }
      header={
        <Input
          className='w-full outline-0'
          spellCheck={false}
          value={task.title}
          onChange={(value) => (task.title = value)}
        />
      }
    >
      <div className='text-sm text-blue-800'>
        <div>{task.assignee?.name}</div>
      </div>
    </Table>
  );
};