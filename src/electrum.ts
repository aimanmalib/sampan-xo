import { ElectrumClient } from '@electrum-cash/network';
import type { ChipnetConfig } from './config.js';
import type { Utxo } from './spend.js';

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

interface ElectrumUnspent {
  tx_hash: string;
  tx_pos: number;
  value: number;
  token_data?: { category: string; amount: string; nft?: unknown };
}

/** Lists the unspent outputs of a cash address, confirmed and in the mempool. */
export const listUnspent = async (client: ElectrumClient<never>, address: string): Promise<Utxo[]> => {
  const result = await client.request('blockchain.address.listunspent', address, 'include_tokens');
  if (result instanceof Error) throw result;
  return (result as ElectrumUnspent[]).map((u) => ({
    txid: u.tx_hash,
    vout: u.tx_pos,
    satoshis: BigInt(u.value),
    ...(u.token_data ? { token: { ...u.token_data, amount: BigInt(u.token_data.amount) } } : {}),
  }));
};

/** Broadcasts a raw transaction and returns the txid the server reports. */
export const broadcast = async (client: ElectrumClient<never>, hex: string): Promise<string> => {
  const result = await client.request('blockchain.transaction.broadcast', hex);
  if (result instanceof Error) throw result;
  return String(result);
};

/**
 * Sends a raw transaction to every configured server and returns one line per server.
 * Throws when no server accepted it.
 */
export const broadcastEverywhere = async (config: ChipnetConfig, hex: string): Promise<string[]> => {
  const lines: string[] = [];
  let accepted = 0;
  for (const server of config.electrumServers) {
    try {
      const client = await connectChipnet({ ...config, electrumServers: [server] });
      try {
        lines.push(`${server.host}: accepted ${await broadcast(client, hex)}`);
        accepted += 1;
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      lines.push(`${server.host}: ${String(error)}`);
    }
  }
  if (accepted === 0) throw new Error(`no server accepted the transaction:\n${lines.join('\n')}`);
  return lines;
};

/** Height of the chipnet chain tip the server follows. */
export const getTipHeight = async (client: ElectrumClient<never>): Promise<number> => {
  const result = await client.request('blockchain.headers.get_tip');
  if (result instanceof Error) throw result;
  return Number((result as { height: number }).height);
};

/** Height of the block that mined a transaction; 0 or below while it is still in the mempool (Fulcrum extension). */
export const getTransactionHeight = async (client: ElectrumClient<never>, txid: string): Promise<number> => {
  const result = await client.request('blockchain.transaction.get_height', txid);
  if (result instanceof Error) throw result;
  return Number(result ?? 0);
};
