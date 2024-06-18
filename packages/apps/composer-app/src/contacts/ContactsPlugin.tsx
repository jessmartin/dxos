//
// Copyright 2024 DXOS.org
//

import { type IconProps, Person } from '@phosphor-icons/react';
import { batch, effect } from '@preact/signals-core';
import React, { useCallback, useEffect, useRef, useState, type FC } from 'react';

import { parseClientPlugin, type SchemaProvides } from '@braneframe/plugin-client';
import { parseSpacePlugin, updateGraphWithAddObjectAction } from '@braneframe/plugin-space';
import { type StackProvides } from '@braneframe/plugin-stack';
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
  firstName: S.optional(S.String),
  lastName: S.optional(S.String),
  website: S.optional(S.String),
  phone: S.optional(S.String),
  email: S.optional(S.String),
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
  SurfaceProvides &
  StackProvides;

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
                            label: object.firstName || object.lastName || 'New Contact',
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
      stack: {
        creators: [
          {
            id: 'create-stack-section-contact',
            testId: 'contactPlugin.createSectionSpaceContact',
            label: 'Create contact',
            icon: (props: any) => <Person {...props} />,
            intent: {
              plugin: meta.id,
              action: ContactAction.CREATE,
            },
          },
        ],
      },
      surface: {
        component: ({ data, role }) => {
          switch (role) {
            case 'main': {
              return data.active instanceof ContactType ? <ContactMain contact={data.active} /> : null;
            }
            case 'section': {
              return data.object instanceof ContactType ? <ContactSection contact={data.object} /> : null;
            }
            case 'article': {
              return data.object instanceof ContactType ? <ContactArticle contact={data.object} /> : null;
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

export default ContactsPlugin;

const ContactSection: FC<{ contact: ContactType }> = ({ contact }) => {
  return (
    <div className='max-bs-96 mlb-2 is-full sticky-top-0'>
      <ContactComponent contact={contact} />
    </div>
  );
};

const ContactMain: FC<{ contact: ContactType }> = ({ contact }) => {
  return (
    <Main.Content classNames={[baseSurface, fixedInsetFlexLayout, topbarBlockPaddingStart, bottombarBlockPaddingEnd]}>
      <ContactComponent contact={contact} />
    </Main.Content>
  );
};

const ContactArticle: FC<{ contact: ContactType }> = ({ contact }) => {
  return (
    <div role='none' className='row-span-2 overflow-auto'>
      <ContactComponent contact={contact} />
    </div>
  );
};

const ContactComponent: FC<{ contact: ContactType }> = ({ contact }) => {
  const [editMode, setEditMode] = useState(false);
  const [formState, setFormState] = useState<ContactType>(
    // Hack to make a deep copy of the contact object and eject from the reactive proxy.
    JSON.parse(JSON.stringify(contact)),
  );

  useEffect(() => {
    setFormState(JSON.parse(JSON.stringify(contact)));
  }, [JSON.stringify(contact)]);

  const firstNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (contactIsEmpty(contact)) {
      setEditMode(true);
      setTimeout(() => firstNameInputRef.current?.focus(), 0);
    }
  }, [contact, setEditMode]);

  const contactIsEmpty = (contact: ContactType | null) => {
    if (!contact) {
      return true;
    }
    return !contact.firstName && !contact.lastName && !contact.email && !contact.phone && !contact.website;
  };

  const updateContactField = useCallback(
    (field: string, newValue: any) => {
      // Mutate the reactive echo object
      if (contact) {
        contact[field] = newValue;
      }
    },
    [contact],
  );

  return (
    <div>
      <button
        onClick={() => {
          setEditMode(!editMode);
        }}
        className='relative float-right m-4 rounded bg-blue-500 px-2 py-1 text-white text-sm font-bold'
      >
        {editMode ? 'Done' : 'Edit'}
      </button>
      {editMode ? (
        <div className='mb-4 text-center text-2xl font-bold'>
          <input
            ref={firstNameInputRef}
            type='text'
            value={formState?.firstName}
            onChange={(e) => setFormState((state) => ({ ...state, firstName: e.target.value }))}
            onBlur={(e) => updateContactField('firstName', e.target.value)}
            className='rounded border px-2 py-1 text-2xl font-bold text-center'
            style={{
              width: `${formState?.firstName ? formState?.firstName.length + 1 : 0}ch`,
            }}
          />
          <input
            type='text'
            value={formState?.lastName}
            onChange={(e) => setFormState((state) => ({ ...state, lastName: e.target.value }))}
            onBlur={(e) => updateContactField('lastName', e.target.value)}
            className='rounded border px-2 py-1 text-2xl font-bold text-center'
            style={{
              width: `${formState?.lastName ? formState.lastName.length + 1 : 0}ch`,
            }}
          />
        </div>
      ) : (
        <div className='mb-4 px-2 py-1 text-center text-2xl font-bold  dark:text-gray-200'>
          {formState?.firstName && formState.firstName.length > 0 ? formState.firstName : '\u00A0'}{' '}
          {formState?.lastName && formState.lastName.length > 0 ? formState.lastName : '\u00A0'}
        </div>
      )}
      <div className='flex flex-col'>
        {['email', 'phone', 'website'].map((field) => {
          return (
            <div key={field} className='mb-2 flex items-center rounded bg-gray-100 p-2 dark:bg-gray-700'>
              <div className='mr-2 w-20 text-right text-sm text-gray-500 dark:text-gray-400'>{field}</div>
              {editMode ? (
                <div className='w-full'>
                  <input
                    type='text'
                    value={formState[field]}
                    onChange={(e) =>
                      setFormState((state) => {
                        return { ...state, [field]: e.target.value };
                      })
                    }
                    onBlur={(e) => updateContactField(field, e.target.value)}
                    className='w-full px-2 py-1'
                  />
                </div>
              ) : (
                <div className='px-2 py-1'>{formState[field] ?? '\u00A0'}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
