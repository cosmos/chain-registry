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


function checkReplacementVersionProperties(chain_name) {

  const codebase = chain_reg.getFileProperty(chain_name, "chain", "codebase");
  const versions = codebase?.versions;

  if (codebase) {
    versions?.forEach((version) => {
      checkVersionForReplacementProperties(chain_name, version);
    });
    //checkVersionForReplacementProperties(codebase);
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

  for (const [deprecated, replacement] of replacementPropertiesMap) {

    const deprecatedValue = versionObject[deprecated];
    const replacementValue = versionObject[replacement];
    const name = versionObject.name;

    if (deprecatedValue) {

      //replacement must exist
      if (!replacementValue) {
        throw new Error(`Missing replacement property (${replacement}) for deprecated proerty (${deprecated}) for: ${chain_name}::${name}`);
      }

      //replacement value must match
      //split the value into repo, version, and tag

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
      if (chain_name === "nibirudevnet3") {
        console.log(version);
      }
      tag = tag?.match(tagRegexPattern)?.[1];
      if (tag) {
        //console.log(tag);
        if (repo != replacementValue.tag) {
          throw new Error(`Replacement property (${replacement}.tag) value (${replacementValue.tag}) does not match computed value (${tag}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }

      version = version?.match(versionRegexPattern)?.[1];
      if(chain_name === "nibirudevnet3") {
        console.log(version);
        console.log(deprecatedValue);
        console.log(replacementValue);
      }
      if (version) {
        //console.log(version);
        if (chain_name === "nibirudevnet3") {
          console.log(version);
        }
        if (version != replacementValue.version) {
          throw new Error(`Replacement property (${replacement}.version) value (${replacementValue.version}) does not match computed value (${version}) in deprecated property (${deprecatedValue}) for: ${chain_name}::${name}`);
        }
      }

      //check that repo, version, and tag, are all correct in the replacement

    }

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

    //get chain's assets
    const chainAssets = chain_reg.getFileProperty(chain_name, "assetlist", "assets");
    
    //iterate each asset
    chainAssets?.forEach((asset) => {
    
      //check denom units
      checkDenomUnits(asset);

      //check counterparty pointers of traces
      checkTraceCounterpartyIsValid(chain_name, asset);

      //check image_sync pointers of images
      checkImageSyncIsValid(chain_name, asset);
    
    });


  });

}

function main() {
  validate_chain_files();
}

main();