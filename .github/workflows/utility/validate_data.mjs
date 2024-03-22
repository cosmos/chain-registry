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

  //iterate each chain
  chainRegChains.forEach((chain_name) => {

    //check if all fee tokens are registered
    let fees = chain_reg.getFileProperty(chain_name, "chain", "fees");
    if (!fees) { return; }  // no fees defined
    if (!fees.fee_tokens) { return; }  // no fee_tokens defined
    fees.fee_tokens.forEach((fee_token) => {
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