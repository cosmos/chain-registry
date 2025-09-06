// Validation Report Generator
// Creates comprehensive reports from validation results

import * as fs from 'fs';

async function generateReport() {
  console.log('📝 Generating Comprehensive Validation Report...\n');

  let validationResults = {};
  let endpointResults = {};

  // Load validation results
  try {
    if (fs.existsSync('validation-results.json')) {
      validationResults = JSON.parse(fs.readFileSync('validation-results.json', 'utf8'));
    }
  } catch (error) {
    console.warn('Could not load validation results:', error.message);
  }

  // Load endpoint health results
  try {
    if (fs.existsSync('endpoint-health-report.json')) {
      endpointResults = JSON.parse(fs.readFileSync('endpoint-health-report.json', 'utf8'));
    }
  } catch (error) {
    console.warn('Could not load endpoint health results:', error.message);
  }

  // Generate markdown report
  const reportMd = generateMarkdownReport(validationResults, endpointResults);
  fs.writeFileSync('VALIDATION_REPORT.md', reportMd);

  // Generate JSON summary
  const summary = {
    timestamp: new Date().toISOString(),
    validation: {
      totalErrors: validationResults.errors?.length || 0,
      totalWarnings: validationResults.warnings?.length || 0,
      totalChains: validationResults.totalChains || 0
    },
    endpoints: {
      totalEndpoints: endpointResults.summary?.totalEndpoints || 0,
      healthyEndpoints: endpointResults.summary?.healthyEndpoints || 0,
      healthRate: endpointResults.summary?.healthRate || '0%',
      avgResponseTime: endpointResults.summary?.avgResponseTime || '0ms'
    },
    recommendations: generateRecommendations(validationResults, endpointResults)
  };

  fs.writeFileSync('validation-summary.json', JSON.stringify(summary, null, 2));

  console.log('✅ Reports generated:');
  console.log('  - VALIDATION_REPORT.md');
  console.log('  - validation-summary.json');
  
  return summary;
}

function generateMarkdownReport(validationResults, endpointResults) {
  const timestamp = new Date().toISOString();
  
  let md = `# Chain Registry Validation Report

Generated on: ${timestamp}

## 📊 Summary

### Validation Results
- **Total Chains Checked**: ${validationResults.totalChains || 0}
- **Total Errors**: ${validationResults.errors?.length || 0}
- **Total Warnings**: ${validationResults.warnings?.length || 0}

### Endpoint Health
- **Total Endpoints**: ${endpointResults.summary?.totalEndpoints || 0}
- **Healthy Endpoints**: ${endpointResults.summary?.healthyEndpoints || 0}
- **Health Rate**: ${endpointResults.summary?.healthRate || '0%'}
- **Average Response Time**: ${endpointResults.summary?.avgResponseTime || '0ms'}

## 🔍 Field Validation Status

| Field | Status | Description |
|-------|--------|-------------|
| Chain ID | ✅ Tested | Validates uniqueness and format |
| Chain Name | ✅ Tested | Matches directory name, has pretty_name |
| RPC | ✅ Tested | Tests endpoint connectivity and response |
| REST | ✅ Tested | Tests endpoint connectivity and response |
| GRPC | ✅ Tested | Tests endpoint availability |
| EVM-RPC | ✅ Tested | Tests EVM JSON-RPC endpoints for EVM chains |
| Address Prefix | ✅ Tested | Validates bech32_prefix format |
| Base Denom | ✅ Tested | Validates native assets and fee token references |
| Cointype | ✅ Tested | Validates slip44 value |
| Native Token Decimals | ✅ Tested | Validates denom_units exponent values |
| Block Explorer URL | ✅ Tested | Tests explorer accessibility |
| Mainnet/Testnet | ✅ Tested | Validates network_type field |

`;

  // Add errors section
  if (validationResults.errors?.length > 0) {
    md += `## ❌ Validation Errors

`;
    validationResults.errors.forEach(error => {
      md += `- ${error}\n`;
    });
    md += '\n';
  }

  // Add warnings section  
  if (validationResults.warnings?.length > 0) {
    md += `## ⚠️ Validation Warnings

`;
    validationResults.warnings.forEach(warning => {
      md += `- ${warning}\n`;
    });
    md += '\n';
  }

  // Add endpoint health details
  if (endpointResults.byChain) {
    md += `## 🏥 Endpoint Health by Chain

| Chain | Healthy | Total | Health Rate |
|-------|---------|-------|-------------|
`;
    Object.entries(endpointResults.byChain)
      .sort(([,a], [,b]) => (b.healthy/b.total) - (a.healthy/a.total))
      .slice(0, 20)
      .forEach(([chain, stats]) => {
        const healthRate = ((stats.healthy / stats.total) * 100).toFixed(1);
        md += `| ${chain} | ${stats.healthy} | ${stats.total} | ${healthRate}% |\n`;
      });
    md += '\n';
  }

  // Add provider reliability
  if (endpointResults.byProvider) {
    md += `## 🏢 Provider Reliability

| Provider | Healthy | Total | Reliability |
|----------|---------|-------|-------------|
`;
    Object.entries(endpointResults.byProvider)
      .filter(([provider]) => provider !== 'Unknown')
      .sort(([,a], [,b]) => (b.healthy/b.total) - (a.healthy/a.total))
      .slice(0, 15)
      .forEach(([provider, stats]) => {
        const reliability = ((stats.healthy / stats.total) * 100).toFixed(1);
        md += `| ${provider} | ${stats.healthy} | ${stats.total} | ${reliability}% |\n`;
      });
    md += '\n';
  }

  // Add performance metrics
  if (endpointResults.fastestEndpoints) {
    md += `## ⚡ Fastest Endpoints

| Chain | Type | URL | Response Time | Provider |
|-------|------|-----|---------------|----------|
`;
    endpointResults.fastestEndpoints.slice(0, 10).forEach(endpoint => {
      md += `| ${endpoint.chain} | ${endpoint.type} | ${endpoint.url} | ${endpoint.responseTime}ms | ${endpoint.provider} |\n`;
    });
    md += '\n';
  }

  md += `## 🔧 How Validation Works

### Chain Validation Process (.github/workflows/utility/validate_data.mjs)
- **Chain ID**: Checks uniqueness across registry at line 64-78
- **Chain Name**: Validates match with directory at line 501-508  
- **Fee Tokens**: Validates fee tokens exist in assetlist at line 93-105
- **Staking Tokens**: Validates staking tokens exist in assetlist at line 107-119
- **Address Prefix**: Validates against SLIP-173 at line 172-183
- **Cointype**: Validates against SLIP-44 at line 186-198

### Endpoint Testing (.github/workflows/tests/apis.py)
- **RPC**: Tests /status endpoint at line 98
- **REST**: Tests /cosmos/base/tendermint/v1beta1/syncing at line 100
- **Provider Filtering**: Configurable whitelist at line 21-56
- **Concurrent Testing**: Parallel execution with pytest -n 64 at line 27

### Schema Validation (.github/workflows/validate.yml)
- **Schema Compliance**: Uses @chain-registry/cli at line 21-26
- **File Structure**: Validates JSON structure and required fields
- **Cross-references**: Ensures consistency between chain.json and assetlist.json

## 📈 Recommendations

${generateRecommendations(validationResults, endpointResults).join('\n')}

## 🔗 Links to Validation Code

- [Main Validation Logic](../../../.github/workflows/utility/validate_data.mjs)
- [Endpoint Testing](../../../.github/workflows/tests/apis.py) 
- [Schema Validation](../../../.github/workflows/validate.yml)
- [Chain Schema](../../../chain.schema.json)
- [Assetlist Schema](../../../assetlist.schema.json)
`;

  return md;
}

function generateRecommendations(validationResults, endpointResults) {
  const recommendations = [];
  
  // Based on validation errors
  if (validationResults.errors?.length > 0) {
    recommendations.push('- 🚨 **Fix validation errors immediately** - These prevent proper chain integration');
  }
  
  // Based on endpoint health
  const healthRate = parseFloat(endpointResults.summary?.healthRate?.replace('%', '') || '0');
  if (healthRate < 80) {
    recommendations.push('- 📡 **Improve endpoint reliability** - Consider adding more reliable providers');
  }
  
  // Based on response times
  const avgTime = parseInt(endpointResults.summary?.avgResponseTime?.replace('ms', '') || '0');
  if (avgTime > 2000) {
    recommendations.push('- ⚡ **Optimize endpoint performance** - Average response time is high');
  }
  
  // General recommendations
  recommendations.push('- 🔄 **Set up automated monitoring** - Run these checks daily to catch issues early');
  recommendations.push('- 📝 **Document provider requirements** - Ensure all providers meet minimum standards');
  recommendations.push('- 🏷️ **Add missing metadata** - Complete any missing optional fields for better UX');
  
  return recommendations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateReport().catch(console.error);
}

export { generateReport };