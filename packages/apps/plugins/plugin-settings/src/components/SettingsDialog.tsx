//
// Copyright 2023 DXOS.org
//

import React, { useState } from 'react';

import { type Plugin, Surface, usePlugins } from '@dxos/app-framework';
import { Button, Dialog, List, ListItem, useTranslation } from '@dxos/react-ui';
import { ghostHover, ghostSelected, groupBorder, mx } from '@dxos/react-ui-theme';

import { SETTINGS_PLUGIN } from '../meta';

// TODO(burdon): Move into separate plugin.
export const SettingsDialogContent = () => {
  const { t } = useTranslation(SETTINGS_PLUGIN);

  // TODO(burdon): Store preview tab.
  const [plugin, setPlugin] = useState<string>('dxos.org/plugin/registry');
  const { plugins, enabled } = usePlugins();

  const core = [
    'dxos.org/plugin/layout',
    'dxos.org/plugin/client',
    'dxos.org/plugin/space',
    'dxos.org/plugin/registry',
  ];

  const filteredPlugins = enabled
    .map((id) => plugins.find((plugin) => plugin.meta.id === id))
    .filter((plugin) => (plugin?.provides as any)?.settings)
    .map((plugin) => plugin!.meta)
    .sort(({ name: a }, { name: b }) => a?.localeCompare(b ?? '') ?? 0);

  // TODO(burdon): Common treatment for dialogs (e.g., shrink height to fit, mobile, etc.)
  return (
    <Dialog.Content classNames={['h-full md:max-is-[40rem] overflow-hidden']}>
      <Dialog.Title>{t('settings dialog title')}</Dialog.Title>

      <div className='flex grow mlb-4 overflow-hidden'>
        <div className={mx('flex flex-col w-[200px] space-y-4 pr-4 border-r overflow-y-auto', groupBorder)}>
          <PluginList
            title='Options'
            plugins={core.map((id) => plugins.find((p) => p.meta.id === id)!.meta)}
            selected={plugin}
            onSelect={(plugin) => setPlugin(plugin)}
          />

          <PluginList
            title='Plugins'
            plugins={filteredPlugins}
            selected={plugin}
            onSelect={(plugin) => setPlugin(plugin)}
          />
        </div>

        <div className={mx('flex flex-col w-full md:px-4 divide-y overflow-y-auto', groupBorder)}>
          <Surface role='settings' data={{ plugin }} />
        </div>
      </div>

      <Dialog.Close asChild>
        <Button variant='primary' classNames='mbs-2' autoFocus>
          {t('done label', { ns: 'os' })}
        </Button>
      </Dialog.Close>
    </Dialog.Content>
  );
};

const PluginList = ({
  title,
  plugins,
  selected,
  onSelect,
}: {
  title: string;
  plugins: Plugin['meta'][];
  selected?: string;
  onSelect: (plugin: string) => void;
}) => {
  return (
    <div role='none'>
      <h2 className='my-1 px-2 text-sm text-neutral-500'>{title}</h2>
      <List selectable>
        {plugins.map((plugin) => (
          <ListItem.Root
            key={plugin.id}
            onClick={() => onSelect(plugin.id)}
            selected={plugin.id === selected}
            classNames={['px-2 rounded', plugin.id === selected && ghostSelected, ghostHover]}
          >
            <ListItem.Heading classNames={['flex w-full items-center cursor-pointer']}>{plugin.name}</ListItem.Heading>
          </ListItem.Root>
        ))}
      </List>
    </div>
  );
};