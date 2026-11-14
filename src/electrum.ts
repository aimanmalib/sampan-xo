import { ElectrumClient } from '@electrum-cash/network';
import type { ChipnetConfig } from './config.js';

export interface AddressBalance {
  confirmed: number;
  unconfirmed: number;
}

const application = 'swap-intent-xo-template';
const protocolVersion = '1.5';

/** Connects to the first chipnet Electrum server in the config that answers. */
export const connectChipnet = async (config: ChipnetConfig): Promise<ElectrumClient<never>> => {
  const errors: string[] = [];
  for (const server of config.electrumServers) {
    const client = new ElectrumClient<never>(application, protocolVersion, server.host, {
      port: server.port,
      encrypted: server.transport === 'wss' || server.transport === 'tcp_tls',
      timeoutInMilliSeconds: 15_000,
    });
    try {
      await client.connect();
      return client;
    } catch (error) {
      errors.push(`${server.host}:${server.port} ${String(error)}`);
    }
  }
  throw new Error(`no chipnet Electrum server answered: ${errors.join('; ')}`);
};

/** Reads the confirmed and unconfirmed balance of a cash address, in satoshis. */
export const getBalance = async (client: ElectrumClient<never>, address: string): Promise<AddressBalance> => {
  const result = await client.request('blockchain.address.get_balance', address);
  if (result instanceof Error) throw result;
  const { confirmed, unconfirmed } = result as { confirmed: number; unconfirmed: number };
  return { confirmed: Number(confirmed), unconfirmed: Number(unconfirmed) };
};
