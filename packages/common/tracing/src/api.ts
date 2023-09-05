//
// Copyright 2023 DXOS.org
//

import { Context } from '@dxos/context';

import { getTracingContext } from './symbols';
import { TRACE_PROCESSOR } from './trace-processor';

/**
 * Annotates a class as a tracked resource.
 */
const resource =
  () =>
  <T extends { new (...args: any[]): {} }>(constructor: T) => {
    const klass = class extends constructor {
      constructor(...rest: any[]) {
        super(...rest);
        TRACE_PROCESSOR.traceResourceConstructor({ constructor, instance: this });
      }
    };
    Object.defineProperty(klass, 'name', { value: constructor.name });
    return klass;
  };

/**
 * Marks a property or a method to be included in the resource info section.
 */
const info = () => (target: any, propertyKey: string, descriptor?: PropertyDescriptor) => {
  getTracingContext(target).infoProperties[propertyKey] = {};
};

const mark = (name: string) => {
  performance.mark(name);
};

export type SpanOptions = {
  showInBrowserTimeline?: boolean;
};

const span =
  ({ showInBrowserTimeline = false }: SpanOptions = {}) =>
  (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any) => any>) => {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any) {
      const parentCtx = args[0] instanceof Context ? args[0] : null;
      const span = TRACE_PROCESSOR.traceSpan({
        parentCtx,
        methodName: propertyKey,
        instance: this,
        showInBrowserTimeline,
      });

      const callArgs = span.ctx ? [span.ctx, ...args.slice(1)] : args;
      try {
        return await method.apply(this, callArgs);
      } catch (err) {
        span.markError(err);
        throw err;
      } finally {
        span.markSuccess();
      }
    };
  };

/**
 * Attaches metrics counter to the resource.
 */
const metricsCounter = () => (target: any, propertyKey: string, descriptor?: PropertyDescriptor) => {
  getTracingContext(target).metricsProperties[propertyKey] = {};
};

export type AddLinkOptions = {};

const addLink = (parent: any, child: any, opts: AddLinkOptions = {}) => {
  TRACE_PROCESSOR.addLink(parent, child, opts);
};

export const trace = {
  resource,
  info,
  mark,
  span,
  metricsCounter,

  addLink,
};