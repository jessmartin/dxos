//
// Copyright 2023 DXOS.org
//

import { Plugin } from '@dxos/react-surface';

import { GraphNode, GraphNodeAction, GraphProvides } from './types';

export const ROOT: GraphNode = {
  id: 'root',
  index: 'a1',
  label: 'Root',
  description: 'Root node',
};

export const isGraphNode = (datum: unknown): datum is GraphNode =>
  datum && typeof datum === 'object' ? 'id' in datum && 'label' in datum : false;

type GraphPlugin = Plugin<GraphProvides>;
export const graphPlugins = (plugins: Plugin[]): GraphPlugin[] =>
  (plugins as GraphPlugin[]).filter(
    (p) => typeof p.provides?.graph?.nodes === 'function' || typeof p.provides?.graph?.actions === 'function',
  );

export const getActions = (node: GraphNode): GraphNodeAction[] =>
  Object.values(node.pluginActions ?? {})
    .flat()
    .sort((a, b) => {
      if (a.disposition === b.disposition) {
        return 0;
      }

      if (a.disposition === 'toolbar') {
        return -1;
      }

      return 1;
    });

export const buildGraph = (
  from: GraphNode,
  plugins: Plugin[],
  onUpdate?: (path: string[], nodes: GraphNode | GraphNode[]) => void,
  path: string[] = [],
  ignore: string[] = [],
): GraphNode => {
  const validPlugins = graphPlugins(plugins).filter((plugin) => !ignore.includes(plugin.meta.id));

  from.pluginChildren = validPlugins.reduce((acc, plugin) => {
    const emit = (newFrom?: GraphNode) => {
      if (!onUpdate) {
        return;
      }

      if (newFrom) {
        const index = nodes.findIndex((n) => n.id === newFrom.id);
        const stringIndex = index >= 0 ? String(index) : String(nodes.length);
        buildGraph(
          newFrom,
          plugins,
          onUpdate,
          [...path, 'pluginChildren', plugin.meta.id, stringIndex],
          [...ignore, plugin.meta.id],
        );
        onUpdate([...path, 'pluginChildren', plugin.meta.id, stringIndex], newFrom);
        return;
      }

      const newNodes = plugin.provides.graph.nodes?.(from, emit, plugins) ?? [];
      newNodes.forEach((node, index) =>
        buildGraph(
          node,
          plugins,
          onUpdate,
          [...path, 'pluginChildren', plugin.meta.id, String(index)],
          [...ignore, plugin.meta.id],
        ),
      );
      onUpdate([...path, 'pluginChildren', plugin.meta.id], newNodes);
    };

    const nodes = plugin.provides.graph.nodes?.(from, emit, plugins) ?? [];
    acc[plugin.meta.id] = nodes;
    return acc;
  }, (from.pluginChildren ?? {}) as Record<string, GraphNode[]>);

  from.pluginActions = validPlugins.reduce((acc, plugin) => {
    // TODO(wittjosiah): Actions emit.
    const actions = plugin.provides.graph.actions?.(from, () => {}, plugins) ?? [];
    acc[plugin.meta.id] = actions;
    return acc;
  }, (from.pluginActions ?? {}) as Record<string, GraphNodeAction[]>);

  for (const [id, nodes] of Object.entries(from.pluginChildren)) {
    for (const index in nodes) {
      const node = nodes[index];
      buildGraph(node, plugins, onUpdate, [...path, 'pluginChildren', id, index], [...ignore, id]);
    }
  }

  return from;
};
