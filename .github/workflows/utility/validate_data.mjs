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

import * as fs from 'fs';
import * as path from 'path';
import * as chain_reg from './chain_registry.mjs';

import * as coingecko from './coingecko_data.mjs';

const chainRegistryRoot = "../../..";

const chainIdMap = new Map();
let base_denoms = [];

let coingecko_data = coingecko.coingecko_data;

const deepEqual = (a, b) => {
  if (a === b) return true; // Primitive values or reference equality
  if (typeof a !== typeof b || a === null || b === null) return false; // Mismatched types
  if (typeof a === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false; // Different number of keys
    return keysA.every(key => deepEqual(a[key], b[key])); // Recursive comparison
  }
  return false; // Fallback for unhandled cases
};

function deepEqualWithLoggingOneWay(obj1, obj2, path = '', mismatches = []) {
  if (typeof obj1 === 'object' && typeof obj2 === 'object' && obj1 !== null && obj2 !== null) {
    for (const key in obj1) {
      const newPath = path ? `${path}.${key}` : key;

      if (!(key in obj2)) {
        mismatches.push({ path: newPath, reason: 'Missing in currentVersion', value1: obj1[key] });
      } else {
        deepEqualWithLoggingOneWay(obj1[key], obj2[key], newPath, mismatches);
      }
    }
  } else if (obj1 !== obj2) {
    mismatches.push({
      path,
      reason: 'Value mismatch',
      value1: obj1,
      value2: obj2,
    });
  }

  return mismatches;
}



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
  if (slip44 === undefined) {
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

function checkIBCTraceChannelAccuracy(chain_name, asset, assets_ibcInvalid) {

  if (!asset.base || !asset.traces || asset.traces.length === 0) { return; }

  const lastTrace = asset.traces?.[asset.traces.length - 1];
  if (lastTrace.type !== "ibc" && lastTrace.type !== "ibc-cw20") { return; }

  // Sort chains alphabetically
  let list = [chain_name, lastTrace.counterparty.chain_name].sort();
  let chain1 = { chain_name: list[0] };
  let chain2 = { chain_name: list[1] };


  // Determine which chain is the counterparty
  let chain, counterparty;
  if (chain_name === chain1.chain_name) {
    chain = chain1;
    counterparty = chain2;
  } else {
    chain = chain2;
    counterparty = chain1;
  }

  // Get the IBC channels for these two chains
  const channels = chain_reg.getIBCFileProperty(chain1.chain_name, chain2.chain_name, "channels");
  //console.log(chain1.chain_name);
  //console.log(chain2.chain_name);
  //console.log(channels);
  if (!channels) {
    console.log(`Missing IBC connection registration between chains.
An asset (${asset.base}) registered on ${chain_name}'s assetlist from ${lastTrace.counterparty.chain_name} is invalid.`);
    assets_ibcInvalid.push({ chain_name, asset });
    return false;
    //throw new Error(`Missing IBC connection registration between chains.
//An asset (${asset.base}) registered on ${chain_name}'s assetlist from ${lastTrace.counterparty.chain_name} is invalid.`);
  }

  // Find the correct IBC channel
  let ibcChannel = channels.find(ch => {
    if (lastTrace.type === "ibc") {
      return ch.chain_1.port_id === "transfer" && ch.chain_2.port_id === "transfer";
    } else if (lastTrace.type === "ibc-cw20") {
      // We don't know if counterparty corresponds to chain_1 or chain_2, so check both ways
      return (
        (ch.chain_1.port_id === lastTrace.counterparty.port && ch.chain_1.channel_id === lastTrace.counterparty.channel_id) ||
        (ch.chain_2.port_id === lastTrace.counterparty.port && ch.chain_2.channel_id === lastTrace.counterparty.channel_id)
      );
    }
  });
  if (!ibcChannel) {
    console.log(`No matching IBC channel found for ${chain_name}, ${asset.base}`);
    assets_ibcInvalid.push({ chain_name, asset });
    return false;
    //throw new Error(`No matching IBC channel found for ${chain_name}, ${asset.base}`);
  }

  // Assign correct channel and port IDs
  chain1.channel_id = ibcChannel.chain_1.channel_id;
  chain1.port_id = ibcChannel.chain_1.port_id;
  chain2.channel_id = ibcChannel.chain_2.channel_id;
  chain2.port_id = ibcChannel.chain_2.port_id;

  // Validate channel and port IDs
  let valid = true;
  if (
    lastTrace.counterparty.channel_id !== counterparty.channel_id ||
    lastTrace.chain.channel_id !== chain.channel_id
  ) {
    valid = false;
  }

  if (lastTrace.type === "ibc-cw20") {
    if (
      lastTrace.counterparty.port !== counterparty.port_id ||
      lastTrace.chain.port !== chain.port_id
    ) {
      valid = false;
    }
  }

  if (!valid) {
    console.log(`Trace of ${chain_name}, ${asset.base} makes reference to IBC channels not registered.`);
    console.log(`${lastTrace.counterparty.channel_id}, ${counterparty.channel_id}`);
    console.log(`${lastTrace.chain.channel_id}, ${chain.channel_id}`);
    assets_ibcInvalid.push({ chain_name, asset });
    return false;
    //throw new Error(`Trace of ${chain_name}, ${asset.base} makes reference to IBC channels not registered.`);
  }

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


function checkImageSyncIsValid(chain_name, asset, assets_imageSyncInvalid) {

  if (!asset.base) { return; }
  asset.images?.forEach((image) => {
    if (!image.image_sync) { return; }
    //origin assets can't use image sync
    if (!asset.traces) {
      const chainStatus = chain_reg.getFileProperty(chain_name, "chain", "status")
      if (!chainStatus || chainStatus === "live") {
        const errorMsg = `Image Sync Pointer used for ${chain_name}, ${asset.base}, but using image sync requires traces.`;
        assets_imageSyncInvalid.push(errorMsg);
      }
    }
    let base = chain_reg.getAssetProperty(image.image_sync.chain_name, image.image_sync.base_denom, "base");
    if (!base) {
      const errorMsg = `Image Sync Pointer of ${chain_name}, ${asset.base} makes invalid reference to ${image.image_sync.chain_name}, ${image.image_sync.base_denom}.`;
      assets_imageSyncInvalid.push(errorMsg);
    }
    if (asset.base === image.image_sync.base_denom && chain_name === image.image_sync.chain_name) {
      const errorMsg = `Image_sync of ${chain_name}, ${asset.base} makes reference to self.`;
      assets_imageSyncInvalid.push(errorMsg);
    }
  });

}

function uriToRelativePath(uri) {
  const parts = uri.split('/');
  return parts.slice(6).join('/');
}

function fileExists(relativePath) {
  const fullPath = path.join(chainRegistryRoot, relativePath);
  return fs.existsSync(fullPath);
}

function checkImageExistence(image, formatsMissing) {

  const formatsToCheck = ["png", "svg"];
  formatsToCheck.forEach(format => {
    const uri = image[format]
    if (uri) {
      const relativePath = uriToRelativePath(uri);
      if (!fileExists(relativePath)) formatsMissing.push(format);
    }
  });

}

function checkImageExistence_Asset(chain_name, asset, errorMsgs) {

  if (!asset) return;
  asset.images?.forEach(image => {
    let formatsMissing = [];
    checkImageExistence(image, formatsMissing);
    if (formatsMissing.length > 0) {
      const errorMsg = `images[]: Image at ${chain_name}, ${asset.base} is missing for these formats: ${formatsMissing}.`;
      errorMsgs.assets_imagesNotExist.instances.push(errorMsg);
    }
  });

  if (!asset.logo_URIs) return;
  const image = asset.logo_URIs;
  let formatsMissing = [];
  checkImageExistence(image, formatsMissing);
  if (formatsMissing.length > 0) {
    const errorMsg = `logo_URIs: Image at ${chain_name}, ${asset.base} is missing for these formats: ${formatsMissing}.`;
    errorMsgs.assets_imagesNotExist.instances.push(errorMsg);
  }

}

function checkImageExistence_Chain(chain_name, errorMsgs) {

  const images = chain_reg.getFileProperty(chain_name, "chain", "images");
  images?.forEach(image => {
    let formatsMissing = [];
    checkImageExistence(image, formatsMissing);
    if (formatsMissing.length > 0) {
      const errorMsg = `images[]: Image at ${chain_name} is missing for these formats: ${formatsMissing}.`;
      errorMsgs.chains_imagesNotExist.instances.push(errorMsg);
    }
  });

  const image = chain_reg.getFileProperty(chain_name, "chain", "logo_URIs");
  if (!image) return;
  let formatsMissing = [];
  checkImageExistence(image, formatsMissing);
  if (formatsMissing.length > 0) {
    const errorMsg = `logo_URIs: Image at ${chain_name} is missing for these formats: ${formatsMissing}.`;
    errorMsgs.chains_imagesNotExist.instances.push(errorMsg);
  }

}

function compare_CodebaseVersionData_to_VersionsFile(chain_name) {

  const codebase = chain_reg.getFileProperty(chain_name, "chain", "codebase");
  if (!codebase) { return; }
  const codebaseVersionKeys = new Set([
    "recommended_version",
    "compatible_versions",
    "tag",
    "language",
    "binaries",
    "sdk",
    "consensus",
    "cosmwasm",
    "ibc"
  ]);
  const filteredCodebase = Object.fromEntries(
    Object.entries(codebase).filter(([key]) => codebaseVersionKeys.has(key))
  );

  const versionsArray = chain_reg.getFileProperty(chain_name, "versions", "versions");
  let currentVersion = versionsArray?.find(
    (version) => version.recommended_version === codebase?.recommended_version
  ) || {};

  const mismatches = deepEqualWithLoggingOneWay(filteredCodebase, currentVersion);

  if (mismatches.length > 0) {
    console.log('Found mismatches:');
    mismatches.forEach((mismatch) =>
      console.log(
        `Path: ${mismatch.path}, Reason: ${mismatch.reason}, In "codebase": ${mismatch.value1}, In currentVersion: ${mismatch.value2}`
      )
    );
    throw new Error(`Some version properties in codebase do not match the current version for ${chain_name}.`);
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
  //console.log(`Checking Base Denom. ${asset}, ${asset.base}`);
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

function checkCoingeckoIdMainnetAssetsOnly(chain_name, asset, networkType, assets_cgidAssetNotMainnet) {
  if (asset.coingecko_id && networkType && networkType !== "mainnet") {
    //throw new Error(`CoinGecko ID  may only be registered to mainnet assets, but found at ${chain_name}::${asset.base}`);
    console.log(`CoinGecko ID  may only be registered to mainnet assets, but found at ${chain_name}::${asset.base}`);
    assets_cgidAssetNotMainnet.push({ chain_name, asset });
    return false;
  } else {
    return true;
  }
}

function checkCoingeckoId_in_State(chain_name, asset, assets_cgidNotInState) {

  if (!coingecko.state?.coingecko_id_groups || !asset) { return true; }
  if (!asset.coingecko_id) { return true; }

  //find the object with this coingecko ID in the state file
  const coingeckoIdGroup = coingecko.state?.coingecko_id_groups?.find(group => group.coingecko_id === asset.coingecko_id);
  if (!coingeckoIdGroup) {
    //console.log(`State file missing Coingecko ID: ${asset.coingecko_id}, registered for asset: ${chain_name}::${asset.base}`);
    assets_cgidNotInState.push({ chain_name, asset });
    return false; // ID is missing from state
  }



  //see if it's cosmos origin has the asset
  //let ibc_origin_asset = chain_reg.getOriginAssetCustom(chain_name, asset.base, ["ibc", "ibc-cw20"]);
  let ibc_origin_cgid =
    chain_reg.getAssetPropertyFromOriginWithTraceCustom(
      chain_name,
      asset.base,
      "coingecko_id",
      ["ibc", "ibc-cw20"]
    );
  if (ibc_origin_cgid === asset.coingecko_id) return true;


  //see if it has the asset listed (bool)
  const assetExists = coingeckoIdGroup.assets.some(
    cgAsset => cgAsset.chain_name === chain_name && cgAsset.base_denom === asset.base
  );
  //if not, log so
  if (!assetExists) {
    assets_cgidNotInState.push({ chain_name, asset });
    //console.log(`Asset ${chain_name}::${asset.base} is not listed among the assets for ID: ${asset.coingecko_id} in the Coingecko state file.`);
  }
  return assetExists;

}

function checkCoingeckoIdAssetsShareOrigin(assets_cgidNotInState, assets_cgidOriginConflict) {

  if (assets_cgidNotInState.length <= 0) { return true; }

  let coingeckoIdGroupsToCheck = [];

  assets_cgidNotInState.forEach((chain_asset_pair) => {

    const chainName = chain_asset_pair.chain_name;
    const baseDenom = chain_asset_pair.asset.base;
    const coingeckoId = chain_asset_pair.asset.coingecko_id;

    let coingeckoIdGroup = coingeckoIdGroupsToCheck?.find(group => group.coingecko_id === coingeckoId);
    if (coingeckoIdGroup) {
      coingecko.addAssetToCoingeckoIdGroup(coingeckoIdGroup, chainName, baseDenom);
    } else {
      coingeckoIdGroup = coingecko.getCoingeckoIdGroupFromState(coingeckoId);
      if (coingeckoIdGroup) {
        coingecko.addAssetToCoingeckoIdGroup(coingeckoIdGroup, chainName, baseDenom);
      } else {
        coingeckoIdGroup = coingecko.createCoingeckoIdGroup(coingeckoId, chainName, baseDenom);
      }
      coingeckoIdGroupsToCheck.push(coingeckoIdGroup);
    }

  });

  coingeckoIdGroupsToCheck.forEach((coingeckoIdGroup) => {

    const cgidGroupOriginAsset = coingeckoIdGroup.originAsset ?? coingecko.getCoingeckoIdGroupOriginAsset(coingeckoIdGroup);

    coingeckoIdGroup.assets.forEach((asset) => {

      const originAsset = chain_reg.getOriginAsset(
        asset.chain_name,
        asset.base_denom,
        coingecko.traceTypesCoingeckoId
      );

      if (deepEqual(cgidGroupOriginAsset, originAsset)) {
        return;
      }

      const originAssetLastTrace = chain_reg
        .getAssetMetadata(originAsset.chain_name, originAsset.base_denom, "traces")
        ?.at(-1); // Get the last element safely

      const cgidGroupOriginAssetLastTrace = chain_reg
        .getAssetMetadata(cgidGroupOriginAsset.chain_name, cgidGroupOriginAsset.base_denom, "traces")
        ?.at(-1);

      if (
        originAssetLastTrace?.type === cgidGroupOriginAssetLastTrace?.type &&
        originAssetLastTrace?.provider === cgidGroupOriginAssetLastTrace?.provider
      ) {
        return;
      }

      console.warn(`
Coingecko Id Group (ID: ${coingeckoIdGroup.coingecko_id}) Origin Asset: ${cgidGroupOriginAsset.chain_name}, ${cgidGroupOriginAsset.base_denom}
does not match origin (${originAsset.chain_name}, ${originAsset.base_denom}) of this asset (${asset.chain_name}, ${asset.base_denom}}).
`);
      assets_cgidOriginConflict.push(asset);
          
    });
  });

}

async function checkCoingeckoId_in_API(assets_cgidAssetNotMainnet, assets_cgidNotInState, assets_cgidInvalid) {

  
  //Abort if we already know that non-mainnet assets have coingecko IDs.
  if (assets_cgidAssetNotMainnet.length > 0) {
    console.log(assets_cgidAssetNotMainnet.length);
    throw new Error(`CoinGecko IDs  may only be registered to mainnet assets.`);
  }
  //Currently unused ^

  //Abort if there are no new CGIDs to check
  if (!assets_cgidNotInState.length) { return; }
  

  await coingecko.fetchCoingeckoData(coingecko.coingeckoEndpoints.coins_list);
  if (!coingecko.api_response) {
    console.log("No CoinGecko API Response");
    return;
  }

  assets_cgidNotInState.forEach((chain_asset_pair) => {

    //temporary
    if (chain_asset_pair.asset.coingecko_id === "nim-network") {
      console.log(`${chain_asset_pair.asset.coingecko_id}`);
      console.log(chain_asset_pair);
      console.log(chain_asset_pair.asset);
    }
    //temporary

    const coin = coingecko.api_response?.[coingecko.coingeckoEndpoints.coins_list.name]?.find(
      apiObject => apiObject.id === chain_asset_pair.asset.coingecko_id
    );
    if (!coin) {
      console.log(`
Error: Coingecko ID: ${chain_asset_pair.asset.coingecko_id} is not in the Coingecko API result.
`);
      assets_cgidInvalid.push(chain_asset_pair);
      return;
    }
    //get the origin asset data
    const originAsset = chain_reg.getOriginAsset(
      chain_asset_pair.chain_name,
      chain_asset_pair.asset.base,
      coingecko.traceTypesCoingeckoId
    );
    const originAssetName = chain_reg.getAssetMetadata(
      originAsset.chain_name,
      originAsset.base_denom,
      "name"
    );
    const originAssetSymbol = chain_reg.getAssetMetadata(
      originAsset.chain_name,
      originAsset.base_denom,
      "symbol"
    );
    if (
      originAssetName != coin.name &&
      originAssetSymbol?.toUpperCase() != coin.symbol?.toUpperCase()
    ) {
      console.warn(`Warning: Mismatch of both Name and Symbol for Coingecko ID ${chain_asset_pair.asset.coingecko_id}.
  -Registry: "${originAssetName} $${originAssetSymbol} (CGID registered in Assetlist of chain_name: ${chain_asset_pair.chain_name})", 
  -Coingecko: "${coin.name} $${coin.symbol?.toUpperCase()}"`);
    }
  });

}

function prepareErrorMessages(errorMsgs) {

  //Chain Errors
  errorMsgs.chains_imagesNotExist = {
    category: "chains_imagesNotExist",
    notice: "Some Chain Images do not exist!",
    instances: []
  }

  //Asset Errors
  errorMsgs.assets_imagesNotExist = {
    category: "assets_imagesNotExist",
    notice: "Some Asset Images do not exist!",
    instances: []
  }

}

function reportErrors(
  assets_cgidInvalid,
  assets_ibcInvalid,
  assets_cgidOriginConflict,
  assets_imageSyncInvalid,
  errorMsgs
) {

  let ERRORS_DETECTED = false;

  //Asset Errors
  if (assets_cgidInvalid.length > 0) {
    console.log(`Some Coingecko IDs are not valid! ${assets_cgidInvalid}`);
    console.log(`Detected ${errorMsgs.assets_imagesNotExist.length} errors!`);
    ERRORS_DETECTED = true;
  }
  if (assets_ibcInvalid.length > 0) {
    console.log(`Some Trace IBC references are not valid! ${assets_ibcInvalid}`);
    console.log(`Detected ${errorMsgs.assets_imagesNotExist.length} errors!`);
    ERRORS_DETECTED = true;
  }
  if (assets_cgidOriginConflict.length > 0) {
    console.log(`Some Assets with the same Coingecko ID have different origins! ${assets_cgidOriginConflict}`);
    console.log(`Detected ${errorMsgs.assets_imagesNotExist.length} errors!`);
    ERRORS_DETECTED = true;
  }
  if (assets_imageSyncInvalid.length > 0) {
    console.log(`Some Image Sync configurations are invalid! ${assets_imageSyncInvalid}`);
    console.log(`Detected ${errorMsgs.assets_imagesNotExist.length} errors!`);
    ERRORS_DETECTED = true;
  }

  Object.values(errorMsgs).forEach(errorCategory => {
    if (errorCategory.instances.length <= 0) return;
    ERRORS_DETECTED = true;
    console.log(errorCategory.notice);
    errorCategory.instances.forEach(instance => {
      console.log(instance);
    });
    console.log(`Count: ${errorCategory.instances.length}`);
  });

  //Final throw (at least one error detected)
  if (ERRORS_DETECTED) {
    throw new Error(`Some asset metadata is invalid! (See console logs)`);
  }

}

export async function validate_chain_files(errorMsgs) {

  //get Chain Names
  const chainRegChains = chain_reg.getChains();

  //load coingecko state
  await coingecko.loadCoingeckoState();
  if (!coingecko.state) {
    console.log("Failed to load Coingecko State.");
  }

  let assets_cgidNotInState = [];
  let assets_cgidAssetNotMainnet = [];
  let assets_cgidInvalid = [];
  let assets_cgidOriginConflict = [];
  let assets_ibcInvalid = [];
  let assets_imageSyncInvalid = [];

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

    //check image existence
    checkImageExistence_Chain(chain_name, errorMsgs);

    //ensure that and version properties in codebase are also defined in the versions file.
    //compare_CodebaseVersionData_to_VersionsFile(chain_name);
    //this way removed because version data can now just be recorded in the chain.json file
    //version data recorded in the versions file will be overwitten by what's in codebase

    //get chain's network Type (mainet vs testnet vs...)
    //const chainNetworkType = chain_reg.getFileProperty(chain_name, "chain", "network_type");

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

      //check IBC counterparty channel accuracy
      checkIBCTraceChannelAccuracy(chain_name, asset, assets_ibcInvalid);

      //check ibc denom accuracy
      checkIbcDenomAccuracy(chain_name, asset);

      //check image_sync pointers of images
      checkImageSyncIsValid(chain_name, asset, assets_imageSyncInvalid);

      //check image existence
      checkImageExistence_Asset(chain_name, asset, errorMsgs);

      //check that base denom is unique within the assetlist
      checkUniqueBaseDenom(chain_name, asset);

      //checkCoingeckoIdMainnetAssetsOnly(chain_name, asset, chainNetworkType, assets_cgidAssetNotMainnet);

      //check that coingecko IDs are in the state
      checkCoingeckoId_in_State(chain_name, asset, assets_cgidNotInState);

    });

  });

  //check that new coingecko IDs are in the API
  await checkCoingeckoId_in_API(assets_cgidAssetNotMainnet, assets_cgidNotInState, assets_cgidInvalid);

  //check that assets with a newly defined CGID have the same origin asset as other assets that share the same CGID
  checkCoingeckoIdAssetsShareOrigin(assets_cgidNotInState, assets_cgidOriginConflict);

  //now that we've collected errors in bulk, throw error if positive
  reportErrors(
    assets_cgidInvalid,
    assets_ibcInvalid,
    assets_cgidOriginConflict,
    assets_imageSyncInvalid,
    errorMsgs
    //chains_imagesNotExist
    //assets_imagesNotExist
  );

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

  //prepare error catching
  let errorMsgs = {};
  prepareErrorMessages(errorMsgs);

  //check all chains
  validate_chain_files(errorMsgs);

  //check all IBC channels
  validate_ibc_files();

  //check file schema references
  checkFileSchemaReferences();
}

main();
