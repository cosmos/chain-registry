// Purpose:
//   to provide chain registry lookup functionality to other programs


// -- IMPORTS --

import * as fs from 'fs';
import * as path from 'path';

// -- VARIABLES --

export let chainNameToDirectoryMap = new Map();

export let chainRegistryRoot = "../../../chain-registry"; //default assumption is submodule

export const networkTypeToDirectoryNameMap = new Map();
networkTypeToDirectoryNameMap.set("mainnet", "");
networkTypeToDirectoryNameMap.set("testnet", "testnets");
networkTypeToDirectoryNameMap.set("devnet", "testnets");
const networkTypes = Array.from(networkTypeToDirectoryNameMap.keys());

export const domainToDirectoryNameMap = new Map();
domainToDirectoryNameMap.set("cosmos", "");
domainToDirectoryNameMap.set("non-cosmos", "_non-cosmos");
const domains = Array.from(domainToDirectoryNameMap.keys());

export const fileToFileNameMap = new Map();
fileToFileNameMap.set("chain", "chain.json");
fileToFileNameMap.set("assetlist", "assetlist.json");
fileToFileNameMap.set("versions", "versions.json");
export const files = Array.from(fileToFileNameMap.keys());

export const traceTypesIbc = [
  "ibc",
  "ibc-cw20"
];

export const traceTypesAll = [
  "ibc",
  "ibc-cw20",
  "ibc-bridge",
  "bridge",
  "liquid-stake",
  "synthetic",
  "wrapped",
  "additional-mintage",
  "test-mintage",
  "legacy-mintage"
];

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
  "package.json",
  "package-lock.json",
  "eslint.config.mjs",
  "primary_colors.py"
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

export const schemas = new Map([
  ["ibc", "ibc_data.schema.json"],
  ["chain", "chain.schema.json"],
  ["assetlist", "assetlist.schema.json"],
  ["versions", "versions.schema.json"],
]);

export const bech32ConfigSuffixMap = new Map([
  ["bech32PrefixAccAddr", ""],
  ["bech32PrefixAccPub", "pub"],
  ["bech32PrefixValAddr", "valoper"],
  ["bech32PrefixValPub", "valoperpub"],
  ["bech32PrefixConsAddr", "valcons"],
  ["bech32PrefixConsPub", "valconspub"]
]);


export const networkTypeToDirectoryMap = new Map();
networkTypeToDirectoryMap.set("mainnet", "");
networkTypeToDirectoryMap.set("testnet", "testnets");


const fileNames = {
  chain: "chain.json",
  assetlist: "assetlist.json"
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
    console.log(file);
    console.log(err);
  }
}

export function writeJsonFile(file, object) {

  try {
    fs.writeFileSync(file, JSON.stringify(object, null, 2));//, (err)) => {
      //if (err) throw err;
    //});
  } catch (err) {
    console.log("Failed to write file:", file, err);
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
    //console.log(err);
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

function isChainDirectory(directory) {
  if (!fs.statSync(directory).isDirectory()) return false;
  const CHAIN_FILE_EXISTS = fs.existsSync(path.join(directory, fileToFileNameMap.get("chain")));
  const ASSETLIST_FILE_EXISTS = fs.existsSync(path.join(directory, fileToFileNameMap.get("assetlist")));
  return CHAIN_FILE_EXISTS || ASSETLIST_FILE_EXISTS;
}


export function populateChainDirectories() {
  for (let [networkType, networkTypeDirectoryName] of networkTypeToDirectoryNameMap) {
    for (let [domain, domainDirectoryName] of domainToDirectoryNameMap) {
      chains = setDifferenceArray(
        getDirectoryContents(path.join(chainRegistryRoot, networkTypeDirectoryName, domainDirectoryName)),
        nonChainDirectories
      );
      chains = chains.filter(directoryName =>
        isChainDirectory(path.join(chainRegistryRoot, networkTypeDirectoryName, domainDirectoryName, directoryName))
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

function getFileSchema(chainName, file) {
  let schema = schemas.get(file);
  schema = "../" + schema;
  if (getFileProperty(chainName, "chain", "network_type") === "testnet") {
    schema = "../" + schema;
  }
  if (getFileProperty(chainName, "chain", "chain_type") !== "cosmos") {
    schema = "../" + schema;
  }
  return schema;
}

export function setFileProperty(chainName, file, property, value) {
  const chainDirectory = chainNameToDirectoryMap.get(chainName);
  if(chainDirectory) {
    const filePath = path.join(chainDirectory,fileToFileNameMap.get(file));
    const FILE_EXISTS = fs.existsSync(filePath);
    let json = {};
    if (FILE_EXISTS) {
      json = readJsonFile(filePath);
    } else {
      json.$schema = getFileSchema(chainName, file);
      json.chain_name = chainName;
    }
    json[property] = value;
    writeJsonFile(filePath, json);

  }
}

export function getIBCFileProperty(chainName1, chainName2, property) {
  const chain1Directory = chainNameToDirectoryMap.get(chainName1);
  const chain2Directory = chainNameToDirectoryMap.get(chainName2);
  if (!chain1Directory || !chain2Directory) {
    return; // One or both chains are missing from the directory map
  }


  // Check which directory has the _IBC folder
  let ibcDirectory;
  if (fs.existsSync(path.join(chain1Directory, "..", "_IBC"))) {
    ibcDirectory = path.join(chain1Directory, "..", "_IBC");
  } else if (fs.existsSync(path.join(chain2Directory, "..", "_IBC"))) {
    ibcDirectory = path.join(chain2Directory, "..", "_IBC");
  } else if (fs.existsSync(path.join(chainRegistryRoot, "_IBC"))) {
    ibcDirectory = path.join(chainRegistryRoot, "_IBC");
  } else if (fs.existsSync(path.join(chainRegistryRoot, "testnets", "_IBC"))) {
    ibcDirectory = path.join(chainRegistryRoot, "testnets", "_IBC");
  } else {
    console.log("No _IBC directory found!");
    return; // No _IBC directory found
  }

  // Ensure file ordering is consistent
  let list = [chainName1, chainName2].sort();
  const fileName = `${list[0]}-${list[1]}.json`;
  const filePath = path.join(ibcDirectory, fileName);

  if (fs.existsSync(filePath)) {
    return readJsonFile(filePath)[property];
  }

}

export function setIBCFileProperty(chainName1, chainName2, property, value) {
  const chain1Directory = chainNameToDirectoryMap.get(chainName1);
  const chain2Directory = chainNameToDirectoryMap.get(chainName2);
  if (!chain1Directory || !chain2Directory) {
    return; // One or both chains are missing from the directory map
  }


  // Check which directory has the _IBC folder
  let ibcDirectory;
  if (fs.existsSync(path.join(chain1Directory, "..", "_IBC"))) {
    ibcDirectory = path.join(chain1Directory, "..", "_IBC");
  } else if (fs.existsSync(path.join(chain2Directory, "..", "_IBC"))) {
    ibcDirectory = path.join(chain2Directory, "..", "_IBC");
  } else if (fs.existsSync(path.join(chainRegistryRoot, "_IBC"))) {
    ibcDirectory = path.join(chainRegistryRoot, "_IBC");
  } else if (fs.existsSync(path.join(chainRegistryRoot, "testnets", "_IBC"))) {
    ibcDirectory = path.join(chainRegistryRoot, "testnets", "_IBC");
  } else {
    console.log("No _IBC directory found!");
    return; // No _IBC directory found
  }

  // Ensure file ordering is consistent
  let list = [chainName1, chainName2].sort();
  const fileName = `${list[0]}-${list[1]}.json`;
  const filePath = path.join(ibcDirectory, fileName);

  let jsonFile;
  if (fs.existsSync(filePath)) {
    jsonFile = readJsonFile(filePath);
    jsonFile[property] = value;
    writeJsonFile(filePath, jsonFile);
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
        if (value === "") {
          delete asset[property]; // Remove the property if value is an empty string
        } else {
          asset[property] = value; // Otherwise, set the property to the value
        }
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

export function getDerivedChainMetadata(chainName, property) {

  if (property === "network_type") {
    if (chainName.includes("testnet")) {
      return "testnet";
    } else if (chainName.includes("devnet")) {
      return "devnet";
    } else {
      return "mainnet";
    }
  }
  return undefined; // Explicitly return undefined if the property isn't handled
}

export function getChainMetadata(chainName, property) {

  const value = getFileProperty(chainName, "chain", property);
  if (value) {
    return value;
  }

  return getDerivedChainMetadata(chainName, property);

}

export function getAssetMetadata(chainName, baseDenom, property, traceTypes = traceTypesAll) {

  const TRACES_PROPERTY_NAME = "traces";

  const assets = getFileProperty(chainName, "assetlist", "assets");
  if (!assets) { return; }
  let selectedAsset;
  for (const asset of assets) {
    if (asset.base === baseDenom) {
      selectedAsset = asset;
      break;
    }
  }
  if (!selectedAsset) { return; }

  let value = selectedAsset[property];

  if (property !== TRACES_PROPERTY_NAME && value) {
    return value;
  }

  const traces = selectedAsset.traces;
  if (!traces || traces.length === 0) {
    return value;
  }

  const lastTrace = traces[traces.length - 1];
  if (!traceTypes.includes(lastTrace.type)) {
    if (property !== TRACES_PROPERTY_NAME) {
      return value;
    } else {
      return [];
    }
  }

  const previousAsset = {
    chainName: lastTrace.counterparty.chain_name,
    baseDenom: lastTrace.counterparty.base_denom
  }

  if (property !== TRACES_PROPERTY_NAME) {
    return getAssetMetadata(previousAsset.chainName, previousAsset.baseDenom, property, traceTypes);
  }

  let fullTraces = [];
  fullTraces.push(lastTrace);
  let previousTraces = getAssetMetadata(
    previousAsset.chainName,
    previousAsset.baseDenom,
    TRACES_PROPERTY_NAME,
    traceTypes
  );
  if (previousTraces) {
    fullTraces = previousTraces.concat(fullTraces);
  }
  return fullTraces;

}

export function getAssetPropertyFromOriginWithTraceCustom(chainName, baseDenom, property, types) {
  if (property === "traces") { return; }
  let traces = getAssetProperty(chainName, baseDenom, "traces");
  if (!traces) { return getAssetProperty(chainName, baseDenom, property); }
  if (!types.includes(traces[traces.length - 1].type)) {
    return getAssetProperty(chainName, baseDenom, property);
  }
  let originAsset = {
    chainName: traces[traces.length - 1].counterparty.chain_name,
    baseDenom: traces[traces.length - 1].counterparty.base_denom
  }
  return getAssetPropertyFromOriginWithTraceCustom(originAsset.chainName, originAsset.baseDenom, property, types);
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

export function getOriginAsset(chainName, baseDenom, traceTypes = traceTypesAll) {

  const traces = getAssetMetadata(chainName, baseDenom, "traces", traceTypes) || [];
  const firstTrace = traces.length > 0 ? traces[0] : null;
  return {
    chain_name: firstTrace?.counterparty.chain_name || chainName,
    base_denom: firstTrace?.counterparty.base_denom || baseDenom
  };

}

export function getOriginAssetCustom(chainName, baseDenom, allowedTraceTypes) {
  let originAsset = {
    chainName: chainName,
    baseDenom: baseDenom
  }
  const traces = getAssetTraces(chainName, baseDenom);
  if (!traces) { return originAsset; }
  for (let i = traces.length - 1; i >= 0; --i) {
    if (allowedTraceTypes.includes(traces[i].type)) {
      originAsset.chainName = traces[i].counterparty.chain_name;
      originAsset.baseDenom = traces[i].counterparty.base_denom;
    } else {
      break;
    }
  };
  return originAsset;
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
  for (const chainName of chainNameToDirectoryMap.keys()) {
    const chainNetworkType = getFileProperty(chainName, "chain", "network_type");
    if (chainNetworkType === networkType) {
      assetPointers = assetPointers.concat(getAssetPointersByChain(chainName));
    }
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

export function setup(root = chainRegistryRoot) {
  chainRegistryRoot = root;

  for (const [networkType, directory] of networkTypeToDirectoryMap.entries()) {
    networkTypeToDirectoryMap.set(networkType, path.join(chainRegistryRoot, directory));
  }

  populateChainDirectories();
}

function main() {
  setup();
}