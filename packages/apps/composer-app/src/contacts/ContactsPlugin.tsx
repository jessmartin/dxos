//
// Copyright 2024 DXOS.org
//

import { type IconProps, Person } from '@phosphor-icons/react';
import { batch, effect } from '@preact/signals-core';
import React, { type FC } from 'react';

import { parseClientPlugin, type SchemaProvides } from '@braneframe/plugin-client';
import { parseSpacePlugin, updateGraphWithAddObjectAction } from '@braneframe/plugin-space';
import {
  type SurfaceProvides,
  type PluginDefinition,
  type MetadataRecordsProvides,
  resolvePlugin,
  parseIntentPlugin,
  type GraphBuilderProvides,
  type IntentResolverProvides,
} from '@dxos/app-framework';
import { EventSubscriptions } from '@dxos/async';
import { S, TypedObject, create } from '@dxos/echo-schema';
import { Filter, fullyQualifiedId } from '@dxos/react-client/echo';
import { Main } from '@dxos/react-ui';
import {
  baseSurface,
  topbarBlockPaddingStart,
  fixedInsetFlexLayout,
  bottombarBlockPaddingEnd,
} from '@dxos/react-ui-theme';

export class ContactType extends TypedObject({ typename: 'dxos.org/type/Contact', version: '0.1.0' })({
  title: S.optional(S.String),
}) {}

export const meta = {
  id: 'dxos.org/plugin/contacts',
};

// const CONTACT_ACTION = `${meta.id}/action`;

export enum ContactAction {
  CREATE = 'dxos.org/plugin/contacts/action/create',
}

type ContactProvides = SurfaceProvides &
  MetadataRecordsProvides &
  SchemaProvides &
  GraphBuilderProvides &
  IntentResolverProvides &
  SurfaceProvides;

const ContactsPlugin = (): PluginDefinition<ContactProvides> => {
  return {
    meta,
    ready: async (plugins) => {
      // code to execute when this plugin loads for the first time
    },
    provides: {
      metadata: {
        records: {
          [ContactType.typename]: {
            placeholder: 'Contact',
            icon: (props: IconProps) => <Person {...props} />,
          },
        },
      },
      echo: {
        schema: [ContactType],
      },
      graph: {
        builder: (plugins, graph) => {
          const client = resolvePlugin(plugins, parseClientPlugin)?.provides.client;
          const enabled = resolvePlugin(plugins, parseSpacePlugin)?.provides.space.enabled;
          const dispatch = resolvePlugin(plugins, parseIntentPlugin)?.provides.intent.dispatch;
          if (!client || !dispatch || !enabled) {
            return;
          }

          const subscriptions = new EventSubscriptions();
          const unsubscribe = effect(() => {
            subscriptions.clear();
            client.spaces.get().forEach((space) => {
              subscriptions.add(
                updateGraphWithAddObjectAction({
                  graph,
                  space,
                  plugin: meta.id,
                  action: ContactAction.CREATE,
                  properties: {
                    label: 'Create contact',
                    icon: (props: IconProps) => <Person {...props} />,
                    testId: 'contactPlugin.createObject',
                  },
                  dispatch,
                }),
              );
            });

            client.spaces
              .get()
              .filter((space) => !!enabled.find((id) => id === space.id))
              .forEach((space) => {
                // Add all contacts to the graph.
                const query = space.db.query(Filter.schema(ContactType));
                subscriptions.add(query.subscribe());
                let previousObjects: ContactType[] = [];
                subscriptions.add(
                  effect(() => {
                    const removedObjects = previousObjects.filter((object) => !query.objects.includes(object));
                    previousObjects = query.objects;

                    batch(() => {
                      removedObjects.forEach((object) => graph.removeNode(fullyQualifiedId(object)));
                      query.objects.forEach((object) => {
                        graph.addNodes({
                          id: fullyQualifiedId(object),
                          data: object,
                          properties: {
                            // TODO(wittjosiah): Reconcile with metadata provides.
                            label: object.title || 'Contact',
                            icon: (props: IconProps) => <Person {...props} />,
                            testId: 'spacePlugin.object',
                            persistenceClass: 'echo',
                            persistenceKey: space?.id,
                          },
                        });
                      });
                    });
                  }),
                );
              });
          });

          return () => {
            unsubscribe();
            subscriptions.clear();
          };
        },
      },
      surface: {
        component: ({ data, role }) => {
          switch (role) {
            case 'main': {
              return data.active instanceof ContactType ? <ContactMain map={data.active} /> : null;
            }
            case 'section': {
              return data.object instanceof ContactType ? <ContactMain map={data.object} /> : null;
            }
            case 'article': {
              return data.object instanceof ContactType ? <ContactMain map={data.object} /> : null;
            }
          }

          return null;
        },
      },
      intent: {
        resolver: (intent) => {
          switch (intent.action) {
            case ContactAction.CREATE: {
              return { data: create(ContactType, {}) };
            }
          }
        },
      },
    },
  };
};

const ContactMain: FC<{ contact: ContactType }> = ({ contact }) => {
  return (
    <Main.Content classNames={[baseSurface, fixedInsetFlexLayout, topbarBlockPaddingStart, bottombarBlockPaddingEnd]}>
      <h1>it's alive!</h1>
    </Main.Content>
  );
};

export default ContactsPlugin;
