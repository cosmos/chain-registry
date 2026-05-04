import * as coingecko from './coingecko_data.mjs';
import * as chain_reg from './chain_registry.mjs';

function getAssetPointers(networkType = "mainnet") {
  //let assetPointers = chain_reg.getAssetPointersByNetworkType(networkType);
  let assetPointers = chain_reg.getAssetPointers();
  return assetPointers;
}

async function removeInvalidCoingeckoIds() {

  await coingecko.fetchCoingeckoData(coingecko.coingeckoEndpoints.coins_list);
  const validCoingeckoIds = new Set(coingecko.api_response?.[coingecko.coingeckoEndpoints.coins_list.name]
    .map(coin => coin.id));

  const assetPointers = getAssetPointers();
  for (const asset of assetPointers) {
    const coingecko_id = chain_reg.getAssetMetadata(asset.chain_name, asset.base_denom, "coingecko_id", []);
    if (coingecko_id === "" || (coingecko_id && !validCoingeckoIds.has(coingecko_id))) {
      console.log(`Removing invalid Coingecko ID: ${coingecko_id} from ${asset.chain_name} ${asset.base_denom}`);
      chain_reg.setAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id", "");
    }
  }
  console.log("Finished removing invalid Coingecko IDs");
}

async function generateCoingeckoStateFile() {

  await coingecko.fetchCoingeckoData(coingecko.coingeckoEndpoints.coins_list);
  const endpointName = coingecko.coingeckoEndpoints.coins_list.name;
  if (!coingecko.api_response[endpointName]) {
    console.log("No CoinGecko API Response");
    return;
  }

  const assetPointers = getAssetPointers();
  for (const asset of assetPointers) {
    const coingecko_id = chain_reg.getAssetMetadata(asset.chain_name, asset.base_denom, "coingecko_id", []);
    if (!coingecko_id) { continue; }

    //const coingeckoEntry = coingecko_data?.api_response?.find(entry => entry.id === coingecko_id);
    const coin = coingecko.api_response?.[endpointName]?.find(coin => coin.id === coingecko_id);
    if (!coin) {
      console.log(`
Error: Missing Coingecko ID: ${coingecko_id} for asset`, asset);
      console.log(`
`);
      continue;
    }

    let coingecko_id_group = coingecko.state?.coingecko_id_groups?.find(group => group.coingecko_id === coingecko_id);
    if (!coingecko_id_group) {
      coingecko_id_group = {
        coingecko_id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        assets: []
      };
      coingecko.state?.coingecko_id_groups?.push(coingecko_id_group);
    }

    const assetExists = coingecko_id_group.assets.some(groupAsset => groupAsset.chain_name === asset.chain_name && groupAsset.base_denom === asset.base_denom);
    if (assetExists) { continue; }
    coingecko_id_group.assets.push(asset);

  }

  for (const coingecko_id_group of coingecko.state?.coingecko_id_groups) {

    const originAsset = coingecko.getCoingeckoIdGroupOriginAsset(coingecko_id_group);
    if (!originAsset) {
      continue;
    }
    coingecko_id_group.origin_asset = originAsset;
    const registryName = chain_reg.getAssetMetadata(originAsset.chain_name, originAsset.base_denom, "name");
    const registrySymbol = chain_reg.getAssetMetadata(originAsset.chain_name, originAsset.base_denom, "symbol");
    if (
      registryName !== coingecko_id_group.name
      &&
      registrySymbol?.toUpperCase() !== coingecko_id_group.symbol.toUpperCase()
    ) {
      console.warn(`Warning: Mismatch of both Name and Symbol for Coingecko ID ${coingecko_id_group.coingecko_id}. 
  -Registry: "${registryName} $${registrySymbol?.toUpperCase() }", 
  -Coingecko: "${coingecko_id_group.name} $${coingecko_id_group.symbol.toUpperCase()}"`);
    }

  }

  await coingecko.saveCoingeckoState();
}

async function addValidCoingeckoIds() { //run state update first

  await coingecko.loadCoingeckoState();

  if (!coingecko.state) { return; }


  let STATE_UPDATED = false;
  chain_reg.getAssetPointers().forEach((asset) => {

    //get the cgid origin
    const origin_asset = chain_reg.getOriginAsset(asset.chain_name, asset.base_denom, coingecko.traceTypesCoingeckoId);
    if (!origin_asset) {
      console.log("Cannot find origin asset.");
      return;
    }

    //get the coingecko id group
    const coingecko_id_group = coingecko.state.coingecko_id_groups?.find(a =>
      a.origin_asset?.chain_name === origin_asset.chain_name &&
      a.origin_asset?.base_denom === origin_asset.base_denom
    );
    if (!coingecko_id_group) { return; }

    //see if this asset is already in the state::coingecko_id_group::assets array
    if (!coingecko_id_group.assets) {
      coingecko_id_group.assets = [];
    }
    const assetExists = coingecko_id_group.assets.some(groupAsset =>
      groupAsset.chain_name === asset.chain_name &&
      groupAsset.base_denom === asset.base_denom
    );
    if (assetExists) { return; }

    //define old and new
    const new_cgid = coingecko_id_group.coingecko_id;
    const old_cgid = chain_reg.getAssetMetadata(asset.chain_name, asset.base_denom, "coingecko_id", []) ?? null;
    if (old_cgid === new_cgid) { return; }

    //update the coingecko id
    console.log(`Updated Coingecko ID for asset: ${asset.chain_name} / ${asset.base_denom}`);
    console.log(`Previous ID: ${old_cgid || "None"} -> New ID: ${new_cgid}`);
    chain_reg.setAssetProperty(asset.chain_name, asset.base_denom, "coingecko_id", coingecko_id_group.coingecko_id);
    //update the state
    coingecko_id_group.assets.push(asset);
    STATE_UPDATED = true;
    
  });

  if (STATE_UPDATED) {
    await coingecko.saveCoingeckoState();
  }
  
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
  } else if (command === 'addValidCoingeckoIds') {
    addValidCoingeckoIds();
  } else {
    console.log(`Unknown command: ${command}`);
  }
} else {
  main();
}