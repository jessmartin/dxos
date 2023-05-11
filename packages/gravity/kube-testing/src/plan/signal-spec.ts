//
// Copyright 2023 DXOS.org
//

import { scheduleTaskInterval, sleep } from '@dxos/async';
import { cancelWithContext, Context } from '@dxos/context';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import { range } from '@dxos/util';

import { Analyzer } from '../analysys';
import { TestBuilder } from '../test-builder';
import { randomArraySlice } from '../util';
import { AgentParams, PlanResults, TestParams, TestPlan } from './spec-base';

export type SignalTestSpec = {
  servers: number;
  serverOverride?: string;
  signalArguments: string[];

  agents: number;
  serversPerAgent: number;

  type: 'discovery' | 'signaling';
  topicCount: number;
  topicsPerAgent: number;

  /**
   * Time to allow everything to init. NOTE: Sometimes first message is not dropped if it is sent too soon.
   */
  startWaitTime: number;
  discoverTimeout: number;
  repeatInterval: number;
  agentWaitTime: number;
  duration: number;
};

export type SignalAgentConfig = {
  servers: string[];
  topics: string[];
};

export class SignalTestPlan implements TestPlan<SignalTestSpec, SignalAgentConfig> {
  builder = new TestBuilder();

  async init({ spec, outDir }: TestParams<SignalTestSpec>): Promise<SignalAgentConfig[]> {
    await Promise.all(range(spec.servers).map((num) => this.builder.createServer(num, outDir, spec.signalArguments)));

    const topics = Array.from(range(spec.topicCount)).map(() => PublicKey.random());

    return range(spec.agents).map((): SignalAgentConfig => {
      const servers = spec.serverOverride
        ? [spec.serverOverride]
        : randomArraySlice(
            this.builder.servers.map((server) => server.url()),
            spec.serversPerAgent
          );

      return {
        servers,
        topics: randomArraySlice(topics, spec.topicsPerAgent).map((topic) => topic.toHex())
      };
    });
  }

  async run({ agentId, agents, spec, config, outDir }: AgentParams<SignalTestSpec, SignalAgentConfig>): Promise<void> {
    const ctx = new Context();

    log.info('start', { agentId });

    // const agentsPerTopic: Record<string, string[]> = {};
    // for (const [agentId, agentCfg] of Object.entries(agents)) {
    //   for (const topic of agentCfg.topics) {
    //     agentsPerTopic[agentId] ??= [];
    //     agentsPerTopic[agentId].push(topic);
    //   }
    // }

    const agent = await this.builder.createPeer({
      signals: config.servers.map((server) => ({ server })),
      peerId: PublicKey.from(agentId)
    });

    // NOTE: Sometimes first message is not dropped if it is sent too soon.
    await sleep(spec.startWaitTime);

    //
    // test
    //
    let testCounter = 0;
    scheduleTaskInterval(
      ctx,
      async () => {
        log.info(`${testCounter++} test iteration running...`);

        switch (spec.type) {
          case 'discovery': {
            agent.regeneratePeerId();
            const topics = config.topics.map((topic) => PublicKey.from(topic));
            for (const topic of topics) {
              await cancelWithContext(ctx, agent.joinTopic(PublicKey.from(topic)));
            }

            await sleep(spec.discoverTimeout);

            await Promise.all(topics.map((topic) => cancelWithContext(ctx, agent.leaveTopic(PublicKey.from(topic)))));
            break;
          }
          case 'signaling': {
            await agent.sendMessage(PublicKey.from(randomArraySlice(Object.keys(agents), 1)[0]));
            break;
          }
          default:
            throw new Error(`Unknown test type: ${spec.type}`);
        }

        log.info('iteration finished');
      },
      spec.repeatInterval
    );

    await sleep(spec.duration);
    await ctx.dispose();
    await sleep(spec.agentWaitTime);
  }

  async finish(params: TestParams<SignalTestSpec>, results: PlanResults): Promise<any> {
    await this.builder.destroy();
    const analyser = new Analyzer(results);
    switch (params.spec.type) {
      case 'discovery': {
        return analyser.analyzeSwarmEvents();
      }
      case 'signaling': {
        return analyser.analyzeMessages();
      }
      default: {
        throw new Error(`Unknown test type: ${params.spec.type}`);
      }
    }
  }
}