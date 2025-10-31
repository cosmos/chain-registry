import fs from 'fs/promises';

import * as chain_reg from './chain_registry.mjs';

const COINGECKO_JSON_PATH = '../../state/coingecko.json';

const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/';
export const coingeckoEndpoints = {
  coins_list: { name: "coins_list", path: 'v3/coins/list' },
};

export const traceTypesCoingeckoId = [
  "ibc",
  "ibc-cw20",
  "additional-mintage",
  "test-mintage",
  "legacy-mintage"
];

export const api_response = {};
export let state = {
  coingecko_id_groups: []
};



export async function fetchCoingeckoData(endpoint = coingeckoEndpoints.coins_list) {
  if (!Object.values(coingeckoEndpoints).includes(endpoint)) {
    console.error(`Invalid Coingecko Endpoint: ${JSON.stringify(endpoint)}`);
    return;
  }
  console.log("fetching CoinGecko data...");
  const coingeckoApiUrl = `${COINGECKO_API_BASE_URL}${endpoint.path}`;
  try {
    const response = await fetch(coingeckoApiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    api_response[endpoint.name] = await response.json();
  } catch (error) {
    console.error('Error fetching Coingecko data:', error);
  }
}

export async function loadCoingeckoState() {
  try {
    const data = await fs.readFile(COINGECKO_JSON_PATH, 'utf8');
    state = JSON.parse(data);
    return;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { coingecko_data: [] }; // Return empty structure if file doesn't exist
    }
    throw error;
  }
}

export async function saveCoingeckoState() {
  try {
    await fs.writeFile(COINGECKO_JSON_PATH, JSON.stringify(state, null, 2));
    console.log(`Successfully saved Coingecko state to ${COINGECKO_JSON_PATH}`);
  } catch (error) {
    console.error(`Failed to save Coingecko state:`, error);
  }
}

export function createCoingeckoIdGroup(coingeckoId, chainName, baseDenom) {
  let coingeckoIdGroup = {
    coingecko_id: coingeckoId,
    assets: []
  };
  coingeckoIdGroup.assets.push({ chain_name: chainName, base_denom: baseDenom });
  return coingeckoIdGroup;
}

export function addAssetToCoingeckoIdGroup(coingeckoEntry, chainName, baseDenom) {
  // Check if the asset already exists in the assets array
  const assetExists = coingeckoEntry.assets.some(
    asset => asset.chainName === chainName && asset.baseDenom === baseDenom
  );

  // If the asset is not found, add it to the array
  if (!assetExists) {
    coingeckoEntry.assets.push({ chain_name: chainName, base_denom: baseDenom });
  }
}

export function getCoingeckoIdGroupOriginAsset(coingecko_id_group) {
  
  const originAssets = [];
  const mainnetOriginAssets = [];  

  for (const asset of coingecko_id_group.assets) {
    const originAsset = chain_reg.getOriginAsset(
      asset.chain_name,
      asset.base_denom,
      traceTypesCoingeckoId
    );

    // Ensure unique origin assets
    if (!originAssets.some(a => a.chain_name === originAsset.chain_name && a.base_denom === originAsset.base_denom)) {
      originAssets.push(originAsset);

      // Check if it's a mainnet asset immediately
      if (chain_reg.getChainMetadata(originAsset.chain_name, "network_type") === "mainnet") {
        mainnetOriginAssets.push(originAsset);
        /*
        console.log("coingecko_id_group");
        console.log(coingecko_id_group);
        console.log("Assets:");
        console.log(coingecko_id_group.assets);
        console.log(`Asset: `)
        console.log(asset);
        console.log(`Origin Asset: `)
        console.log(originAsset);
        */
      }
    }
  }

  if (mainnetOriginAssets.length > 1) {
    console.warn(`More than 1 mainnet origin asset for ${coingecko_id_group.coingecko_id}, which shouldn't be possible:`);
    console.log(mainnetOriginAssets);
    return; // Exit early if this condition is met
  }

  if (mainnetOriginAssets.length === 1) {
    return mainnetOriginAssets[0];
  } else {
    console.warn(`There are no mainnet origin assets for ${coingecko_id_group.coingecko_id}.`);
    return originAssets[0] || null; // Handle empty `originAssets` case
  }
}

export function getCoingeckoIdGroupFromState(coingeckoId) {
  return state?.coingecko_id_groups?.find(group => group.coingecko_id === coingeckoId);
}

function main() {
  return;
}

