// Purpose:
//   to pull the version data from the chain.json file to the versions.json file,
//   chain.json will be seen as the signle source of truth--tooling and apps should look here for chain version data
//   verions.json will be an (optional) recording of version history
//   any discrepancies will use the chain.json's data


// -- THE PLAN --
//
//  Definitions:
//    - current version: is the version in the chain.json file
//    - compatible versions: two versions are compatible one's compatible versions array
//      shares any version number with the other's compatible versions array
//    - codebase-relevant data: data stored with a version object that also belongs in the chain::codebase object.
//      e.g., this includes, sdk version, language, binaries and some other data
//      e.g., but does not include thing like version name, block height, proposal, and some other data
//      (refer to the chain.json schema)
//
//  Step 1: record data from chain.json file (overrides versions.json)
//
// while we're iterating each chain...
//   only cosmos chains
//   look at chain.json::codebase{}
//   is there version data?
//     if not, then there's nothing to pull
//     if so,
//       look at verions.json. Does it exist?
//         if not (no versions.json), then create it (with a versions array)
//         if so,
//           does there exist a version compatible with the current version?
//             if not, create a new version object with the same compatible versions from the current
//             copy all version data from chain.json over to the version object
//         remember this (current) version object in the version history (carries to Step 2)
//       save changes to versions.json
//
//  By this point, all version data in the chain.json should be saved into the version history
//
//  Step 2: pull data from versions.json into chain.json (in case there's additional data there)
//
// within the same round of iterating each chain...
//   is there a current version in the version history?
//     if not, then there's nothing to pull
//     if so, pull all (codebase-relevant) data from the version object into chain.json
//       save changes to chain.json
//
//  Finish:
//   write changes to chain_reg
//

/*

USAGE:

node code.mjs
# -> runs all chains

node code.mjs osmosis
# -> runs single chain "osmosis"

*/
//
//

import * as chain_reg from './chain_registry.mjs';

const chainRegistryRoot = "../../..";

const COSMOS_CHAIN_TYPE = "cosmos";
const codebaseVersionProperties = [
  "recommended_version",
  "compatible_versions",
  "tag",
  "language",
  "binaries",
  "sdk",
  "consensus",
  "cosmwasm",
  "ibc"
];

function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== "object" ||
    obj1 === null ||
    typeof obj2 !== "object" ||
    obj2 === null
  ) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}


function combineAllCompatibleVersions(versionObject) {

  let UPDATED = false;
  if (!versionObject.recommended_version) return UPDATED;
  if (!versionObject.compatible_versions?.includes(versionObject.recommended_version)) {
    versionObject.compatible_versions ||= [];
    versionObject.compatible_versions.push(versionObject.recommended_version);
    versionObject.compatible_versions.sort();
    UPDATED = true;
  }
  return UPDATED;

}

function writeCodebaseVersionProperties(source, destination) {

  let UPDATED = false;

  //first set the name
  if (!source.name && !destination.name) {
    destination.name = "";
  }

  //then all the other properties
  for (const propertyName of codebaseVersionProperties) {
    if (source[propertyName] && !deepEqual(source[propertyName], destination[propertyName])) {
      destination[propertyName] = source[propertyName];
      UPDATED = true;
    }
  }

  //combine compatible_versions
  UPDATED = combineAllCompatibleVersions(destination) || UPDATED;

  return UPDATED;

}

function existsCompatibleVersionMatch(versionA, versionB) {

  if (!versionA.compatible_versions || !versionB.compatible_versions) return false;

  for (const versionA_version of versionA.compatible_versions) {
    for (const versionB_version of versionB.compatible_versions) {
      if (versionA_version === versionB_version) {
        return true;
      }
    }
  }

}

function updateVersionDataForChain(chain) {

  //   look at chain.json::codebase{}
  let codebase = chain_reg.getFileProperty(chain, "chain", "codebase");
  if (!codebase) return;

  //   is there version data?
  let VERSION_DATA_EXISTS = false;
  for (const propertyName of codebaseVersionProperties) {
    if (codebase[propertyName]) {
      VERSION_DATA_EXISTS = true;
      break;
    } 
  }
  //     if not, then there's nothing to pull
  if (!VERSION_DATA_EXISTS) return;

  let currentVersion = {};
  writeCodebaseVersionProperties(codebase, currentVersion);

  // make sure there are version numbers
  if (!currentVersion.compatible_versions) return;

  //     if so,
  //       look at verions.json. Does it exist?
  //         if not (no versions.json), then create it (with a versions array)
  let versions = chain_reg.getFileProperty(chain, "versions", "versions") || [];
  let VERSIONS_UPDATED = false;

  //         if so,
  //           does there exist a version compatible with the current version?
  let compatibleVersion = versions.find(version => {
    combineAllCompatibleVersions(version);
    if (existsCompatibleVersionMatch(version, currentVersion)) return version;
  });

  //             if not, create a new version object with the same compatible versions from the current
  //             copy all version data from chain.json over to the version object
  if (!compatibleVersion) {
    currentVersion.name = currentVersion.compatible_versions[0];
    versions.push(currentVersion);
    VERSIONS_UPDATED = true;
  } else {
    VERSIONS_UPDATED = writeCodebaseVersionProperties(currentVersion, compatibleVersion);
  }

  //         remember this (current) version object in the version history (carries to Step 2)
  //       save changes to versions.json
  if (VERSIONS_UPDATED) {
    chain_reg.setFileProperty(chain, "versions", "versions", versions);
    console.log(`Versions Updated for ${chain}`);
  }

  // within the same round of iterating each chain...
  //   is there a current version in the version history?
  //     if not, then there's nothing to pull
  if (!compatibleVersion) return;
  //     if so, pull all (codebase-relevant) data from the version object into chain.json
  let CODEBASE_UPDATED = false;
  CODEBASE_UPDATED = writeCodebaseVersionProperties(compatibleVersion, codebase);

  //       save changes to chain.json
  if (CODEBASE_UPDATED) {
    chain_reg.setFileProperty(chain, "chain", "codebase", codebase);
    console.log(`Codebase Updated for ${chain}`);
  }
    
}

async function updateVersionDataForChains() {

  // while we're iterating each chain...
  let chains = chain_reg.getChains();
  //   only cosmos chains
  chains.filter(chain => { return chain_reg.getFileProperty(chain, "chain", "chain_type") === COSMOS_CHAIN_TYPE });

  async function processItems(chains) {
    await Promise.all(chains.map(chain => updateVersionDataForChain(chain)));
    console.log("Finished!");
  }

  await processItems(chains);

}

function checkChainNameExists(chainName) {

  const chains = chain_reg.getChains();
  if (!chains.includes(chainName)) {
    throw error(`Chain ${chainName} does not exist.`);
  }

}

async function main(chainName) {
  console.log("Running setup...");
  chain_reg.setup(chainRegistryRoot);
  // setup shared by both modes here

  if (!chainName) {
    // no chain provided -> run all
    console.log("Running for all chains...");
    await updateVersionDataForChains();
    // ...
  } else {
    // single chain mode
    console.log(`Running for chain: ${chainName}`);
    checkChainNameExists(chainName);
    updateVersionDataForChain(chainName);
    // ...
  }
}

// Get CLI args
const args = process.argv.slice(2);
const chainName = args[0] || null;

// Always call main, with chainName if provided
main(chainName).catch((err) => {
  console.error("Error in main:", err);
  process.exit(1);
});