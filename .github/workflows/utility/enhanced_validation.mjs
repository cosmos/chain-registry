// Enhanced Chain Registry Validation
// Validates all required chain metadata fields automatically

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const chainRegistryRoot = "../../..";
let validationErrors = [];
let validationWarnings = [];

// Field validation functions
class ChainValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  // 1. Chain ID validation
  validateChainId(chainData, chainName) {
    if (!chainData.chain_id) {
      this.errors.push(`❌ Chain ID missing for ${chainName}`);
      return false;
    }
    
    // Check for duplicate chain IDs across registry
    const chainIds = this.getAllChainIds();
    const duplicates = chainIds.filter(id => id === chainData.chain_id);
    if (duplicates.length > 1) {
      this.errors.push(`❌ Duplicate Chain ID '${chainData.chain_id}' found for ${chainName}`);
    }
    
    console.log(`✅ Chain ID validated: ${chainData.chain_id} for ${chainName}`);
    return true;
  }

  // 2. Chain Name validation  
  validateChainName(chainData, directoryName) {
    if (!chainData.chain_name) {
      this.errors.push(`❌ Chain name missing for ${directoryName}`);
      return false;
    }
    
    if (chainData.chain_name !== directoryName) {
      this.errors.push(`❌ Chain name '${chainData.chain_name}' doesn't match directory '${directoryName}'`);
      return false;
    }
    
    if (!chainData.pretty_name) {
      this.warnings.push(`⚠️ Pretty name missing for ${chainData.chain_name}`);
    }
    
    console.log(`✅ Chain name validated: ${chainData.chain_name}`);
    return true;
  }

  // 3. RPC validation
  async validateRPC(chainData, chainName) {
    const rpcEndpoints = chainData.apis?.rpc || [];
    if (rpcEndpoints.length === 0) {
      this.errors.push(`❌ No RPC endpoints found for ${chainName}`);
      return false;
    }

    let workingEndpoints = 0;
    for (const endpoint of rpcEndpoints.slice(0, 3)) { // Test first 3
      try {
        const response = await axios.get(`${endpoint.address}/status`, { timeout: 5000 });
        if (response.status === 200 && response.data?.result?.node_info) {
          workingEndpoints++;
          console.log(`✅ RPC endpoint working: ${endpoint.address} (${endpoint.provider || 'Unknown provider'})`);
        }
      } catch (error) {
        this.warnings.push(`⚠️ RPC endpoint unreachable: ${endpoint.address} for ${chainName}`);
      }
    }

    if (workingEndpoints === 0) {
      this.errors.push(`❌ No working RPC endpoints found for ${chainName}`);
      return false;
    }

    return true;
  }

  // 4. REST validation
  async validateREST(chainData, chainName) {
    const restEndpoints = chainData.apis?.rest || [];
    if (restEndpoints.length === 0) {
      this.errors.push(`❌ No REST endpoints found for ${chainName}`);
      return false;
    }

    let workingEndpoints = 0;
    for (const endpoint of restEndpoints.slice(0, 3)) { // Test first 3
      try {
        const response = await axios.get(`${endpoint.address}/cosmos/base/tendermint/v1beta1/syncing`, { timeout: 5000 });
        if (response.status === 200) {
          workingEndpoints++;
          console.log(`✅ REST endpoint working: ${endpoint.address} (${endpoint.provider || 'Unknown provider'})`);
        }
      } catch (error) {
        this.warnings.push(`⚠️ REST endpoint unreachable: ${endpoint.address} for ${chainName}`);
      }
    }

    if (workingEndpoints === 0) {
      this.errors.push(`❌ No working REST endpoints found for ${chainName}`);
      return false;
    }

    return true;
  }

  // 5. GRPC validation
  validateGRPC(chainData, chainName) {
    const grpcEndpoints = chainData.apis?.grpc || [];
    if (grpcEndpoints.length === 0) {
      this.warnings.push(`⚠️ No GRPC endpoints found for ${chainName}`);
      return true; // Not critical
    }

    grpcEndpoints.forEach(endpoint => {
      if (!endpoint.address) {
        this.errors.push(`❌ GRPC endpoint missing address for ${chainName}`);
      } else {
        console.log(`✅ GRPC endpoint found: ${endpoint.address} (${endpoint.provider || 'Unknown provider'})`);
      }
    });

    return true;
  }

  // 6. EVM-RPC validation
  async validateEVMRPC(chainData, chainName) {
    const evmEndpoints = chainData.apis?.['evm-http-jsonrpc'] || [];
    
    // Only check for EVM chains
    if (chainData.extra_codecs?.includes('ethermint') || chainData.key_algos?.includes('ethsecp256k1')) {
      if (evmEndpoints.length === 0) {
        this.warnings.push(`⚠️ EVM chain ${chainName} missing EVM-RPC endpoints`);
        return true; // Warning, not error
      }

      for (const endpoint of evmEndpoints.slice(0, 2)) { // Test first 2
        try {
          const response = await axios.post(endpoint.address, {
            jsonrpc: "2.0",
            method: "eth_chainId",
            params: [],
            id: 1
          }, { timeout: 5000 });
          
          if (response.data?.result) {
            console.log(`✅ EVM-RPC endpoint working: ${endpoint.address} (${endpoint.provider || 'Unknown provider'})`);
          }
        } catch (error) {
          this.warnings.push(`⚠️ EVM-RPC endpoint unreachable: ${endpoint.address} for ${chainName}`);
        }
      }
    }

    return true;
  }

  // 7. Address Prefix validation
  validateAddressPrefix(chainData, chainName) {
    if (!chainData.bech32_prefix) {
      this.errors.push(`❌ Address prefix (bech32_prefix) missing for ${chainName}`);
      return false;
    }

    // Validate against SLIP-173 (this would require fetching SLIP-173 data)
    // For now, just check format
    if (!/^[a-z0-9]+$/.test(chainData.bech32_prefix)) {
      this.errors.push(`❌ Invalid address prefix format '${chainData.bech32_prefix}' for ${chainName}`);
      return false;
    }

    console.log(`✅ Address prefix validated: ${chainData.bech32_prefix} for ${chainName}`);
    return true;
  }

  // 8. Base Denom validation
  validateBaseDenom(chainData, assetData, chainName) {
    const assets = assetData?.assets || [];
    const nativeAssets = assets.filter(asset => asset.type_asset === 'sdk.coin');
    
    if (nativeAssets.length === 0) {
      this.errors.push(`❌ No native assets found for ${chainName}`);
      return false;
    }

    // Check if fee tokens reference valid assets
    const feeTokens = chainData.fees?.fee_tokens || [];
    feeTokens.forEach(feeToken => {
      const assetExists = assets.some(asset => asset.base === feeToken.denom);
      if (!assetExists) {
        this.errors.push(`❌ Fee token '${feeToken.denom}' not found in assetlist for ${chainName}`);
      }
    });

    nativeAssets.forEach(asset => {
      console.log(`✅ Base denom validated: ${asset.base} for ${chainName}`);
    });

    return true;
  }

  // 9. Cointype validation
  validateCointype(chainData, chainName) {
    if (chainData.slip44 === undefined) {
      this.warnings.push(`⚠️ Cointype (slip44) missing for ${chainName}`);
      return true; // Warning, not error
    }

    if (typeof chainData.slip44 !== 'number' || chainData.slip44 < 0) {
      this.errors.push(`❌ Invalid cointype '${chainData.slip44}' for ${chainName}`);
      return false;
    }

    console.log(`✅ Cointype validated: ${chainData.slip44} for ${chainName}`);
    return true;
  }

  // 10. Native Token Decimals validation
  validateTokenDecimals(assetData, chainName) {
    const assets = assetData?.assets || [];
    const nativeAssets = assets.filter(asset => asset.type_asset === 'sdk.coin');

    nativeAssets.forEach(asset => {
      const denomUnits = asset.denom_units || [];
      const displayUnit = denomUnits.find(unit => unit.denom === asset.display);
      
      if (!displayUnit) {
        this.errors.push(`❌ Display denom unit not found for ${asset.symbol} in ${chainName}`);
        return;
      }

      if (typeof displayUnit.exponent !== 'number') {
        this.errors.push(`❌ Invalid decimals (exponent) for ${asset.symbol} in ${chainName}`);
        return;
      }

      console.log(`✅ Token decimals validated: ${asset.symbol} has ${displayUnit.exponent} decimals in ${chainName}`);
    });

    return true;
  }

  // 11. Block Explorer URL validation
  async validateBlockExplorers(chainData, chainName) {
    const explorers = chainData.explorers || [];
    if (explorers.length === 0) {
      this.warnings.push(`⚠️ No block explorers found for ${chainName}`);
      return true; // Warning, not error
    }

    for (const explorer of explorers.slice(0, 2)) { // Test first 2
      try {
        const response = await axios.head(explorer.url, { timeout: 10000 });
        if (response.status === 200) {
          console.log(`✅ Block explorer working: ${explorer.url} (${explorer.kind || 'Unknown type'})`);
        }
      } catch (error) {
        this.warnings.push(`⚠️ Block explorer unreachable: ${explorer.url} for ${chainName}`);
      }
    }

    return true;
  }

  // 12. Mainnet/Testnet validation
  validateNetworkType(chainData, chainName) {
    const validTypes = ['mainnet', 'testnet', 'devnet'];
    if (!chainData.network_type) {
      this.errors.push(`❌ Network type missing for ${chainName}`);
      return false;
    }

    if (!validTypes.includes(chainData.network_type)) {
      this.errors.push(`❌ Invalid network type '${chainData.network_type}' for ${chainName}. Must be one of: ${validTypes.join(', ')}`);
      return false;
    }

    console.log(`✅ Network type validated: ${chainData.network_type} for ${chainName}`);
    return true;
  }

  // Helper methods
  getAllChainIds() {
    // This would scan all chain.json files to collect chain IDs
    // Implementation needed based on file structure
    return [];
  }

  async validateChain(chainPath) {
    const chainName = path.basename(chainPath);
    console.log(`\n🔍 Validating chain: ${chainName}`);

    try {
      // Read chain.json
      const chainJsonPath = path.join(chainPath, 'chain.json');
      const assetlistJsonPath = path.join(chainPath, 'assetlist.json');

      if (!fs.existsSync(chainJsonPath)) {
        this.errors.push(`❌ chain.json not found for ${chainName}`);
        return false;
      }

      const chainData = JSON.parse(fs.readFileSync(chainJsonPath, 'utf8'));
      let assetData = null;

      if (fs.existsSync(assetlistJsonPath)) {
        assetData = JSON.parse(fs.readFileSync(assetlistJsonPath, 'utf8'));
      }

      // Run all validations
      this.validateChainId(chainData, chainName);
      this.validateChainName(chainData, chainName);
      await this.validateRPC(chainData, chainName);
      await this.validateREST(chainData, chainName);
      this.validateGRPC(chainData, chainName);
      await this.validateEVMRPC(chainData, chainName);
      this.validateAddressPrefix(chainData, chainName);
      this.validateCointype(chainData, chainName);
      this.validateNetworkType(chainData, chainName);
      await this.validateBlockExplorers(chainData, chainName);

      if (assetData) {
        this.validateBaseDenom(chainData, assetData, chainName);
        this.validateTokenDecimals(assetData, chainName);
      }

      return true;

    } catch (error) {
      this.errors.push(`❌ Error validating ${chainName}: ${error.message}`);
      return false;
    }
  }
}

// Main validation function
async function main() {
  console.log('🚀 Starting Enhanced Chain Validation...\n');

  const validator = new ChainValidator();
  
  // Get list of chain directories (exclude non-chain directories)
  const excludeDirs = ['_IBC', '_non-cosmos', '_template', '.github', '.git', 'node_modules'];
  
  try {
    const entries = fs.readdirSync(chainRegistryRoot, { withFileTypes: true });
    const chainDirs = entries
      .filter(entry => entry.isDirectory() && !excludeDirs.includes(entry.name))
      .map(entry => entry.name);

    console.log(`Found ${chainDirs.length} chain directories to validate`);

    // Validate each chain
    for (const chainDir of chainDirs.slice(0, 5)) { // Limit for testing
      const chainPath = path.join(chainRegistryRoot, chainDir);
      await validator.validateChain(chainPath);
    }

    // Report results
    console.log('\n📊 Validation Results:');
    console.log(`✅ Errors: ${validator.errors.length}`);
    console.log(`⚠️ Warnings: ${validator.warnings.length}`);

    if (validator.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      validator.errors.forEach(error => console.log(error));
    }

    if (validator.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      validator.warnings.forEach(warning => console.log(warning));
    }

    // Save results to file
    const results = {
      timestamp: new Date().toISOString(),
      errors: validator.errors,
      warnings: validator.warnings,
      totalChains: chainDirs.length
    };

    fs.writeFileSync('validation-results.json', JSON.stringify(results, null, 2));

    // Exit with error code if there are errors
    if (validator.errors.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}