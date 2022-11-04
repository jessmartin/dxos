//
// Copyright 2022 DXOS.org
//

import yaml from 'js-yaml';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuid, validate as validateUuid } from 'uuid';

import { captureException } from '@dxos/sentry';

import telemetryrc from './telemetryrc.json';

export const DX_ENVIRONMENT = telemetryrc.DX_ENVIRONMENT ?? undefined;
export const DX_RELEASE = telemetryrc.DX_RELEASE ?? undefined;
export const SENTRY_DESTINATION = telemetryrc.SENTRY_DESTINATION ?? undefined;
export const TELEMETRY_API_KEY = telemetryrc.TELEMETRY_API_KEY ?? undefined;

export type TelemetryContext = {
  installationId: string;
  isInternalUser: boolean;
  fullCrashReports: boolean;
  disableTelemetry: boolean;
};

const DEFAULTS = {
  isInternalUser: false,
  fullCrashReports: false,
  disableTelemetry: false
};

export const getTelemetryContext = async (configDir: string): Promise<TelemetryContext> => {
  const configDirExists = await exists(configDir);
  if (!configDirExists) {
    await mkdir(configDir, { recursive: true });
  }

  const idPath = join(configDir, 'telemetry.yml');
  if (await exists(idPath)) {
    const context = await readFile(idPath, 'utf-8');
    return validate(context) ?? createContext(idPath);
  }

  return createContext(idPath);
};

const createContext = async (idPath: string) => {
  const installationId = uuid();
  const context = yaml.dump({ installationId });
  const comment = '# This file is automatically generated by the @dxos/cli.\n';
  await writeFile(idPath, `${comment}${context}`, 'utf-8');
  return { ...DEFAULTS, installationId };
};

const validate = (contextString: string) => {
  try {
    const context = yaml.load(contextString) as TelemetryContext;
    if (Boolean(context.installationId) && validateUuid(context.installationId)) {
      return { ...DEFAULTS, ...context };
    }
  } catch (err: any) {
    captureException(err);
  }
};

// TODO(wittjosiah): Factor out.
const exists = async (filePath: string): Promise<boolean> => {
  try {
    const result = await stat(filePath);
    return !!result;
  } catch (err: any) {
    if (/ENOENT/.test(err.message)) {
      return false;
    } else {
      throw err;
    }
  }
};
