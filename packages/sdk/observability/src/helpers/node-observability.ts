//
// Copyright 2022 DXOS.org
//
import yaml from 'js-yaml';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuid, validate as validateUuid } from 'uuid';

import type { Config } from '@dxos/client';
import { log } from '@dxos/log';

import { Observability, type Mode } from '../observability';

/**
 * Print observability banner once per installation.
 */
export const showObservabilityBanner = async (configDir: string, bannercb: (input: string) => void) => {
  const path = join(configDir, '.observability-banner-printed');
  if (existsSync(path)) {
    return;
  }
  bannercb(
    // eslint-disable-next-line no-multi-str
    'Basic observability data will be sent to the DXOS team in order to improve the product. This includes \
    performance metrics, error logs, and usage data. No personally identifiable information, other than your \
    public key, is included with this data and no private data ever leaves your devices. To disable sending \
    observability data, set the environment variable DX_DISABLE_OBSERVABILITY=true.',
  );

  await writeFile(path, '', 'utf-8');
};

export const getObservabilityState = async (configDir: string): Promise<PersistentObservabilityState> => {
  // check whether configDir exists and if it's a directory

  if (existsSync(configDir)) {
    if (!statSync(configDir).isDirectory()) {
      throw new Error(`Config directory ${configDir} exists but is not a directory`);
    }
  } else {
    await mkdir(configDir, { recursive: true });
  }

  const idPath = join(configDir, 'observability.yml');
  if (existsSync(idPath)) {
    const context = await readFile(idPath, 'utf-8');
    return validate(context) ?? initializeState(idPath);
  }

  return initializeState(idPath);
};

export type TelemetryContext = {
  mode: Mode;
  installationId?: string;
  group?: string;
  timezone: string;
  runtime: string;
  os: string;
  arch: string;
  ci: boolean;
  [key: string]: any;
};

export type PersistentObservabilityState = {
  installationId: string;
  group?: string;
  mode: Mode;
};

// create initial state and write to file, using environment variables to override defaults.
const initializeState = async (idPath: string): Promise<PersistentObservabilityState> => {
  // TODO(nf): read initial values from config or seed file
  const observabilityState = {
    installationId: uuid(),
    group: process.env.DX_TELEMETRY_GROUP ?? undefined,
    mode: (process.env.DX_DISABLE_OBSERVABILITY ? 'disabled' : process.env.DX_OBSERVABILITY_MODE ?? 'basic') as Mode,
  };

  await writeFile(
    idPath,
    '# This file is automatically generated by the @dxos/cli.\n' + yaml.dump(observabilityState),
    'utf-8',
  );

  return observabilityState;
};

const validate = (contextString: string) => {
  const context = yaml.load(contextString) as PersistentObservabilityState;
  if (Boolean(context.installationId) && validateUuid(context.installationId!)) {
    return {
      ...context,
      mode: process.env.DX_DISABLE_OBSERVABILITY ? 'disabled' : context.mode ?? 'basic',
    };
  }
};

export type NodeObservabilityOptions = {
  installationId: string;
  group?: string;
  namespace: string;
  config: Config;
  mode?: Mode;
  tracingEnable?: boolean;
  replayEnable?: boolean;
  // TODO(nf): options for providers?
};

export const initializeNodeObservability = async ({
  namespace,
  config,
  installationId,
  group,
  mode = 'basic',
  tracingEnable = true,
  replayEnable = true,
}: NodeObservabilityOptions): Promise<Observability> => {
  log('initializeCliObservability', { config });

  const release = `${namespace}@${config.get('runtime.app.build.version')}`;
  const environment = config.get('runtime.app.env.DX_ENVIRONMENT');

  const observability = new Observability({
    namespace,
    group,
    mode,
    errorLog: {
      sentryInitOptions: {
        environment,
        release,
        // TODO(wittjosiah): Configure this.
        sampleRate: 1.0,
      },
      logProcessor: true,
    },
  });

  observability.setTag('installationId', installationId);

  const IPDATA_API_KEY = config.get('runtime.app.env.DX_IPDATA_API_KEY');
  try {
    const res = await fetch(`https://api.ipdata.co/?api-key=${IPDATA_API_KEY}`);
    const ipData = await res.json();
    ipData && observability.addIPDataTelemetryTags(ipData);
  } catch (err) {
    observability?.captureException(err);
  }
  return observability;
};
