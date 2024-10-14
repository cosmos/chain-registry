// Purpose:
//   to validate various data throughout the Chain Registry, prioritizing data that often gets missed by manual review
//   e.g., whether fee assets are registered to the chain's assetlist

// -- THE PLAN --
//
// read each chain's directory and files
//   read chain.json
//     read fee_tokens
//       check if fee token exists in the assetlist.
//     read staking
//       chaeck if staking token exists in the assetlist
//

import * as path from 'path';
import * as chain_reg from './chain_registry_local.mjs';


const chainIdMap = new Map();


function checkChainIdConflict(chain_name) {

  // Not concerned by conflicts with 'Killed' chains--could be a hard fork
  let chain_status = chain_reg.getFileProperty(chain_name, "chain", "status");
  if (!chain_status || chain_status === "killed") { return; }

  let chain_id = chain_reg.getFileProperty(chain_name, "chain", "chain_id");
  if (!chain_id) { return; } // must have a chainId
  if (chainIdMap.has(chain_id)) {
    let conflict_chain_name = chainIdMap.get(chain_id);
    throw new Error(`Duplicate chain ID for ${chain_name} found! Chain ID ${chain_id} is also claimed by ${conflict_chain_name}.`);
  }
  chainIdMap.set(chain_id, chain_name);

}

function checkFeeTokensAreRegistered(chain_name) {

  let fees = chain_reg.getFileProperty(chain_name, "chain", "fees");
  fees?.fee_tokens?.forEach((fee_token) => {
    if (!fee_token.denom) {
      throw new Error(`One of ${chain_name}'s fee tokens does not have denom specified.`);
    }
    if (!chain_reg.getAssetProperty(chain_name, fee_token.denom, "base")) {
      throw new Error(`Chain ${chain_name} does not have fee token ${fee_token.denom} defined in its Assetlist.`);
    }
  });

}

function checkStakingTokensAreRegistered(chain_name) {

  let staking = chain_reg.getFileProperty(chain_name, "chain", "staking");
  staking?.staking_tokens?.forEach((staking_token) => {
    if (!staking_token.denom) {
      throw new Error(`One of ${chain_name}'s staking tokens does not have denom specified.`);
    }
    if (!chain_reg.getAssetProperty(chain_name, staking_token.denom, "base")) {
      throw new Error(`Chain ${chain_name} does not have staking token ${staking_token.denom} defined in its Assetlist.`);
    }
  });

}

function checkDenomUnits(asset) {

  if (!asset.base) { return; }
  let VALID_BASE_UNIT;
  let VALID_DISPLAY_UNIT;
  asset.denom_units?.forEach((denom_unit) => {
  
    let denom_and_aliases = [];
    denom_and_aliases.push(denom_unit.denom);
    denom_unit.aliases?.forEach((alias) => {
      if (denom_and_aliases.includes(alias)) { return; }
      denom_and_aliases.push(alias);
    });

    //find base unit
    if (denom_and_aliases.includes(asset.base)) { 
      if (denom_unit.exponent !== 0) {
        throw new Error(`Base denomination ${asset.base} is not defined as having 0 exponent.`)
      }
      if (VALID_BASE_UNIT) {
        throw new Error(`Base denomination ${asset.base} refers to multiple denom_units.`);
      }
      VALID_BASE_UNIT = true;
    }

    //find display unit
    if (asset.display) {
      if (denom_and_aliases.includes(asset.display)) { 
        if (VALID_DISPLAY_UNIT) {
          throw new Error(`Display denomination ${asset.display} refers to multiple denom_units.`);
        }
        VALID_DISPLAY_UNIT = true;
      }
    }

    //check if IBC hashes contain lowercase letters
    denom_and_aliases.forEach((denom) => {
      if (!denom.startsWith("ibc/")) { return; }
      const substring = denom.substring(4);
      if (substring.toUpperCase() !== substring) {
        throw new Error(`Denom ${denom} is an IBC hash denomination, yet contains lowercase letters after "ibc/"`);
      }
    });

  });

  if (!VALID_BASE_UNIT) {
    throw new Error(`Base denomination ${asset.base} is not defined as a denom_unit.`);
  }
  if (!VALID_DISPLAY_UNIT) {
    throw new Error(`Display denomination ${asset.display} is not defined as a denom_unit.`);
  }

}

function checkTraceCounterpartyIsValid(chain_name, asset) {

  if (!asset.base) { return; }
  asset.traces?.forEach((trace) => {
    let base = chain_reg.getAssetProperty(trace.counterparty.chain_name, trace.counterparty.base_denom, "base");
    if (!base) {
      throw new Error(`Trace of ${chain_name}, ${asset.base} makes invalid reference to ${trace.counterparty.chain_name}, ${trace.counterparty.base_denom}.`);
    }
    if (asset.base === trace.counterparty.base_denom && chain_name === trace.counterparty.chain_name) {
      throw new Error(`Trace of ${chain_name}, ${asset.base} makes reference to self.`);
    }
  });

}


async function checkIbcDenomAccuracy(chain_name, asset) {

  if (!asset.base) { return; }
  if (asset.type_asset === "ics20") {

    if (!asset.traces) {
      throw new Error(`Trace of ${chain_name}, ${asset.base} not found for ics20 asset (where it is required).`);
    }
    const path = asset.traces[asset.traces.length - 1]?.chain?.path;
    if (!path) {
      throw new Error(`Path not defined for ${chain_name}, ${asset.base}.`);
    }
    const ibcHash = await chain_reg.calculateIbcHash(path);
    if (ibcHash !== asset.base) {
      throw new Error(`IBC Denom (SHA256 Hash) of ${path} does not match ${chain_name}, ${asset.base}.`);
    }
  }

}


function checkImageSyncIsValid(chain_name, asset) {

  if (!asset.base) { return; }
  asset.images?.forEach((image) => {
    if (!image.image_sync) { return; }
    let base = chain_reg.getAssetProperty(image.image_sync.chain_name, image.image_sync.base_denom, "base");
    if (!base) {
      throw new Error(`Image Sync Pointer of ${chain_name}, ${asset.base} makes invalid reference to ${image.image_sync.chain_name}, ${image.image_sync.base_denom}.`);
    }
    if (asset.base === image.image_sync.base_denom && chain_name === image.image_sync.chain_name) {
      throw new Error(`Image_sync of ${chain_name}, ${asset.base} makes reference to self.`);
    }
  });

}


function checkVersionsFileAndVersionsArray(chain_name) {

  const versionsFile = chain_reg.getFileProperty(chain_name, "versions", "versions");
  const versionsArray = chain_reg.getFileProperty(chain_name, "chain", "codebase")?.versions;

  if (versionsFile && versionsArray) {
    throw new Error(`Invalid versions array detected in chain.json for ${chain_name}. versions.json already used.`);
  }

}


function checkReplacementVersionProperties(chain_name) {

  const codebase = chain_reg.getFileProperty(chain_name, "chain", "codebase");
  const versions = codebase?.versions;

  if (codebase) {
    versions?.forEach((version) => {
      checkVersionForReplacementProperties(chain_name, version);
    });
    checkVersionForReplacementProperties(chain_name, codebase);
  }

}

function checkVersionForReplacementProperties(chain_name, versionObject) {

  const replacementPropertiesMap = new Map([
    ["cosmos_sdk_version", "sdk"],
    ["ibc_go_version", "ibc"],
    ["go_version", "language"],
    ["cosmwasm_version", "cosmwasm"]
  ]);

  const splitRegexPattern = /^(?:([^ \@]*)[ \@])?(.*)$/;
  const repoRegexPattern = /(?:.*\/)?([^\/]+\/[^\/]+)$/;
  const tagRegexPattern = /^(?=.*-).+$/;
  const versionRegexPattern = /^([^ -]+)/;

  const name = versionObject.name;

  for (const [deprecated, replacement] of replacementPropertiesMap) {

    const deprecatedValue = versionObject[deprecated];
    const replacementValue = versionObject[replacement];
    

    if (deprecatedValue) {

      //replacement must exist
      if (!replacementValue) {
        throw new Error(`Missing replacement property (${replacement}) for deprecated proerty (${deprecated}) for: ${chain_name}::${name}`);
      }

      //split the value into repo, version, and tag, then check that they match
      let repo = deprecatedValue;
      repo = repo.match(splitRegexPattern)?.[1];
      repo = repo?.match(repoRegexPattern)?.[1];
      if (repo) {
        repo = "https://github.com/" + repo;
        if (repo != replacementValue.repo) {
          throw new Error(`Replacement property (${replacement}.repo) value (${replacementValue.repo}) does not match computed value (${repo}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }
      
      let tag = deprecatedValue;
      tag = tag.match(splitRegexPattern)?.[2];
      let version = tag;
      tag = tag?.match(tagRegexPattern)?.[1];
      if (tag) {
        //console.log(tag);
        if (repo != replacementValue.tag) {
          throw new Error(`Replacement property (${replacement}.tag) value (${replacementValue.tag}) does not match computed value (${tag}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }

      version = version?.match(versionRegexPattern)?.[1];
      if (version) {
        //console.log(version);
        if (version != replacementValue.version) {
          throw new Error(`Replacement property (${replacement}.version) value (${replacementValue.version}) does not match computed value (${version}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }

      if (deprecated === "ibc_go_version") {
        const expectedValue = "go";
        if (!replacementValue.type || (replacementValue.type !== expectedValue)) {
          throw new Error(`Replacement property (${replacement}.type) value (${replacementValue.type}) does not match expected value (${expectedValue}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }

      if (deprecated === "go_version") {
        const expectedValue = "go";
        if (!replacementValue.type || (replacementValue.type !== expectedValue)) {
          throw new Error(`Replacement property (${replacement}.type) value (${replacementValue.type}) does not match expected value (${expectedValue}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }

      if (deprecated === "cosmos_sdk_version") {
        const expectedValue = "cosmos";
        if (!replacementValue.type || (replacementValue.type !== expectedValue)) {
          throw new Error(`Replacement property (${replacement}.type) value (${replacementValue.type}) does not match expected value (${expectedValue}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }

    }

  }

  if (versionObject.cosmwasm_enabled) {
    if (versionObject.cosmwasm_enabled != versionObject.cosmwasm.enabled) {
      throw new Error(`Replacement property (versionObject.cosmwasm.enabled) value (${versionObject.cosmwasm.enabled}) does not match deprecated property (versionObject.cosmwasm_enabled) value (${versionObject.cosmwasm_enabled}) for: ${chain_name}::${name}`);
    }
  }

  if (versionObject.cosmwasm_path) {
    if (versionObject.cosmwasm_path != versionObject.cosmwasm.path) {
      throw new Error(`Replacement property (versionObject.cosmwasm.path) value (${versionObject.cosmwasm.path}) does not match deprecated proerty (versionObject.cosmwasm_path) value (${versionObject.cosmwasm_path}) for: ${chain_name}::${name}`);
    }
  }

  if (versionObject.ics_enabled) {
    if (!(arraysEqual(versionObject.ics_enabled, versionObject.ibc.ics_enabled))) {
      throw new Error(`Replacement property (versionObject.ibc.ics_enabled) value (${versionObject.ibc.ics_enabled}) does not match deprecated property (versionObject.ics_enabled) value (${versionObject.ics_enabled}) for: ${chain_name}::${name}`);
    }
  }

}

function checkFileSchemaReference(fileLocation, fileName, extraParentDirectories, schema) {

  let calculatedSchemaLocation = path.join(
    extraParentDirectories,
    chain_reg.schemas.get(schema)
  );

  const file = path.join(fileLocation, fileName);
  const jsonFileContents = chain_reg.readJsonFile(file);

  if (!jsonFileContents) {
    console.log("Err: No JSON Contents");
    console.log(`${jsonFileContents}`);
    console.log(`${fileLocation}`);
    console.log(`${fileName}`);
  }

  if (jsonFileContents?.$schema !== calculatedSchemaLocation) {
    throw new Error(`Schema Value: ${jsonFileContents?.$schema} does not match calculated Schema Location: ${calculatedSchemaLocation} for file: ${file}.`);
  }

}

function checkFileSchemaReferences() {

  const root = chain_reg.chainRegistryRoot;
  //Directories (from Root--will join later)
  const ibcDirectory = "_IBC";
  const networkTypes = [...chain_reg.networkTypeToDirectoryNameMap.values()];
  const chainTypes = [...chain_reg.domainToDirectoryNameMap.values()];
  const chainFiles = [...chain_reg.fileToFileNameMap.keys()];
  let extraParentDirectories = "";

  //mainnets vs testnets/devnets
  networkTypes.forEach((networkType) => {

    if (networkType !== "") {
      extraParentDirectories += "../";
    }

    //remember to look at IBC
    let fileLocation = path.join(root, networkType, ibcDirectory);
    let files = chain_reg.getDirectoryContents(fileLocation);
    extraParentDirectories += "../";
    files.forEach((file) => {
      checkFileSchemaReference(fileLocation, file, extraParentDirectories, "ibc");
    });
    extraParentDirectories = extraParentDirectories.slice(0,-3);

    //cosmos vs non_cosmos
    chainTypes.forEach((chainType) => {
      if (chainType !== "") {
        extraParentDirectories += "../";
      }

      //look at each chain
      let chains = chain_reg.getDirectoryContents(path.join(root, networkType, chainType));
      chains.forEach((chain) => {
        if (chain_reg.nonChainDirectories.includes(chain)) { return; }
        extraParentDirectories += "../";
        let fileLocation = path.join(root, networkType, chainType, chain);
        let files = chain_reg.getDirectoryContents(fileLocation);

        //chain.json vs assetlist.json vs ...
        chainFiles.forEach((chainFile) => {
          let fileName = chain_reg.fileToFileNameMap.get(chainFile);
          if (files.includes(fileName)) {
            checkFileSchemaReference(fileLocation, fileName, extraParentDirectories, chainFile);
          }
        });
        extraParentDirectories = extraParentDirectories.slice(0, -3);
      });
      if (chainType !== "") {
        extraParentDirectories = extraParentDirectories.slice(0, -3);
      }
    });
    if (networkType !== "") {
      extraParentDirectories = extraParentDirectories.slice(0, -3);
    }
  });

}

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }

  return true;
}

function checkTypeAsset(chain_name, asset) {

  let type_asset = "ics20";
  if (asset.base.startsWith("ibc/") && asset.type_asset !== type_asset) {
    throw new Error(`Type_asset not specified as ${type_asset}: ${chain_name}, ${asset.base}, ${asset.symbol}.`);
  }

  if (
    asset.base.startsWith("cw20")
  ) {
    if (chain_name.startsWith("secret")) {
      type_asset = "snip20";
      if (asset.type_asset !== type_asset && asset.type_asset !== "snip25") {
        throw new Error(`Type_asset not specified as ${type_asset}: ${chain_name}, ${asset.base}, ${asset.symbol}.`);
      }
    } else {
      type_asset = "cw20";
      if (asset.type_asset !== "cw20") {
        throw new Error(`Type_asset not specified as ${type_asset}: ${chain_name}, ${asset.base}, ${asset.symbol}.`);
      }
    }
  }

  type_asset = "erc20";
  if (
    asset.base.startsWith("0x") &&
    !asset.base.includes("::") &&
    !asset.base.includes("00000") &&
    asset.type_asset !== type_asset
  ) {
    throw new Error(`Type_asset not specified as ${type_asset}: ${chain_name}, ${asset.base}, ${asset.symbol}.`);
  }

  if (!asset.type_asset) {
    throw new Error(`Type_asset not specified: ${chain_name}, ${asset.base}, ${asset.symbol}.`);
  }

}


export function validate_chain_files() {

  //get Chain Names
  const chainRegChains = chain_reg.getChains();

  //iterate each chain
  chainRegChains.forEach((chain_name) => {

    //console.log(chain_name);

    //check if chain_id is registered by another chain
    checkChainIdConflict(chain_name);

    //check if all fee tokens are registered
    checkFeeTokensAreRegistered(chain_name);

    //check if all staking tokens are registered
    checkStakingTokensAreRegistered(chain_name);

    //check if all old version properties' data are added into the new replacement version properties
    checkReplacementVersionProperties(chain_name);

    //check that versions[] cannot be defined in chain.json when versions.json exists
    checkVersionsFileAndVersionsArray(chain_name);

    //get chain's assets
    const chainAssets = chain_reg.getFileProperty(chain_name, "assetlist", "assets");
    
    //iterate each asset
    chainAssets?.forEach((asset) => {

      //require type_asset
      checkTypeAsset(chain_name, asset);
    
      //check denom units
      checkDenomUnits(asset);

      //check counterparty pointers of traces
      checkTraceCounterpartyIsValid(chain_name, asset);

      //check ibc denom accuracy
      checkIbcDenomAccuracy(chain_name, asset);

      //check image_sync pointers of images
      checkImageSyncIsValid(chain_name, asset);
    
    });


  });

}

function validate_ibc_files() {

  //IBC directory name
  const ibcDirectoryName = "_IBC";

  //create maps of chains and channels
  const chainNameToIbcChannelsMap = new Map();

  Array.from(chain_reg.networkTypeToDirectoryMap.keys()).forEach((networkType) => {

    //Get all IBC Files (Mainnet and Testnet)
    const networkTypeDirectory = chain_reg.networkTypeToDirectoryMap.get(networkType);
    const directory = path.join(
      networkTypeDirectory,
      ibcDirectoryName
    );
    const ibcFiles = chain_reg.getDirectoryContents(directory);

    ibcFiles.forEach((ibcFile) => {

      //check for ibc channel duplicates
      const ibcFileContents = chain_reg.readJsonFile(path.join(directory, ibcFile));
      const chain1 = ibcFileContents.chain_1.chain_name;
      const chain2 = ibcFileContents.chain_2.chain_name;
      const channels = ibcFileContents.channels;
      channels.forEach((channel) => {

        //check for duplicate channel-ids
        checkDuplicateChannels(channel.chain_1.channel_id, chain1, chain2, chainNameToIbcChannelsMap);
        checkDuplicateChannels(channel.chain_2.channel_id, chain2, chain1, chainNameToIbcChannelsMap);

      });

    });

  });

}

function checkDuplicateChannels(channel_id, chain, counterparty, chainNameToIbcChannelsMap) {

  if (channel_id === "*") { return; }
  let duplicateChannel = undefined;
  let chainChannels = chainNameToIbcChannelsMap.get(chain);
  if (!chainChannels) {
    chainChannels = [];
  } else {
    duplicateChannel = chainChannels.find(obj => obj.channel_id === channel_id);
  }
  if (duplicateChannel) {
    //report duplicate
    throw new Error(`For chain: ${chain}, channel_id: ${channel_id} is registered for both: ${duplicateChannel.chain_name} and ${counterparty}.`);
  } else {
    const obj = {
      channel_id: channel_id,
      chain_name: counterparty
    };
    chainChannels.push(obj);
    chainNameToIbcChannelsMap.set(chain, chainChannels);
  }

}

function main() {

  //check all chains
  validate_chain_files();

  //check all IBC channels
  validate_ibc_files();

  //check file schema references
  checkFileSchemaReferences();
}

main();