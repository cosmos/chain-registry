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
import * as chain_reg from './chain_registry.mjs';

const chainRegistryRoot = "../../..";

const chainIdMap = new Map();
let base_denoms = [];


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

function checkSlip44(chain_name) {

  let chain_type = chain_reg.getFileProperty(chain_name, "chain", "chain_type");
  if (!chain_type || chain_type !== "cosmos") { return; }
  let chain_status = chain_reg.getFileProperty(chain_name, "chain", "status");
  if (!chain_status || chain_status === "upcoming" || chain_status === "killed") { return; }
  let slip44 = chain_reg.getFileProperty(chain_name, "chain", "slip44");
  if (!slip44) {
    throw new Error(`Chain ${chain_name} missing slip44!`);
  }

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

function checkUniqueBaseDenom(chain_name, asset) {

  if (base_denoms.includes(asset.base)) {
    throw new Error(`Base (denom) already registered: ${chain_name}, ${asset.base}, ${asset.symbol}.`);
  } else {
    base_denoms.push(asset.base);
  }

}

function checkChainNameMatchDirectory(chain_name) {
  chain_reg.files.forEach((file) => {
    const fileChainNameValue = chain_reg.getFileProperty(chain_name, file, "chain_name");
    if (!fileChainNameValue) { return; }
    if (fileChainNameValue !== chain_name) {
      throw new Error(`Directory ${chain_name}'s ${file} file has chain_name: ${fileChainNameValue}, which is a mismatch!`);
    }
  });
}


export function validate_chain_files() {

  //get Chain Names
  const chainRegChains = chain_reg.getChains();

  //iterate each chain
  chainRegChains.forEach((chain_name) => {

    //console.log(chain_name);

    //check if chain_name matches directory name
    checkChainNameMatchDirectory(chain_name);

    //check if chain_id is registered by another chain
    checkChainIdConflict(chain_name);

    //check for slip44
    checkSlip44(chain_name);

    //check if all fee tokens are registered
    checkFeeTokensAreRegistered(chain_name);

    //check if all staking tokens are registered
    checkStakingTokensAreRegistered(chain_name);

    //check that versions[] cannot be defined in chain.json when versions.json exists
    checkVersionsFileAndVersionsArray(chain_name);

    //get chain's assets
    const chainAssets = chain_reg.getFileProperty(chain_name, "assetlist", "assets");

    base_denoms = [];

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

      //check that base denom is unique within the assetlist
      checkUniqueBaseDenom(chain_name, asset);
    
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

  //setup chain registry
  chain_reg.setup(chainRegistryRoot);

  //check all chains
  validate_chain_files();

  //check all IBC channels
  validate_ibc_files();

  //check file schema references
  checkFileSchemaReferences();
}

main();