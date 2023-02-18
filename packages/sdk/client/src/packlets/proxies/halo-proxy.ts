//
// Copyright 2021 DXOS.org
//

import assert from 'node:assert';
import { inspect } from 'node:util';

import {
  asyncTimeout,
  Event,
  EventSubscriptions,
  Observable,
  observableError,
  ObservableProvider,
  Trigger
} from '@dxos/async';
import {
  AuthenticatingInvitationObservable,
  CancellableInvitationObservable,
  ClientServicesProvider,
  HaloInvitationsProxy,
  InvitationsOptions
} from '@dxos/client-services';
import { keyPairFromSeedPhrase } from '@dxos/credentials';
import { inspectObject } from '@dxos/debug';
import { ResultSet } from '@dxos/echo-db';
import { ApiError } from '@dxos/errors';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import { Contact, Profile } from '@dxos/protocols/proto/dxos/client';
import { Invitation } from '@dxos/protocols/proto/dxos/client/services';
import { Credential, Presentation } from '@dxos/protocols/proto/dxos/halo/credentials';
import { DeviceInfo } from '@dxos/protocols/proto/dxos/halo/credentials/identity';
import { humanize } from '@dxos/util';

type CreateProfileOptions = {
  publicKey?: PublicKey;
  secretKey?: PublicKey;
  displayName?: string;
  seedphrase?: string;
};

// TODO(wittjosiah): This is kind of cumbersome.
type DeviceEvents = {
  onUpdate(devices: DeviceInfo[]): void;
  onError(error?: Error): void;
};

/**
 * TODO(burdon): Public API (move comments here).
 */
export interface Halo {
  get profile(): Profile | undefined;
  get invitations(): CancellableInvitationObservable[];
  createProfile(options?: CreateProfileOptions): Promise<Profile>;
  recoverProfile(seedPhrase: string): Promise<Profile>;
  subscribeToProfile(callback: (profile: Profile) => void): void;

  queryDevices(): Observable<DeviceEvents, DeviceInfo[]>;
  queryContacts(): ResultSet<Contact>;

  createInvitation(): CancellableInvitationObservable;
  removeInvitation(id: string): void;
  acceptInvitation(invitation: Invitation): AuthenticatingInvitationObservable;
}

const THROW_TIMEOUT_ERROR_AFTER = 3000;

export class HaloProxy implements Halo {
  private readonly _subscriptions = new EventSubscriptions();
  private readonly _contactsChanged = new Event(); // TODO(burdon): Remove (use subscription).
  public readonly invitationsUpdate = new Event<CancellableInvitationObservable | void>();
  public readonly profileChanged = new Event(); // TODO(burdon): Move into Profile object.

  private _invitations: CancellableInvitationObservable[] = [];
  private _invitationProxy?: HaloInvitationsProxy;

  private _profile?: Profile;
  private _contacts: Contact[] = [];

  // prettier-ignore
  constructor(
    private readonly _serviceProvider: ClientServicesProvider
  ) {}

  [inspect.custom]() {
    return inspectObject(this);
  }

  // TODO(burdon): Include deviceId.
  toJSON() {
    return {
      key: this._profile?.identityKey.truncate()
    };
  }

  /**
   * User profile info.
   */
  get profile(): Profile | undefined {
    return this._profile;
  }

  get invitations() {
    return this._invitations;
  }

  // TODO(burdon): Standardize isOpen, etc.
  get opened() {
    return this._invitationProxy !== undefined;
  }

  /**
   * Allocate resources and set-up internal subscriptions.
   */
  async open() {
    const gotProfile = this.profileChanged.waitForCount(1);
    // const gotContacts = this._contactsChanged.waitForCount(1);

    assert(this._serviceProvider.services.HaloInvitationsService, 'HaloInvitationsService not available');
    // TODO(burdon): ???
    this._invitationProxy = new HaloInvitationsProxy(this._serviceProvider.services.HaloInvitationsService);

    assert(this._serviceProvider.services.ProfileService, 'ProfileService not available');
    const profileStream = this._serviceProvider.services.ProfileService.subscribeProfile();
    profileStream.subscribe((data) => {
      this._profile = data.profile;
      this.profileChanged.emit();
    });

    this._subscriptions.add(() => profileStream.close());

    // const contactsStream = this._serviceProvider.services.HaloService.subscribeContacts();
    // contactsStream.subscribe(data => {
    //   this._contacts = data.contacts as SpaceMember[];
    //   this._contactsChanged.emit();
    // });

    // this._subscriptions.add(() => contactsStream.close());

    await Promise.all([gotProfile]);
  }

  /**
   * Destroy the instance and clean-up subscriptions.
   */
  async close() {
    this._subscriptions.clear();
    this._invitationProxy = undefined;
    this._profile = undefined;
    this._contacts = [];
  }

  /**
   * @deprecated
   */
  subscribeToProfile(callback: (profile: Profile) => void): () => void {
    return this.profileChanged.on(() => callback(this._profile!));
  }

  /**
   * Create Profile.
   * Add Identity key if public and secret key are provided.
   * Then initializes profile with given display name.
   * If no public and secret key or seedphrase are provided it relies on keyring to contain an identity key.
   * Seedphrase must not be specified with existing keys.
   * @returns User profile info.
   */
  async createProfile({ publicKey, secretKey, displayName, seedphrase }: CreateProfileOptions = {}): Promise<Profile> {
    if (seedphrase && (publicKey || secretKey)) {
      throw new ApiError('Seedphrase must not be specified with existing keys');
    }

    if (seedphrase) {
      const keyPair = keyPairFromSeedPhrase(seedphrase);
      publicKey = PublicKey.from(keyPair.publicKey);
      secretKey = PublicKey.from(keyPair.secretKey);
    }

    assert(this._serviceProvider.services.ProfileService, 'ProfileService not available');
    // TODO(burdon): Rename createIdentity?
    this._profile = await this._serviceProvider.services.ProfileService.createProfile({
      publicKey: publicKey?.asUint8Array(),
      secretKey: secretKey?.asUint8Array(),
      displayName
    });

    return this._profile;
  }

  /**
   * Joins an existing identity HALO from a recovery seed phrase.
   */
  async recoverProfile(seedPhrase: string) {
    assert(this._serviceProvider.services.ProfileService, 'ProfileService not available');
    this._profile = await this._serviceProvider.services.ProfileService.recoverProfile({
      seedPhrase
    });
    return this._profile;
  }

  /**
   * Query for contacts. Contacts represent member keys across all known Spaces.
   */
  queryContacts(): ResultSet<Contact> {
    return new ResultSet(this._contactsChanged, () => this._contacts);
  }

  /**
   * Get set of authenticated devices.
   */
  queryDevices() {
    // TODO(wittjosiah): Try to make this easier to use for simple cases like this.
    const observable = new ObservableProvider<DeviceEvents, DeviceInfo[]>();
    assert(this._serviceProvider.services.DevicesService, 'DeviceService not available');
    const stream = this._serviceProvider.services.DevicesService.queryDevices();

    // TODO(wittjosiah): Does stream need to be closed?
    stream.subscribe(
      (data) => {
        const devices =
          data.devices?.map((device) => ({
            publicKey: device.deviceKey,
            displayName: humanize(device.deviceKey)
          })) ?? [];
        observable.setValue(devices);
        observable.callback.onUpdate(devices);
      },
      (err) => {
        if (err) {
          observableError(observable, err);
        }
      }
    );

    return observable;
  }

  /**
   * Get Halo credentials for the current user.
   */
  queryCredentials({ id, type }: { id?: PublicKey; type?: string } = {}) {
    if (!this._profile) {
      throw new ApiError('Identity is not available.');
    }
    if (!this._serviceProvider.services.SpacesService) {
      throw new ApiError('SpacesService is not available.');
    }
    const stream = this._serviceProvider.services.SpacesService.queryCredentials({
      spaceKey: this._profile.haloSpace!
    });
    this._subscriptions.add(() => stream.close());

    const observable = new ObservableProvider<
      { onUpdate: (credentials: Credential[]) => void; onError: (error?: Error) => void },
      Credential[]
    >();
    const credentials: Credential[] = [];

    stream.subscribe(
      (credential) => {
        credentials.push(credential);
        const newCredentials = credentials
          .filter((c) => !id || (c.id && id.equals(c.id)))
          .filter((c) => !type || c.subject.assertion['@type'] === type);
        if (
          newCredentials.length !== observable.value?.length ||
          !newCredentials.every(
            (credential, index) =>
              credential.id && observable.value![index] && credential.id.equals(observable.value![index].id!)
          )
        ) {
          observable.setValue(newCredentials);
          observable.callback.onUpdate(newCredentials);
        }
      },
      (err) => {
        if (err) {
          observableError(observable, err);
        }
      }
    );

    return observable;
  }

  /**
   * Initiates device invitation.
   */
  createInvitation(options?: InvitationsOptions) {
    if (!this.opened) {
      throw new ApiError('Client not open.');
    }

    log('create invitation', options);
    const invitation = this._invitationProxy!.createInvitation(undefined, options);
    this._invitations = [...this._invitations, invitation];

    const unsubscribe = invitation.subscribe({
      onConnecting: () => {
        this.invitationsUpdate.emit(invitation);
        unsubscribe();
      },
      onCancelled: () => {
        unsubscribe();
      },
      onSuccess: () => {
        unsubscribe();
      },
      onError: function (err: any): void {
        unsubscribe();
      }
    });

    return invitation;
  }

  /**
   * Removes device invitation.
   */
  removeInvitation(id: string) {
    log('remove invitation', { id });
    const index = this._invitations.findIndex((invitation) => invitation.invitation?.invitationId === id);
    void this._invitations[index]?.cancel();
    this._invitations = [...this._invitations.slice(0, index), ...this._invitations.slice(index + 1)];
    this.invitationsUpdate.emit();
  }

  /**
   * Initiates accepting invitation.
   */
  acceptInvitation(invitation: Invitation, options?: InvitationsOptions) {
    if (!this.opened) {
      throw new ApiError('Client not open.');
    }

    log('accept invitation', options);
    return this._invitationProxy!.acceptInvitation(invitation, options);
  }

  /**
   * Write credentials to halo profile.
   */
  async writeCredentials(credentials: Credential[]) {
    if (!this._profile) {
      throw new ApiError('Identity is not available.');
    }
    if (!this._serviceProvider.services.SpacesService) {
      throw new ApiError('SpacesService is not available.');
    }
    return this._serviceProvider.services.SpacesService.writeCredentials({
      spaceKey: this._profile.haloSpace!,
      credentials
    });
  }

  /**
   * Present Credentials.
   */
  async presentCredentials({ id, nonce }: { id: PublicKey; nonce: Uint8Array }): Promise<Presentation> {
    if (!this._serviceProvider.services.ProfileService) {
      throw new ApiError('ProfileService is not available.');
    }
    const trigger = new Trigger<Credential>();
    this.queryCredentials({ id }).subscribe({
      onUpdate: (credentials) => {
        const credential = credentials.find((credential) => credential.id?.equals(id));
        if (credential) {
          trigger.wake(credential);
        }
      },
      onError: (err) => {
        log.catch(err);
      }
    });

    const credential = await asyncTimeout(
      trigger.wait(),
      THROW_TIMEOUT_ERROR_AFTER,
      new ApiError('Timeout while waiting for credential')
    );
    return this._serviceProvider.services.ProfileService!.signPresentation({
      presentation: {
        credentials: [credential]
      },
      nonce
    });
  }
}
