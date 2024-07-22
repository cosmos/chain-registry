// Purpose:
//   to provide chain registry lookup functionality to other programs


// -- IMPORTS --

import * as fs from 'fs';
import * as path from 'path';

// -- VARIABLES --

export let chainNameToDirectoryMap = new Map();

export const chainRegistryRoot = "../../../chain-registry";

const networkTypeToDirectoryNameMap = new Map();
networkTypeToDirectoryNameMap.set("mainnet", "");
networkTypeToDirectoryNameMap.set("testnet", "testnets");
const networkTypes = Array.from(networkTypeToDirectoryNameMap.keys());

const domainToDirectoryNameMap = new Map();
domainToDirectoryNameMap.set("cosmos", "");
domainToDirectoryNameMap.set("non-cosmos", "_non-cosmos");
const domains = Array.from(domainToDirectoryNameMap.keys());

const fileToFileNameMap = new Map();
fileToFileNameMap.set("chain", "chain.json");
fileToFileNameMap.set("assetlist", "assetlist.json");
const files = Array.from(domainToDirectoryNameMap.keys());

export const nonChainDirectories = [
  ".git",
  ".github",
  ".vs",
  "_IBC",
  "_memo_keys",
  "_non-cosmos",
  "_template",
  "_scripts",
  "testnets",
  ".gitignore",
  "assetlist.schema.json",
  "chain.schema.json",
  "ibc_data.schema.json",
  "memo_keys.schema.json",
  "versions.schema.json",
  "README.md",
  "LICENSE",
  "package.json"
]

export const assetSchema = {
  description: "string",
  denom_units: [],
  type_asset: "string",
  address: "string",
  base: "string",
  name: "string",
  display: "string",
  symbol: "string",
  traces: [],
  logo_URIs: {
    png: "string",
    svg: "string"
  },
  coingecko_id: "string",
  keywords: []
}

export const bech32ConfigSuffixMap = new Map([
  ["bech32PrefixAccAddr", ""],
  ["bech32PrefixAccPub", "pub"],
  ["bech32PrefixValAddr", "valoper"],
  ["bech32PrefixValPub", "valoperpub"],
  ["bech32PrefixConsAddr", "valcons"],
  ["bech32PrefixConsPub", "valconspub"]
]);


const networkTypeToDirectoryMap = new Map();
networkTypeToDirectoryMap.set("mainnet", "");
networkTypeToDirectoryMap.set("testnet", "testnets");
for (const [networkType, directory] of networkTypeToDirectoryMap.entries()) {
  networkTypeToDirectoryMap.set(networkType, path.join(chainRegistryRoot, directory));
}

const fileNames = {
  chain: "chain.json",
  assetlist: "assetlist.json",
};

let paths = {};
let chains = [];
export const chain__FileName = "chain.json";
export const assetlist__FileName = "assetlist.json";

export let debug = 1;


export let allChains = "";

// -- GENERAL UTILITY FUNCTIONS --

export function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch (err) {
    console.log(err);
  }
}

export function writeJsonFile(file, object) {
  try {
    fs.writeFileSync((file), JSON.stringify(object,null,2), (err) => {
      if (err) throw err;
    });
  } catch (err) {
    console.log(err);
  }
}

export function getDirectoryContents(directory) {
  let array = [];
  try {
    array = fs.readdirSync(directory, (err, list) => {
      if (err) throw err;
      return list;
    });
  } catch (err) {
    console.log(err);
  }
  return array;
}

export function setDifferenceArray(a, b) {
  let c = [];
  a.forEach((item) => {
    if(!b.includes(item)) {
      c.push(item);
    }
  });
  return c;
}


export async function calculateIbcHash(ibcHashInput) {
  const textAsBuffer = new TextEncoder().encode(ibcHashInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const digest = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const ibcHashOutput = "ibc/" + digest.toUpperCase();
  return ibcHashOutput;
}


// -- CHAIN REGISTRY MODULES --


export function populateChainDirectories() {
  for (let [networkType, networkTypeDirectoryName] of networkTypeToDirectoryNameMap) {
    for (let [domain, domainDirectoryName] of domainToDirectoryNameMap) {
      chains = setDifferenceArray(
        getDirectoryContents(path.join(chainRegistryRoot, networkTypeDirectoryName, domainDirectoryName)),
        nonChainDirectories
      );
      chains.forEach((chainName) => {
        chainNameToDirectoryMap.set(
          chainName,
          path.join(chainRegistryRoot, networkTypeDirectoryName, domainDirectoryName, chainName)
        );
      });
    }
  }
}

export function getFileProperty(chainName, file, property) {
  const chainDirectory = chainNameToDirectoryMap.get(chainName);
  if(chainDirectory) {
    const filePath = path.join(chainDirectory,fileToFileNameMap.get(file));
    const FILE_EXISTS = fs.existsSync(filePath);
    if(FILE_EXISTS) {
      return readJsonFile(filePath)[property];
    }
  }
}

export function setFileProperty(chainName, file, property, value) {
  const chainDirectory = chainNameToDirectoryMap.get(chainName);
  if(chainDirectory) {
    const filePath = path.join(chainDirectory,fileToFileNameMap.get(file));
    const FILE_EXISTS = fs.existsSync(filePath);
    if(FILE_EXISTS) {
      let json = readJsonFile(filePath);
      json[property] = value;
      writeJsonFile(filePath, json);
      return;
    }
  }
}

export function getIBCFileProperty(chainName1, chainName2, property) {
  const chain1Directory = chainNameToDirectoryMap.get(chainName1);
  const chain2Directory = chainNameToDirectoryMap.get(chainName2);
  if(chain1Directory && chain2Directory) {
    if(path.join(chain1Directory, "..") == path.join(chain2Directory, "..")) {
      const ibcDirectory = path.join(chain1Directory, "..", "_IBC");
      let list = [chainName1, chainName2];
      list = list.sort();
      const fileName = list[0] + '-' + list[1] + '.json';
      const filePath = path.join(ibcDirectory, fileName);
      const FILE_EXISTS = fs.existsSync(filePath);
      if(FILE_EXISTS) {
        return readJsonFile(filePath)[property];
      }
    }
  }
}

export function getAssetProperty(chainName, baseDenom, property) {
  const assets = getFileProperty(chainName, "assetlist", "assets");
  if(assets) {
    let selectedAsset;
    assets.forEach((asset) => {
      if(asset.base == baseDenom) {
        selectedAsset = asset;
        return;
      }
    });
    if(selectedAsset) {
      return selectedAsset[property];
    }
  }
}


export function getAssetDecimals(chainName, baseDenom) {
  let decimals;
  let display = getAssetProperty(chainName, baseDenom, "display");
  let denom_units = getAssetProperty(chainName, baseDenom, "denom_units");
  denom_units?.forEach((denom_unit) => {
    if(
      denom_unit.denom == display ||
      denom_unit.aliases?.includes(display)
    ) {
      decimals = denom_unit.exponent;
      return;
    }
  });
  return decimals;
}


export function getAssetObject(chainName, baseDenom) {
  const assets = getFileProperty(chainName, "assetlist", "assets");
  if(assets) {
    let selectedAsset;
    assets.forEach((asset) => {
      if(asset.base == baseDenom) {
        selectedAsset = asset;
        return;
      }
    });
    if(selectedAsset) {
      return selectedAsset;
    }
  }
}


export function setAssetProperty(chainName, baseDenom, property, value) {
  const assets = getFileProperty(chainName, "assetlist", "assets");
  if(assets) {
    assets.forEach((asset) => {
      if(asset.base == baseDenom) {
        asset[property] = value;
        setFileProperty(chainName, "assetlist", "assets", assets);
        return;
      }
    });
  }
}

export function getAssetPropertyWithTrace(chainName, baseDenom, property) {
  let value = getAssetProperty(chainName, baseDenom, property);
  if (!value) {
    if (property != "traces") {
      let traces = getAssetProperty(chainName, baseDenom, "traces");
      if (traces) {
        let originAsset = {
          chainName: traces[traces.length - 1].counterparty.chain_name,
          baseDenom: traces[traces.length - 1].counterparty.base_denom
        }
        return getAssetPropertyWithTrace(originAsset.chainName, originAsset.baseDenom, property);
      }
    }
  }
  return value;
}

export function getAssetPropertyWithTraceCustom(chainName, baseDenom, property, types) {
  let value = getAssetProperty(chainName, baseDenom, property);
  if (value) { return value; }
  if (property === "traces") { return; }
  let traces = getAssetProperty(chainName, baseDenom, "traces");
  if (!traces) { return; }
  if (!types.includes(traces[traces.length - 1].type)) { return; }
  let originAsset = {
    chainName: traces[traces.length - 1].counterparty.chain_name,
    baseDenom: traces[traces.length - 1].counterparty.base_denom
  }
  return getAssetPropertyWithTraceCustom(originAsset.chainName, originAsset.baseDenom, property, types);
}

export function getAssetPropertyWithTraceIBC(chainName, baseDenom, property) {
  let value = getAssetProperty(chainName, baseDenom, property);
  if (!value) {
    if (property != "traces") {
      let traces = getAssetProperty(chainName, baseDenom, "traces");
      if (traces && (traces[traces.length - 1].type == "ibc" || traces[traces.length - 1].type == "ibc-cw20")) {
        let originAsset = {
          chainName: traces[traces.length - 1].counterparty.chain_name,
          baseDenom: traces[traces.length - 1].counterparty.base_denom
        }
        return getAssetPropertyWithTrace(originAsset.chainName, originAsset.baseDenom, property);
      }
    }
  }
  return value;
}

export function getAssetTraces(chainName, baseDenom) {
  let traces = getAssetProperty(chainName, baseDenom, "traces");
  let fullTrace;
  if (traces) {
    fullTrace = [];
    fullTrace.push(traces[traces.length - 1]);
    let originAsset = {
      chainName: traces[traces.length - 1].counterparty.chain_name,
      baseDenom: traces[traces.length - 1].counterparty.base_denom
    }
    let previousTraces = getAssetTraces(originAsset.chainName, originAsset.baseDenom);
    if (previousTraces) {
      fullTrace = previousTraces.concat(fullTrace);
    }
  }
  return fullTrace;
}

export function getAssetPointersByChain(chainName) {
  let assetPointers = [];
  const assets = getFileProperty(chainName, "assetlist", "assets");
  if(assets) {
    assets.forEach((asset) => {
      if(asset.base) {
        assetPointers.push({
          chain_name: chainName,
          base_denom: asset.base
        });
      }
    });
  }
  return assetPointers;
}

export function getAssetPointersByNetworkType(networkType) {
  let assetPointers = [];
  const assets = getFileProperty(chainName, "assetlist", "assets");
  if(assets) {
    assets.forEach((asset) => {
      if(asset.base) {
        assetPointers.push({
          chain_name: chainName,
          base_denom: asset.base
        });
      }
    });
  }
  return assetPointers;
}

export function getAssetPointers() {
  let assetPointers = [];
  Array.from(chainNameToDirectoryMap.keys()).forEach((chainName) => {
    assetPointers = assetPointers.concat(getAssetPointersByChain(chainName));
  });
  return assetPointers;
}

export function getChains() {
  chains = Array.from(chainNameToDirectoryMap.keys());
  return chains;
}

export function filterChainsByFileProperty(chains, file, property, value) {
  let filtered = [];
  chains.forEach((chain) => {
    let propertyValue = getFileProperty(chain, file, property);
    if(value == "*") {
      if(propertyValue && propertyValue != "") {
        filtered.push(pointer);
      }
    } else {
      if(propertyValue == value) {
        filtered.push(pointer);
      }
    }
  });
  return filtered;
}

export function filterAssetPointersByFileProperty(pointers, file, property, value) {
  let filtered = [];
  pointers.forEach((pointer) => {
    let propertyValue = getFileProperty(pointer.chain_name, file, property);
    if(value == "*") {
      if(propertyValue && propertyValue != "") {
        filtered.push(pointer);
      }
    } else {
      if(propertyValue == value) {
        filtered.push(pointer);
      }
    }
  });
  return filtered;
}

export function filterAssetPointersByAssetProperty(pointers, property, value) {
  let filtered = [];
  pointers.forEach((pointer) => {
    let propertyValue = getAssetProperty(pointer.chain_name, pointer.base_denom, property);
    if(value == "*") {
      if(propertyValue && propertyValue != "") {
        filtered.push(pointer);
      }
    } else {
      if(propertyValue == value) {
        filtered.push(pointer);
      }
    }
  });
  return filtered;
}

function main() {
  populateChainDirectories();
}

main();
