import * as coingecko from './coingecko_data.mjs';
import * as chain_reg from './chain_registry.mjs';

let coingecko_data = coingecko.coingecko_data;

function getAssetPointers(networkType = "mainnet") {
  let assetPointers = chain_reg.getAssetPointersByNetworkType(networkType);
  return assetPointers;
}

async function removeInvalidCoingeckoIds() {

  await coingecko.fetchCoingeckoData();
  const validCoingeckoIds = new Set(coingecko_data?.api_response.map(entry => entry.id));

  const assetPointers = getAssetPointers();
  for (const asset of assetPointers) {
    const coingecko_id = chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id");
    if (coingecko_id === "" || (coingecko_id && !validCoingeckoIds.has(coingecko_id))) {
      console.log(`Removing invalid Coingecko ID: ${coingecko_id} from ${asset.chain_name} ${asset.base_denom}`);
      chain_reg.setAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id", "");
    }
  }
}

async function generateCoingeckoStateFile() {

  const coingeckoState = {};//await loadCoingeckoState();//  Use this for validation
  coingeckoState.coingecko_data = [];

  await coingecko.fetchCoingeckoData();
  if (!coingecko_data?.api_response) {
    console.log("No CoinGecko API Response");
    return;
  }

  const assetPointers = getAssetPointers();
  for (const asset of assetPointers) {
    const coingecko_id = chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id");
    if (!coingecko_id) { continue; }

    const coingeckoEntry = coingecko_data?.api_response?.find(entry => entry.id === coingecko_id);
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

    let coingeckoDataEntry = coingecko_data?.state?.coingecko_data?.find(entry => entry.coingecko_id === coingecko_id);
    if (!coingeckoDataEntry) {
      coingeckoDataEntry = {
        coingecko_id,
        //_comment: `${coingeckoEntry.name} $${coingeckoEntry.symbol.toUpperCase()}`,
        _comment: `${chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "name")} $${chain_reg.getAssetProperty(asset.chain_name, asset.base_denom, "symbol")}`,
        assets: []
      };
      coingecko_data?.state?.coingecko_data?.push(coingeckoDataEntry);
    }

    const assetExists = coingeckoDataEntry.assets.some(a => a.chain_name === asset.chain_name && a.base_denom === asset.base_denom);
    if (!assetExists) {
      coingeckoDataEntry.assets.push(asset);
    }
  }

  await coingecko.saveCoingeckoState(coingecko_data?.state);
}

function main() {
  return;
}

if (process.argv.length > 2) {
  chain_reg.setup("../../..");
  const command = process.argv[2];
  if (command === 'generateCoingeckoStateFile') {
    generateCoingeckoStateFile();
  } else if (command === 'removeInvalidCoingeckoIds') {
    removeInvalidCoingeckoIds();
  } else {
    console.log(`Unknown command: ${command}`);
  }
} else {
  main();
}