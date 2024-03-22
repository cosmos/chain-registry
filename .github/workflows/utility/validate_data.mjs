// Purpose:
//   to validate various data throughout the Chain Registry, prioritizing data that often gets missed by manual review
//   e.g., whether fee assets are registered to the chain's assetlist

// -- THE PLAN --
//
// read each chain's directory and files
//   read chain.json
//     read fee_tokens
//       check if fee token exists in the assetlist.
//

import * as path from 'path';
import * as chain_reg from './chain_registry_local.mjs';

export function validate_chain_files() {

  const chainRegChains = chain_reg.getChains();
  const chainIdMap = new Map();

  //iterate each chain
  chainRegChains.forEach((chain_name) => {

    //check if chain_id is registered by another chain
    let CHAIN_KILLED = chain_reg.getFileProperty(chain_name, "chain", "status");
    if (!CHAIN_KILLED) {
      let chain_id = chain_reg.getFileProperty(chain_name, "chain", "chain_id");
      if (chain_id) {
        if (chainIdMap.has(chain_id)) {
          let conflict_chain_name = chainIdMap.get(chain_id);
          throw new Error(`Duplicate chain ID found! Chain ID ${chain_id} is already claimed by ${conflict_chain_name}.`);
        }
        chainIdMap.set(chain_id, chain_name);
      }
    }

    //check if all fee tokens are registered
    let fees = chain_reg.getFileProperty(chain_name, "chain", "fees");
    fees?.fee_tokens?.forEach((fee_token) => {
      if (!fee_token.denom) {
        throw new Error(`One of ${chain_name}'s fee tokens does not have denom specified.`);
      }
      if (!chain_reg.getAssetProperty(chain_name, fee_token.denom, "base")) {
        throw new Error(`Chain ${chain_name} does not have fee token ${fee_token.denom} defined in it's Assetlist.`);
      }
    });

  });

}

function main() {
  validate_chain_files();
}

main();