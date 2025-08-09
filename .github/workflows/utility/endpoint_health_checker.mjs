// Endpoint Health Checker
// Tests endpoint availability and response times for all chains

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const chainRegistryRoot = "../../..";
const TIMEOUT = 10000; // 10 seconds
const MAX_CONCURRENT = 5; // Limit concurrent requests

class EndpointHealthChecker {
  constructor() {
    this.results = [];
    this.stats = {
      totalEndpoints: 0,
      workingEndpoints: 0,
      failedEndpoints: 0,
      avgResponseTime: 0
    };
  }

  async checkEndpoint(endpoint, type, chainName) {
    const startTime = Date.now();
    let testUrl = endpoint.address;

    // Add appropriate test paths
    switch (type) {
      case 'rpc':
        testUrl += '/status';
        break;
      case 'rest':
        testUrl += '/cosmos/base/tendermint/v1beta1/syncing';
        break;
      case 'evm-http-jsonrpc':
        // For EVM endpoints, we'll make a JSON-RPC call
        break;
      default:
        break;
    }

    try {
      let response;
      
      if (type === 'evm-http-jsonrpc') {
        response = await axios.post(endpoint.address, {
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1
        }, { 
          timeout: TIMEOUT,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        response = await axios.get(testUrl, { 
          timeout: TIMEOUT,
          validateStatus: (status) => status < 500 // Accept 4xx as "working" 
        });
      }

      const responseTime = Date.now() - startTime;
      const isHealthy = response.status === 200 && (
        type === 'evm-http-jsonrpc' ? response.data?.result : response.data
      );

      const result = {
        chain: chainName,
        type,
        url: endpoint.address,
        provider: endpoint.provider || 'Unknown',
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        httpStatus: response.status,
        timestamp: new Date().toISOString()
      };

      if (isHealthy) {
        this.stats.workingEndpoints++;
        console.log(`✅ ${type.toUpperCase()} ${chainName}: ${endpoint.address} (${responseTime}ms) - ${endpoint.provider || 'Unknown'}`);
      } else {
        this.stats.failedEndpoints++;
        console.log(`❌ ${type.toUpperCase()} ${chainName}: ${endpoint.address} - HTTP ${response.status}`);
      }

      this.results.push(result);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.failedEndpoints++;
      
      const result = {
        chain: chainName,
        type,
        url: endpoint.address,
        provider: endpoint.provider || 'Unknown',
        status: 'failed',
        responseTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      console.log(`❌ ${type.toUpperCase()} ${chainName}: ${endpoint.address} - ${error.message}`);
      this.results.push(result);
      return result;
    }
  }

  async checkChainEndpoints(chainPath) {
    const chainName = path.basename(chainPath);
    const chainJsonPath = path.join(chainPath, 'chain.json');

    if (!fs.existsSync(chainJsonPath)) {
      return;
    }

    try {
      const chainData = JSON.parse(fs.readFileSync(chainJsonPath, 'utf8'));
      const apis = chainData.apis || {};
      
      console.log(`\n🔍 Checking endpoints for ${chainName}...`);

      const endpointChecks = [];

      // Check RPC endpoints
      if (apis.rpc) {
        for (const endpoint of apis.rpc) {
          this.stats.totalEndpoints++;
          endpointChecks.push(this.checkEndpoint(endpoint, 'rpc', chainName));
          
          // Limit concurrent requests
          if (endpointChecks.length >= MAX_CONCURRENT) {
            await Promise.allSettled(endpointChecks.splice(0, MAX_CONCURRENT));
          }
        }
      }

      // Check REST endpoints
      if (apis.rest) {
        for (const endpoint of apis.rest) {
          this.stats.totalEndpoints++;
          endpointChecks.push(this.checkEndpoint(endpoint, 'rest', chainName));
          
          if (endpointChecks.length >= MAX_CONCURRENT) {
            await Promise.allSettled(endpointChecks.splice(0, MAX_CONCURRENT));
          }
        }
      }

      // Check GRPC endpoints (basic connectivity test)
      if (apis.grpc) {
        for (const endpoint of apis.grpc) {
          this.stats.totalEndpoints++;
          endpointChecks.push(this.checkEndpoint(endpoint, 'grpc', chainName));
          
          if (endpointChecks.length >= MAX_CONCURRENT) {
            await Promise.allSettled(endpointChecks.splice(0, MAX_CONCURRENT));
          }
        }
      }

      // Check EVM JSON-RPC endpoints
      if (apis['evm-http-jsonrpc']) {
        for (const endpoint of apis['evm-http-jsonrpc']) {
          this.stats.totalEndpoints++;
          endpointChecks.push(this.checkEndpoint(endpoint, 'evm-http-jsonrpc', chainName));
          
          if (endpointChecks.length >= MAX_CONCURRENT) {
            await Promise.allSettled(endpointChecks.splice(0, MAX_CONCURRENT));
          }
        }
      }

      // Wait for remaining checks
      if (endpointChecks.length > 0) {
        await Promise.allSettled(endpointChecks);
      }

    } catch (error) {
      console.error(`Error checking endpoints for ${chainName}: ${error.message}`);
    }
  }

  generateReport() {
    const healthyEndpoints = this.results.filter(r => r.status === 'healthy');
    const unhealthyEndpoints = this.results.filter(r => r.status === 'unhealthy');
    const failedEndpoints = this.results.filter(r => r.status === 'failed');

    if (healthyEndpoints.length > 0) {
      this.stats.avgResponseTime = Math.round(
        healthyEndpoints.reduce((sum, r) => sum + r.responseTime, 0) / healthyEndpoints.length
      );
    }

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalEndpoints: this.stats.totalEndpoints,
        healthyEndpoints: this.stats.workingEndpoints,
        unhealthyEndpoints: unhealthyEndpoints.length,
        failedEndpoints: this.stats.failedEndpoints,
        healthRate: `${((this.stats.workingEndpoints / this.stats.totalEndpoints) * 100).toFixed(1)}%`,
        avgResponseTime: `${this.stats.avgResponseTime}ms`
      },
      details: this.results,
      byChain: this.groupByChain(),
      byProvider: this.groupByProvider(),
      slowestEndpoints: this.getSlowestEndpoints(),
      fastestEndpoints: this.getFastestEndpoints()
    };

    return report;
  }

  groupByChain() {
    const byChain = {};
    this.results.forEach(result => {
      if (!byChain[result.chain]) {
        byChain[result.chain] = { healthy: 0, unhealthy: 0, failed: 0, total: 0 };
      }
      byChain[result.chain][result.status]++;
      byChain[result.chain].total++;
    });
    return byChain;
  }

  groupByProvider() {
    const byProvider = {};
    this.results.forEach(result => {
      if (!byProvider[result.provider]) {
        byProvider[result.provider] = { healthy: 0, unhealthy: 0, failed: 0, total: 0 };
      }
      byProvider[result.provider][result.status]++;
      byProvider[result.provider].total++;
    });
    return byProvider;
  }

  getSlowestEndpoints() {
    return this.results
      .filter(r => r.status === 'healthy')
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 10);
  }

  getFastestEndpoints() {
    return this.results
      .filter(r => r.status === 'healthy')
      .sort((a, b) => a.responseTime - b.responseTime)
      .slice(0, 10);
  }
}

async function main() {
  console.log('🏥 Starting Endpoint Health Check...\n');

  const checker = new EndpointHealthChecker();
  
  // Get list of chain directories
  const excludeDirs = ['_IBC', '_non-cosmos', '_template', '.github', '.git', 'node_modules'];
  
  try {
    const entries = fs.readdirSync(chainRegistryRoot, { withFileTypes: true });
    const chainDirs = entries
      .filter(entry => entry.isDirectory() && !excludeDirs.includes(entry.name))
      .map(entry => entry.name);

    console.log(`Found ${chainDirs.length} chains to check`);

    // Check endpoints for each chain (limit for testing)
    for (const chainDir of chainDirs.slice(0, 10)) {
      const chainPath = path.join(chainRegistryRoot, chainDir);
      await checker.checkChainEndpoints(chainPath);
    }

    // Generate and save report
    const report = checker.generateReport();
    
    console.log('\n📊 Endpoint Health Summary:');
    console.log(`Total Endpoints: ${report.summary.totalEndpoints}`);
    console.log(`Healthy: ${report.summary.healthyEndpoints} (${report.summary.healthRate})`);
    console.log(`Failed: ${report.summary.failedEndpoints}`);
    console.log(`Average Response Time: ${report.summary.avgResponseTime}`);

    fs.writeFileSync('endpoint-health-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Report saved to endpoint-health-report.json');

    // Print summary by chain
    console.log('\n📈 Health by Chain:');
    Object.entries(report.byChain)
      .sort(([,a], [,b]) => (b.healthy/b.total) - (a.healthy/a.total))
      .slice(0, 10)
      .forEach(([chain, stats]) => {
        const healthRate = ((stats.healthy / stats.total) * 100).toFixed(1);
        console.log(`  ${chain}: ${stats.healthy}/${stats.total} (${healthRate}%)`);
      });

  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}