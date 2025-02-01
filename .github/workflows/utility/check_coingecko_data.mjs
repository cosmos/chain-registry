import fs from 'fs/promises';
import * as chain_reg from './chain_registry.mjs';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/list';
const COINGECKO_JSON_PATH = './state/coingecko.json';

let coingecko_api_response = null;

chain_reg.setup("../../..");

async function fetchCoingeckoData() {
  try {
    const response = await fetch(COINGECKO_API_URL);
    coingecko_api_response = await response.json();
  } catch (error) {
    console.error('Error fetching Coingecko data:', error);
  }
}

export async function loadCoingeckoState() {
  try {
    const data = await fs.readFile(COINGECKO_JSON_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { coingecko_data: [] }; // Return empty structure if file doesn't exist
    }
    throw error;
  }
}

async function saveCoingeckoState(data) {
  await fs.writeFile(COINGECKO_JSON_PATH, JSON.stringify(data, null, 2));
}


async function removeInvalidCoingeckoIds() {

  //const assetPointers = getAllAssetPointers(); // Replace with your function
  await fetchCoingeckoData();
  const validCoingeckoIds = new Set(coingecko_api_response.map(entry => entry.id));

  const assetPointers = getAssetPointers();
  for (const asset of assetPointers) {
    const coingecko_id = chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id");
    if (coingecko_id && !validCoingeckoIds.has(coingecko_id)) {
      console.log(`Removing invalid Coingecko ID: ${coingecko_id} from ${asset.chain_name} ${asset.base_denom}`);
      chain_reg.setAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id", "");
    }
  }
}

async function processAssets() {

  const coingeckoState = {};//await loadCoingeckoState();//  Use this for validation
  coingeckoState.coingecko_data = [];

  await fetchCoingeckoData();
  if (!coingecko_api_response) {
    console.log("No CoinGecko API Response");
    return;
  }

  const assetPointers = getAssetPointers();
  for (const asset of assetPointers) {
    const coingecko_id = chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id");
    if (!coingecko_id) { continue; }

    const coingeckoEntry = coingecko_api_response.find(entry => entry.id === coingecko_id);
    if (!coingeckoEntry) {
      console.log(`Missing Coingecko ID: ${coingecko_id} for asset`, asset);
      continue;
    }

    const registryName = chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "name");
    const registrySymbol = chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "symbol");

    if (
      registryName !== coingeckoEntry.name
        &&
      registrySymbol.toUpperCase() !== coingeckoEntry.symbol.toUpperCase()
    ) {
      console.warn(`Warning: Mismatch of both Name and Symbol for Coingecko ID ${coingecko_id}. Registry: "${registryName} $${registrySymbol}", Coingecko: "${coingeckoEntry.name} $${coingeckoEntry.symbol.toUpperCase()}"`);
    }

    let coingeckoDataEntry = coingeckoState.coingecko_data.find(entry => entry.coingecko_id === coingecko_id);
    if (!coingeckoDataEntry) {
      coingeckoDataEntry = {
        coingecko_id,
        //_comment: `${coingeckoEntry.name} $${coingeckoEntry.symbol.toUpperCase()}`,
        _comment: `${chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "name")} $${chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "symbol")}`,
        assets: []
      };
      coingeckoState.coingecko_data.push(coingeckoDataEntry);
    }

    const assetExists = coingeckoDataEntry.assets.some(a => a.chain_name === asset.chain_name && a.base_denom === asset.base_denom);
    if (!assetExists) {
      coingeckoDataEntry.assets.push(asset);
    }
  }

  await saveCoingeckoState(coingeckoState);
}

function getAssetPointers() {
  const networkType = "mainnet";
  let assetPointers = chain_reg.getAssetPointersByNetworkType(networkType);
  return assetPointers;
}

(async function main() {
  //await fetchCoingeckoData();
  //console.log(await loadCoingeckoState());
  await processAssets(/*assetPointers*/);
})();


if (process.argv.length > 2) {
  const command = process.argv[2];
  if (command === 'removeInvalidCoingeckoIds') {
    removeInvalidCoingeckoIds();
  } else {
    console.log(`Unknown command: ${command}`);
  }
} else {
  main();
}
