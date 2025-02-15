import fs from 'fs/promises';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/list';
const COINGECKO_JSON_PATH = './state/coingecko.json';

export const traceTypesCoingeckoId = [
  "ibc",
  "ibc-cw20",
  "additional-mintage",
  "test-mintage"
];

export const coingecko_data = {
  api_response: null,
  state: {
    coingecko_data: []
  }
}
export let coingecko_api_response = {};

export async function fetchCoingeckoData() {
  console.log("fetching CoinGecko data...");
  try {
    const response = await fetch(COINGECKO_API_URL);
    coingecko_data.api_response = await response.json();
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

export async function saveCoingeckoState(data) {
  await fs.writeFile(COINGECKO_JSON_PATH, JSON.stringify(data, null, 2));
}

export function createCoingeckoEntry(coingeckoId, chainName, baseDenom) {
  let coingeckoEntry = {
    coingecko_id: coingeckoId,
    assets: []
  };
  coingeckoEntry.assets.push({ chain_name: chainName, base_denom: baseDenom });
  return coingeckoEntry;
}

export function addAssetToCoingeckoEntry(coingeckoEntry, chainName, baseDenom) {
  // Check if the asset already exists in the assets array
  const assetExists = coingeckoEntry.assets.some(
    asset => asset.chainName === chainName && asset.baseDenom === baseDenom
  );

  // If the asset is not found, add it to the array
  if (!assetExists) {
    coingeckoEntry.assets.push({ chain_name: chainName, base_denom: baseDenom });
  }
}

export function getCoingeckoEntryFromState(coingeckoId, state) {
  return state?.coingecko_data?.find(entry => entry.coingecko_id === coingeckoId);
}

function main() {
  return;
}

