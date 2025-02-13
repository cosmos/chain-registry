import fs from 'fs/promises';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/list';
const COINGECKO_JSON_PATH = './state/coingecko.json';

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

function main() {
  return;
}

