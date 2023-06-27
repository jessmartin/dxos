//
// Copyright 2023 DXOS.org
//

import { File as FileIcon, FilePlus, FloppyDisk, FolderPlus, Plugs, X } from '@phosphor-icons/react';
import localforage from 'localforage';
import React from 'react';

import { MarkdownProvides } from '@braneframe/plugin-markdown';
import { createStore, createSubscription } from '@dxos/observable-object';
import {
  GraphNode,
  GraphNodeAction,
  GraphProvides,
  isGraphNode,
  RouterPluginProvides,
  Surface,
  TreeViewProvides,
  definePlugin,
  findPlugin,
  findGraphNode,
  TranslationsProvides,
} from '@dxos/react-surface';

import { LocalFileMain, LocalFileMainPermissions } from './components';
import translations from './translations';

export type LocalFile = {
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  title: string;
  text?: string;
};

const nodes = createStore<GraphNode<LocalFile>[]>([]);
const store = createStore<{ current: GraphNode<LocalFile> | undefined }>();

const handleKeyDown = async (event: KeyboardEvent) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === 's' && modifier && store.current) {
    event.preventDefault();
    await handleSave(store.current);
  }
};

const handleSave = async (node: GraphNode<LocalFile>) => {
  const handle = node.data?.handle as any;
  if (handle) {
    const writeable = await handle.createWritable();
    await writeable.write(node.data!.text);
    await writeable.close();
  } else {
    handleLegacySave(node);
  }

  node.attributes = { ...node.attributes, modified: false };
};

const handleLegacySave = (node: GraphNode<LocalFile>) => {
  const filename = typeof node.label === 'string' ? node.label : 'untitled.md';
  const contents = node.data?.text || '';
  const blob = new Blob([contents], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.setAttribute('href', window.URL.createObjectURL(blob));
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export type LocalFilesPluginProvides = GraphProvides & RouterPluginProvides & TranslationsProvides;

const isLocalFile = (datum: unknown): datum is LocalFile =>
  datum && typeof datum === 'object' ? 'title' in datum : false;

export const LocalFilesPlugin = definePlugin<LocalFilesPluginProvides, MarkdownProvides>({
  meta: {
    id: 'dxos:local',
  },
  init: async () => {
    return {
      markdown: {
        onChange: (text) => {
          if (store.current) {
            store.current.data!.text = text.toString();
            store.current.attributes = { ...store.current.attributes, modified: true };
          }
        },
      },
    };
  },
  ready: async (plugins) => {
    window.addEventListener('keydown', handleKeyDown);

    const value = await localforage.getItem<FileSystemHandle[]>(LocalFilesPlugin.meta.id);
    if (Array.isArray(value)) {
      await Promise.all(
        value.map(async (handle) => {
          if (handle.kind === 'file') {
            const node = await handleFile(handle);
            nodes.unshift(node);
          } else if (handle.kind === 'directory') {
            const node = await handleDirectory(handle);
            nodes.push(node);
          }
        }),
      );
    }

    const handle = createSubscription(async () => {
      await localforage.setItem(
        LocalFilesPlugin.meta.id,
        Array.from(nodes)
          .map((node) => node.data?.handle)
          .filter(Boolean),
      );
    });
    handle.update([nodes]);

    const treeViewPlugin = findPlugin<TreeViewProvides>(plugins, 'dxos:TreeViewPlugin');
    if (treeViewPlugin) {
      const handle = createSubscription(() => {
        store.current =
          (treeViewPlugin.provides.treeView.selected[0]?.startsWith(LocalFilesPlugin.meta.id) &&
            findGraphNode(nodes, treeViewPlugin.provides.treeView.selected)) ||
          undefined;
      });
      handle.update([treeViewPlugin.provides.treeView, nodes, ...Array.from(nodes)]);
    }
  },
  unload: async () => {
    window.removeEventListener('keydown', handleKeyDown);
  },
  provides: {
    translations,
    component: (datum, role) => {
      switch (role) {
        case 'main':
          if (isGraphNode(datum) && isLocalFile(datum.data) && datum.attributes?.disabled) {
            return LocalFileMainPermissions;
          }
          break;
      }

      return null;
    },
    components: {
      LocalFileMain,
    },
    graph: {
      nodes: () => nodes,
      actions: (plugins) => {
        const treeViewPlugin = findPlugin<TreeViewProvides>(plugins, 'dxos:TreeViewPlugin');

        const actions: GraphNodeAction[] = [
          {
            id: 'open-file-handle',
            label: ['open file label', { ns: LocalFilesPlugin.meta.id }],
            icon: FilePlus,
            invoke: async () => {
              if ('showOpenFilePicker' in window) {
                const [handle]: FileSystemFileHandle[] = await (window as any).showOpenFilePicker({
                  mode: 'readwrite',
                  types: [
                    {
                      description: 'Markdown',
                      accept: { 'text/markdown': ['.md'] },
                    },
                  ],
                });
                const node = await handleFile(handle);
                nodes.unshift(node);
                if (treeViewPlugin) {
                  treeViewPlugin.provides.treeView.selected = [node.id];
                }

                return;
              }

              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.md,text/markdown';
              input.onchange = async () => {
                const [file] = input.files ? Array.from(input.files) : [];
                if (file) {
                  const node = await handleLegacyFile(file);
                  nodes.unshift(node);
                  if (treeViewPlugin) {
                    treeViewPlugin.provides.treeView.selected = [node.id];
                  }
                }
              };
              input.click();
            },
          },
        ];

        if ('showDirectoryPicker' in window) {
          actions.push({
            id: 'open-directory',
            label: ['open directory label', { ns: LocalFilesPlugin.meta.id }],
            icon: FolderPlus,
            invoke: async () => {
              const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
              const node = await handleDirectory(handle);
              nodes.push(node);
              if (treeViewPlugin) {
                treeViewPlugin.provides.treeView.selected = [node.id, node.children![0]?.id];
              }
            },
          });
        }

        return actions;
      },
    },
    router: {
      routes: () => [
        {
          path: '/dxos/local/*',
          element: (
            <Surface
              component='dxos:SplitViewPlugin/SplitView'
              surfaces={{
                sidebar: { component: 'dxos:TreeViewPlugin/TreeView' },
                main: { component: 'dxos:local/LocalFileMain' },
              }}
            />
          ),
        },
      ],
      current: (params): string[] | null => {
        const splat = params['*'];
        if (!splat) {
          return null;
        }

        const [directory, ...rest] = splat.split('/');
        return [`${LocalFilesPlugin.meta.id}/${directory}`, ...rest];
      },
      next: (path, params): string[] | null => {
        if (!path.startsWith('/dxos/local/')) {
          return null;
        }

        return LocalFilesPlugin.provides!.router.current!(params);
      },
    },
  },
});

const handleDirectory = async (handle: any /* FileSystemDirectoryHandle */) => {
  const node = createStore<GraphNode<LocalFile>>({
    id: `${LocalFilesPlugin.meta.id}/${handle.name.replaceAll(/\.| /g, '-')}`,
    label: handle.name,
    data: {
      handle,
      title: handle.name,
    },
  });

  const closeAction: GraphNodeAction = {
    id: 'close-directory',
    label: ['close directory label', { ns: LocalFilesPlugin.meta.id }],
    icon: X,
    invoke: async () => {
      const index = nodes.indexOf(node);
      nodes.splice(index, 1);
    },
  };

  const grantedActions = [closeAction];

  const defaultActions: GraphNodeAction[] = [
    {
      id: 're-open',
      label: ['re-open directory label', { ns: LocalFilesPlugin.meta.id }],
      icon: Plugs,
      invoke: async () => {
        const result = await handle.requestPermission({ mode: 'readwrite' });
        if (result === 'granted' && node.actions) {
          node.actions = grantedActions;
          node.attributes = {};
          node.children = await handleDirectoryChildren(handle, node);
        }
      },
    },
    closeAction,
  ];

  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission === 'granted') {
    node.actions = grantedActions;
    node.attributes = {};
    node.children = await handleDirectoryChildren(handle, node);
  } else {
    node.actions = defaultActions;
    node.attributes = { disabled: true };
    node.children = [];
  }

  return node;
};

const handleDirectoryChildren = async (handle: any /* FileSystemDirectoryHandle */, parent: GraphNode<LocalFile>) => {
  const children: GraphNode<LocalFile>[] = [];

  for await (const child of handle.values()) {
    if (child.kind !== 'file' || !child.name.endsWith('.md')) {
      continue;
    }

    const file = await child.getFile();
    const node = createStore<GraphNode<LocalFile>>({
      id: child.name.replaceAll(/\.| /g, '-'),
      label: child.name,
      icon: FileIcon,
      parent,
      data: {
        handle: child,
        title: child.name,
        text: await file.text(),
      },
      actions: [
        {
          id: 'save',
          label: ['save label', { ns: LocalFilesPlugin.meta.id }],
          icon: FloppyDisk,
          invoke: async () => {
            await handleSave(node);
          },
        },
      ],
    });
    children.push(node);
  }

  return children;
};

const handleFile = async (handle: any /* FileSystemFileHandle */) => {
  const id = `${LocalFilesPlugin.meta.id}/${handle.name.replaceAll(/\.| /g, '-')}`;

  const permission = await handle.queryPermission({ mode: 'readwrite' });
  const data: LocalFile = {
    handle,
    title: handle.name,
  };

  const node = createStore<GraphNode<LocalFile>>({
    id,
    label: handle.name,
    icon: FileIcon,
    data,
  });

  const closeAction: GraphNodeAction = {
    id: 'close-directory',
    label: ['close file label', { ns: LocalFilesPlugin.meta.id }],
    icon: X,
    invoke: async () => {
      const index = nodes.indexOf(node);
      nodes.splice(index, 1);
    },
  };

  const grantedActions: GraphNodeAction[] = [
    {
      id: 'save',
      label: ['save label', { ns: LocalFilesPlugin.meta.id }],
      icon: FloppyDisk,
      invoke: async () => {
        await handleSave(node);
      },
    },
    closeAction,
  ];

  const defaultActions: GraphNodeAction[] = [
    {
      id: 're-open',
      label: ['re-open file label', { ns: LocalFilesPlugin.meta.id }],
      icon: Plugs,
      invoke: async () => {
        const result = await handle.requestPermission({ mode: 'readwrite' });
        if (result === 'granted' && node.actions) {
          const file = await handle.getFile();
          node.data = { ...node.data!, text: await file.text() };
          node.actions = grantedActions;
          node.attributes = {};
          node.children = undefined;
        }
      },
    },
    closeAction,
  ];

  if (permission === 'granted') {
    const file = await handle.getFile();
    node.data = { ...node.data!, text: await file.text() };
    node.actions = grantedActions;
    node.attributes = {};
  } else {
    node.actions = defaultActions;
    node.attributes = { disabled: true };
    node.children = [];
  }

  return node;
};

const handleLegacyFile = async (file: File) => {
  const id = `${LocalFilesPlugin.meta.id}/${file.name.replaceAll(/\.| /g, '-')}`;
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('loadend', (event) => {
      const text = event.target?.result;
      resolve(String(text));
    });
    reader.readAsText(file);
  });

  const node = createStore<GraphNode<LocalFile>>({
    id,
    label: file.name,
    icon: FileIcon,
    data: {
      title: file.name,
      text,
    },
    actions: [
      {
        id: 'save-as',
        label: ['save as label', { ns: LocalFilesPlugin.meta.id }],
        icon: FloppyDisk,
        invoke: async () => {
          await handleSave(node);
        },
      },
      {
        id: 'close-directory',
        label: ['close file label', { ns: LocalFilesPlugin.meta.id }],
        icon: X,
        invoke: async () => {
          const index = nodes.indexOf(node);
          nodes.splice(index, 1);
        },
      },
    ],
  });

  return node;
};