/**
 * Shows that the Landing template compiles to the redeem bytecode of the deployed Sampan landing contract.
 * Reads tests/fixtures/landing-deployed.json (a mainnet giveBack read once from Electrum) and the cashc artifact
 * tests/fixtures/landing-artifact.json; no network.
 *
 *   npx tsx scripts/check-bytecode.ts [--json]
 *   npx tsx scripts/check-bytecode.ts --params config/chipnet.json [--json]   (template and cashc for those parameters)
 */
import { readFileSync } from 'node:fs';
import {
  checkDeployed,
  compareRedeems,
  fixtureParams,
  paramsFromConfig,
  type CashcArtifact,
  type DeployedFixture,
} from '../src/landing-bytecode.js';

const read = <T>(path: string | URL): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const args = process.argv.slice(2);
const json = args.includes('--json');
const paramsAt = args.indexOf('--params');
const fixture = read<DeployedFixture>(new URL('../tests/fixtures/landing-deployed.json', import.meta.url));
const artifact = read<CashcArtifact>(new URL('../tests/fixtures/landing-artifact.json', import.meta.url));

const deployed = checkDeployed(fixture, artifact);
const report =
  paramsAt === -1
    ? { params: fixtureParams(fixture), ...deployed }
    : (() => {
        const config = read<{ landing: Parameters<typeof paramsFromConfig>[0]; testToken?: { category: string } }>(args[paramsAt + 1] ?? '');
        // Chipnet takes the category from its test token; mainnet states it in the landing section.
        const params = paramsFromConfig({
          ...config.landing,
          category: config.landing.category ?? config.testToken?.category ?? null,
        });
        const deployedParams = fixtureParams(fixture);
        const changed = Object.keys(params).filter(
          (key) => params[key as keyof typeof params] !== deployedParams[key as keyof typeof params],
        );
        return { params, ...compareRedeems(params, artifact), deployedIdentical: deployed.identical, differsFromDeployedIn: changed };
      })();

if (json) console.log(JSON.stringify(report, null, 2));
else for (const [key, value] of Object.entries(report)) console.log(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
process.exitCode = report.identical ? 0 : 1;
