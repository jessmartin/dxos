//
// Copyright 2021 DXOS.org
//

import { DomainKey } from './domain-key';

export type DXNString = string;

/**
 * Decentralized Name.
 * Example: dxn://example:foo/bar
 */
export class DXN {
  /**
   * Lower-case.
   * Starts with a letter.
   * Min 3 and max 32 characters.
   * Must not have multiple hyphens in a row or end with a hyphen.
   * @param domain
   */
  static validateDomain (domain: string) {
    domain = domain.toLowerCase();
    if (!domain.match(/^[a-z][a-z0-9-]{2,31}$/)) {
      throw new Error(`Invalid domain: ${domain}`);
    }

    domain.split('-').forEach(word => {
      if (word.length === 0 || word.endsWith('-')) {
        throw new Error(`Invalid domain: ${domain}`);
      }
    });

    return domain;
  }

  /**
   * Validates and normalizes DNX.
   * Change to lower-case.
   * Starts with a letter.
   * Min 3 and max 64 characters.
   * Must not have multiple periods in a row or end with a period or hyphen.
   * @param resource
   */
  // TODO(burdon): Separate function to normalize (e.g., change to lowercase, replaces dots).
  // TODO(burdon): Separate function to encode (e.g., change / to .).
  static validateResource (resource: string) {
    resource = resource.trim().toLowerCase();
    if (!resource.match(/^[a-z][a-z\d-/]{0,63}$/)) {
      throw new Error(`Invalid resource: ${resource}`);
    }

    // Prohibit repeated or trailing delimiters.
    resource.split(/[./-]/).forEach(word => {
      if (word.length === 0 || word.endsWith('-') || word.endsWith('.') || word.endsWith('/')) {
        throw new Error(`Invalid resource: ${resource}`);
      }
    });

    return resource;
  }

  static urlencode (dxn: DXN) {
    return dxn.toString().replace(/\//g, '.');
  }

  static urldecode (encodedDxn: string) {
    return DXN.parse(encodedDxn.replace(/\./g, '/'));
  }

  static parse (dxn: string) {
    const match = dxn.match(/^(~?)([^:]+):([^:]+)/);
    if (!match) {
      throw new Error(`Invalid DXN: ${dxn}`);
    }

    const [, tilda, domain, resource] = match;
    if (tilda) {
      return DXN.fromDomainKey(DomainKey.fromHex(domain), resource);
    } else {
      return DXN.fromDomainName(domain, resource);
    }
  }

  static fromDomainKey (key: DomainKey, resource: string) {
    resource = DXN.validateResource(resource);
    return new DXN({ key, resource });
  }

  static fromDomainName (domain: string, resource: string) {
    domain = DXN.validateDomain(domain);
    resource = DXN.validateResource(resource);
    return new DXN({ domain, resource });
  }

  public readonly key?: DomainKey;
  public readonly domain?: string;
  public readonly resource: string; // TODO(burdon): Rename path? name?

  private constructor ({ key, domain, resource }: {
    key?: DomainKey,
    domain?: string,
    resource: string
  }) {
    this.key = key;
    this.domain = domain;
    this.resource = resource;
  }

  toString () {
    if (this.domain) {
      return `${this.domain}:${this.resource}`;
    } else {
      return `~${this.key!.toHex()}:${this.resource}`;
    }
  }
}
