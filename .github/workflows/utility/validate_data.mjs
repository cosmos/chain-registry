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
//     etc.
//

//--FileSystem--
import * as fs from 'fs';
import * as path from 'path';

//--Chain Registry--
import * as chain_reg from './chain_registry.mjs';
const chainRegistryRoot = "../../..";

//--APIs--
const args = process.argv.slice(2);
const NO_API = args.includes('NO_API');
const API_FETCHING = !NO_API;// set to false for local testing, true for GitHub validation

import * as coingecko from './coingecko_data.mjs';


const imageURIs = ["png", "svg"];
const ibcChannelStatuses = ["ACTIVE", "INACTIVE", "CLOSED", "PENDING"];

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

function uriToRelativePath(uri) {
  const parts = uri.split('/');
  return parts.slice(6).join('/');
}

function executionPath(relativePath) {
  return path.join(chainRegistryRoot, relativePath);
}

function existsCaseSensitive(relativePath) {
  let current = chainRegistryRoot; // repo root
  for (const part of relativePath.split('/')) {
    const entries = fs.readdirSync(current);
    if (!entries.includes(part)) {
      return false; // mismatch in case
    }
    current = path.join(current, part);
  }
  return true;
}

function addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg) {

  if (!errorMsgs) {
    console.log("Error Handling Failure at:");
    console.log(`${objectType}, ${checkType}, ${errorNotice}, ${errorMsg}`);
    return;
  }
  if (!errorMsgs[objectType]) errorMsgs[objectType] = {}
  if (!errorMsgs[objectType][checkType]) {
    errorMsgs[objectType][checkType] = {
      checkType: checkType,
      errorNotice: errorNotice,
      instances: []
    }
  }
  errorMsgs[objectType][checkType].instances.push(errorMsg);

}

function setCheckStatus(checks, id, checkType, status) {

  if (!checks) {
    console.log("Check Status Handling Failure at:");
    console.log(`${id}, ${checkType}, ${status}`);
    return;
  }
  const idKey = JSON.stringify(id);
  if (!checks[idKey]) checks[idKey] = {}
  if (!checks[idKey][checkType]) {
    checks[idKey][checkType] = {
      checkType: checkType,
      status: status
    }
  }

}

function getCheckStatus(checks, id, checkType) {

  if (!checks) {
    console.log("Check Status Handling Failure at:");
    console.log(`${id}, ${checkType}`);
    return;
  }
  const idKey = JSON.stringify(id);
  if (!checks[idKey]) return false;
  if (!checks[idKey][checkType]) return false;
  return checks[idKey][checkType].status;

}

//--Chain Checks--

function checkChainNameMatchDirectory(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkChainNameMatchDirectory";
  const errorNotice = "Some files have a chain_name value that doesn't match its directory's name!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  for (const file of chain_reg.files) {
    const fileChainNameValue = chain_reg.getFileProperty(id.chain_name, file, "chain_name");
    if (!fileChainNameValue) { return; }
    if (fileChainNameValue !== id.chain_name) {
      //--Error--
      const errorMsg = `Directory ${id.chain_name}'s ${file} file has chain_name: ${fileChainNameValue}, which is a mismatch!`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      continue;
    }
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkChainIdConflict(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkChainIdConflict";
  const errorNotice = "Some Chains have a 'chain_id' conflict!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--

  // Not concerned by conflicts with 'Killed' chains--could be a hard fork
  const chain_status = chain_reg.getFileProperty(id.chain_name, "chain", "status");
  if (!chain_status || chain_status === "killed") { return; }

  const chain_id = chain_reg.getFileProperty(id.chain_name, "chain", "chain_id");
  if (!chain_id) { return; } // must have a chainId
  if (context.chainIdMap.has(chain_id)) {
    const conflictChain_name = context.chainIdMap.get(chain_id);
    //--Error--
    const errorMsg = `Duplicate chain ID for ${id.chain_name} found! Chain ID ${chain_id} is also claimed by ${conflictChain_name}.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }
  context.chainIdMap.set(chain_id, id.chain_name);

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkChainDirectoryLocation(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkChainDirectoryLocation";
  const errorNotice = "Some Chains have disagreement between directory location vs their defined network_type and/or chain_type!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const networkType = chain_reg.getFileProperty(id.chain_name, "chain", "network_type");
  const networkTypeDirName = chain_reg.networkTypeToDirectoryNameMap.get(networkType);
  const chainType = chain_reg.getFileProperty(id.chain_name, "chain", "chain_type");
  const domain = chainType === "cosmos" ? "cosmos" : "non-cosmos";
  const chainTypeDirName = chain_reg.domainToDirectoryNameMap.get(domain);
  if (networkTypeDirName !== undefined && chainTypeDirName !== undefined) {
    const calculatedDirectoryLocation = path.join(
      chainRegistryRoot,
      networkTypeDirName,
      chainTypeDirName,
      id.chain_name
    );
    const chainDirectoryLocation = chain_reg.chainNameToDirectoryMap.get(id.chain_name);
    const MATCHING_LOCATIONS = calculatedDirectoryLocation === chainDirectoryLocation;

    if (!MATCHING_LOCATIONS) {
      //--Error--
      const errorMsg = `The \\${id.chain_name}\\ directory is either placed in the wrong sub-directory, or has incorrect network type and/or chain type.
network_type: ${networkType}
chain_type: ${chainType}
Calculated directory location: ${calculatedDirectoryLocation}
Actual directory location: ${chainDirectoryLocation}`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkStatus(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkStatus";
  const errorNotice = "Some Chains are missing a status!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  const chainStatuses = ["live", "upcoming", "killed"];

  //--Logic--
  let chain_name = chain_reg.getFileProperty(id.chain_name, "chain", "chain_name"); //just to see if there exists a chain.json file
  if (!chain_name) return; //Skip check is there is no chain.json file
  let chain_status = chain_reg.getFileProperty(id.chain_name, "chain", "status");
  if (!chain_status || !chainStatuses.includes(chain_status)) {
    //--Error--
    const errorMsg = `Chain ${id.chain_name} missing a valid status (Status: ${chain_status})!`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkSlip44(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkSlip44";
  const errorNotice = "Some Live Cosmos Chains are missing Slip44!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  let chain_type = chain_reg.getFileProperty(id.chain_name, "chain", "chain_type");
  if (!chain_type || chain_type !== "cosmos") { return; }
  let chain_status = chain_reg.getFileProperty(id.chain_name, "chain", "status");
  if (!chain_status || chain_status !== "live") { return; }
  let slip44 = chain_reg.getFileProperty(id.chain_name, "chain", "slip44");
  if (slip44 === undefined) {
    //--Error--
    const errorMsg = `Chain ${chain_name} missing slip44!`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkFeeTokenHasDenom(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkFeeTokenHasDenom";
  const errorNotice = "Some Fee Tokens are missing 'denom'!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (!context.fee_token.denom) {
    //--Error--
    const errorMsg = `Fee Token [${id.i}] of chain: ${id.chain_name} does not have 'denom' defined. ${JSON.stringify(context.fee_token)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkFeeTokenInAssetlist(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkFeeTokenInAssetlist";
  const errorNotice = "Some Fee Tokens are not their chain's assetlist!";

  //--Prerequisistes--
  const prerequisites = [
    "checkFeeTokenHasDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (!chain_reg.getAssetProperty(id.chain_name, context.fee_token.denom, "base")) {
    //--Error--
    const errorMsg = `Chain ${id.chain_name} does not have fee token [${id.i}] (${context.fee_token.denom}) defined in its Assetlist.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkFeeTokenGasPrices(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkFeeTokenGasPrices";
  const errorNotice = "Some Fee Tokens have invalid gas prices (minimum/low/average/high)!";

  //--Prerequisistes--
  const prerequisites = [
    "checkFeeTokenHasDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const fixed_min_gas_price = context.fee_token.fixed_min_gas_price;
  const low_gas_price = context.fee_token.low_gas_price;
  const average_gas_price = context.fee_token.average_gas_price;
  const high_gas_price = context.fee_token.high_gas_price;

  if (
    (fixed_min_gas_price && low_gas_price && !(fixed_min_gas_price <= low_gas_price)) ||
    (fixed_min_gas_price && average_gas_price && !(fixed_min_gas_price <= average_gas_price)) ||
    (fixed_min_gas_price && high_gas_price && !(fixed_min_gas_price <= high_gas_price)) ||
    (low_gas_price && average_gas_price && !(low_gas_price <= average_gas_price)) ||
    (low_gas_price && high_gas_price && !(low_gas_price <= high_gas_price)) ||
    (average_gas_price && high_gas_price && !(average_gas_price <= high_gas_price))
  ) {
    //--Error--
    const errorMsg = `Chain ${id.chain_name}'s fee token [${id.i}] (${context.fee_token.denom}) has invalid gas prices defined.
${JSON.stringify(context.fee_token)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkFeeTokens(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkFeeTokens";
  const errorNotice = "Some Chains' Fees are invlaid!";

  //--Prerequisistes--
  const prerequisites = [
    "checkChainNameMatchDirectory"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  let ANY_INVALID = false;
  let fees = chain_reg.getFileProperty(id.chain_name, "chain", "fees");
  for (const [i, fee_token] of (fees?.fee_tokens ?? []).entries()) {

    id.i = i;
    context.fee_token = fee_token;

    ANY_INVALID = !checkFeeTokenHasDenom(id, context, objectType, checks, errorMsgs) || ANY_INVALID;

    ANY_INVALID = !checkFeeTokenInAssetlist(id, context, objectType, checks, errorMsgs) || ANY_INVALID;

    ANY_INVALID = !checkFeeTokenGasPrices(id, context, objectType, checks, errorMsgs) || ANY_INVALID;

    delete id.i;

  }
  if (ANY_INVALID) {
    //--Error--
    const errorMsg = `Chain ${id.chain_name} has invalid fee tokens.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkStakingTokensAreRegistered(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkStakingTokensAreRegistered";
  const errorNotice = "Some Chains' Staking Tokens aren't registered!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  let staking = chain_reg.getFileProperty(id.chain_name, "chain", "staking");
  for (const staking_token of staking?.staking_tokens ?? []) {
    if (!staking_token.denom) {
      //--Error--
      const errorMsg = `One of the staking tokens for chain: ${id.chain_name} does not have 'denom' specified. ${JSON.stringify(staking_token)}`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }
    if (!chain_reg.getAssetProperty(id.chain_name, staking_token.denom, "base")) {
      //--Error--
      const errorMsg = `Chain ${id.chain_name} does not have staking token ${staking_token.denom} defined in its Assetlist.`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

//--Image Checks--

function checkImageURIExistence(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkImageURIExistence";
  const errorNotice = "Some Images do not exist!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (!existsCaseSensitive(uriToRelativePath(id))) {
    //--Error--
    const errorMsg = `Image ${id} does not exist! Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkImageURIFileSize(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkImageURIFileSize";
  const errorNotice = "Some Images are too large!";

  //--Prerequisistes--
  const prerequisites = [
    "checkImageURIExistence"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const maxBytes = 251;
  const stats = fs.statSync(executionPath(uriToRelativePath(id)));
  if (stats.size > maxBytes * 1024) {
    //--Error--
    console.log("SIZE??");
    console.log(`${stats.size}`);
    console.log(`${maxBytes * 1024}`);
    const errorMsg = `Image ${id} is too large! Size: ${stats.size}.
Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function isPNG(relativePath) {
  const filePath = executionPath(relativePath);

  const fd = fs.openSync(filePath, "r"); // open for reading
  const header = Buffer.alloc(8);
  fs.readSync(fd, header, 0, 8, 0); // read first 8 bytes
  fs.closeSync(fd);

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let fileType = "unknown";

  if (header.equals(pngSig)) {
    fileType = "png";
  } else if (header[0] === 0xff && header[1] === 0xd8) {
    fileType = "jpeg";
  } else if (header.toString("ascii", 0, 4) === "GIF8") {
    fileType = "gif";
  } else if (header.toString("ascii", 0, 2) === "BM") {
    fileType = "bmp";
  } else if (header.toString("ascii", 0, 4) === "%PDF") {
    fileType = "pdf";
  } else if (
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WEBP"
  ) {
    fileType = "webp";
  }

  return {
    isPNG: header.equals(pngSig),
    fileType,
  };
}

function getPngDimensions(relativePath) {

  const path = executionPath(relativePath);
  const fd = fs.openSync(path, "r");

  // IHDR comes right after 8-byte signature and 4-byte length + 4-byte type
  const ihdrOffset = 8 + 4 + 4;
  const buffer = Buffer.alloc(8);

  fs.readSync(fd, buffer, 0, 8, ihdrOffset);
  fs.closeSync(fd);

  const width = buffer.readUInt32BE(0);
  const height = buffer.readUInt32BE(4);

  return { width, height };
}

function getSvgDimensions(relativePath) {

  const path = executionPath(relativePath);
  if (!fs.existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const data = fs.readFileSync(path, "utf-8");

  const svgTag = data.match(/<svg\b[^>]*>/i)?.[0];

  // Try width + height attributes
  const widthMatch = svgTag.match(/[\s]width\s*=\s*["']([\d.]+)(px)?["']/i);
  const heightMatch = svgTag.match(/[\s]height\s*=\s*["']([\d.]+)(px)?["']/i);
  if (widthMatch && heightMatch) {
    return {
      width: parseFloat(widthMatch[1]),
      height: parseFloat(heightMatch[1]),
      source: "width/height",
    };
  }

  // Try viewBox first
  const viewBoxMatch = svgTag.match(/viewBox\s*=\s*["']([\d.\s-]+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/);
    if (parts.length === 4) {
      const width = parseFloat(parts[2]);
      const height = parseFloat(parts[3]);
      return { width, height, source: "viewBox" };
    }
  }

  // Nothing reliable found
  return { width: null, height: null, source: "indeterminate" };
}

function isSquareish(dimensions) {
  //console.log(dimensions);
  if (dimensions.width === null || dimensions.height === null) {
    console.log("unkown");
    console.log(dimensions);
  }
  if (dimensions.width === null || dimensions.height === null) return true;
  return Math.abs(dimensions.width - dimensions.height) <= 1;
}

function analyzeSVG(relativePath) {
  const path = executionPath(relativePath);
  if (!fs.existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const data = fs.readFileSync(path, 'utf-8');

  // Count <path> tags
  const pathCount = (data.match(/<path[\s>]/gi) || []).length;
  const rectCount = (data.match(/<rect[\s>]/gi) || []).length;
  const circleCount = (data.match(/<circle[\s>]/gi) || []).length;
  const polygonCount = (data.match(/<polygon[\s>]/gi) || []).length;
  const polylineCount = (data.match(/<polyline[\s>]/gi) || []).length;
  const shapesCount = pathCount + rectCount + circleCount + polygonCount + polylineCount;

  // Count <image> tags
  const imageCount = (data.match(/<image[\s>]/gi) || []).length;

  // Count masks
  const maskMatches = data.match(/<mask[\s\S]*?<\/mask>/gi) || [];
  let maskCommaCount = 0;
  maskMatches.forEach(mask => {
    // Count commas inside <path d="..."> attributes within the mask
    const pathDMatches = mask.match(/<path[^>]*d="([^"]+)"/gi) || [];
    pathDMatches.forEach(dAttr => {
      // Extract the d attribute string
      const dMatch = dAttr.match(/d="([^"]+)"/i);
      if (dMatch && dMatch[1]) {
        // Count commas in this path
        maskCommaCount += (dMatch[1].match(/,/g) || []).length;
      }
    });
  });
  // Count clipPaths as well
  const clipPathMatches = data.match(/<clipPath[\s\S]*?<\/clipPath>/gi) || [];
  clipPathMatches.forEach(clip => {
    const pathDMatches = clip.match(/<path[^>]*d="([^"]+)"/gi) || [];
    pathDMatches.forEach(dAttr => {
      const dMatch = dAttr.match(/d="([^"]+)"/i);
      if (dMatch && dMatch[1]) {
        maskCommaCount += (dMatch[1].match(/,/g) || []).length;
      }
    });
  });

  return { shapesCount, imageCount, maskCommaCount };
}

function checkSVGShapeCount(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkSVGShapeCount";
  const errorNotice = "Some SVGs have too many shapes!";

  //--Prerequisistes--
  const prerequisites = [
    "checkImageURIExistence"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (context.svgAnalysis.shapesCount > 1000) {
    //--Error--
    const errorMsg = `SVG ${id} has too many shapes! Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkSVGEmbeddedRasterImage(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkSVGEmbeddedRasterImage";
  const errorNotice = "Some SVGs may have an embedded raster image!";

  //--Prerequisistes--
  const prerequisites = [
    "checkImageURIExistence"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const svgSize = fs.statSync(executionPath(context.relativePath)).size;

  //Compare with PNG <-- remove this once image objects are limited to a single image file
  if (context.image.png) {
    const pngSize = fs.statSync(executionPath(uriToRelativePath(context.image.png))).size;
    if (
      context.svgAnalysis.imageCount > 0 //at least one image object
      && svgSize > pngSize
      && svgSize > 25000) {
      //--Error--
      const errorMsg = `SVG ${id} is larger (${svgSize}) than corresponding PNG (indicating likelihood of embedded raster images)!
Referenced at: ${JSON.stringify(context.image.references)}`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }
  }

  //Check for <image> while lacking supplementry elements
  if (
    context.svgAnalysis.imageCount > 0 //at least one image object
    && context.svgAnalysis.shapesCount < 3
    && context.svgAnalysis.maskCommaCount < 3
    && svgSize > 25000 // over 25kB signals that the embedded image(s) may be large
  ) {
    //--Error--
    const errorMsg = `SVG ${id} very few shapes and at least one image element (indicating likelihood of embedded raster images)!
Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  //Check for large svgs
  /*if (
    context.svgAnalysis.imageCount > 0 //at least one image object
    && svgSize > 50000 // over 50kB signals that the embedded image(s) may be large
  ) {
    //--Error--
    const errorMsg = `SVG ${id} is unusualy large (indicating likelihood of embedded raster images)!
Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }*/

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkSVGDimensions(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkSVGDimensions";
  const errorNotice = "Some SVGs are not square!";

  //--Prerequisistes--
  const prerequisites = [
    "checkImageURIExistence"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const dimensions = getSvgDimensions(context.relativePath);
  if (!isSquareish(dimensions)) {
    //--Error--
    const errorMsg = `SVG ${id} is not square! Width: ${dimensions.width}, Height: ${dimensions.height}.
Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkSVG(id, context, objectType, checks, errorMsgs) {

  context.relativePath = uriToRelativePath(context.image.svg);
  context.svgAnalysis = analyzeSVG(context.relativePath);

  checkSVGShapeCount(id, context, objectType, checks, errorMsgs);
  checkSVGEmbeddedRasterImage(id, context, objectType, checks, errorMsgs);
  checkSVGDimensions(id, context, objectType, checks, errorMsgs);

}

function checkIsPNG(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkIsPNG";
  const errorNotice = "Some PNGs are not authentic!";

  //--Prerequisistes--
  const prerequisites = [
    "checkImageURIExistence"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const isPNGFile = isPNG(context.relativePath);
  if (!isPNGFile.isPNG) {
    //--Error--
    const errorMsg = `PNG ${id} is not authentic! ${isPNGFile.fileType}
Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}


function checkPNGDimensions(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkPNGDimensions";
  const errorNotice = "Some PNGs are not square!";

  //--Prerequisistes--
  const prerequisites = [
    "checkImageURIExistence",
    "checkIsPNG"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const dimensions = getPngDimensions(context.relativePath);
  if (!isSquareish(dimensions)) {
    //--Error--
    const errorMsg = `PNG ${id} is not square! Width: ${dimensions.width}, Height: ${dimensions.height}.
Referenced at: ${JSON.stringify(context.image.references)}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkPNG(id, context, objectType, checks, errorMsgs) {

  context.relativePath = uriToRelativePath(context.image.png);

  checkIsPNG(id, context, objectType, checks, errorMsgs);
  checkPNGDimensions(id, context, objectType, checks, errorMsgs);

}

function checkAllImages(context, objectType, checks, errorMsgs) {

  context.allImages?.forEach(image => {
    context.image = image;
    for (const uriType of imageURIs) {
      if (!image[uriType]) continue;
      const id = image[uriType];
      checkImageURIExistence(id, context, objectType, checks, errorMsgs);
      checkImageURIFileSize(id, context, objectType, checks, errorMsgs);
      if (uriType === "png") checkPNG(id, context, objectType, checks, errorMsgs);
      else if (uriType === "svg") checkSVG(id, context, objectType, checks, errorMsgs);
    }
  });

}

async function checkChainDirectoryImageUsage(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkChainDirectoryImageUsage";
  const errorNotice = "Some Images are not referenced by any chain or asset!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const chainDirectory = (chain_reg.chainNameToDirectoryMap.get(id.chain_name));
  const imagesDirectoryName = "images";

  try {
    for (const image of await fs.promises.readdir(path.join(chainDirectory, imagesDirectoryName))) {
      const uriBase = "https://raw.githubusercontent.com/cosmos/chain-registry/master/";
      const chainDirectoryFromRoot = path.join(
        path
          .normalize(chainDirectory)
          .split(path.sep)
          .filter(segment => segment !== '..' && segment !== '')
          .join(path.sep)
      );
      const imageUri = new URL(path.join(chainDirectoryFromRoot, imagesDirectoryName, image), uriBase).toString();

      const IMAGE_HAS_REFERENCE = context.allImages.find(imageObject => {
        return imageObject.png === imageUri || imageObject.svg === imageUri;
      });

      if (!IMAGE_HAS_REFERENCE) {
        //--Error--
        const errorMsg = `Image ${image} within ${id.chain_name}'s /images/ directory is not referenced!`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        //setCheckStatus(checks, id, checkType, false);
        continue;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
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

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }

  return true;
}

//--Asset Checks--

function checkUniqueBaseDenom(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkUniqueBaseDenom";
  const errorNotice = "Some Asset Base Denoms are not unique!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (context.base_denoms.includes(id.base_denom)) {

    //--Error--
    const errorMsg = `Base (denom) already registered: ${id.chain_name}, ${id.base_denom}, ${context.asset.symbol}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);

    return false;

    //throw new Error(`Base (denom) already registered: ${chain_name}, ${asset.base}, ${asset.symbol}.`);
  } else {

    context.base_denoms.push(id.base_denom);
    setCheckStatus(checks, id, checkType, true);
    return true;

  }

}

function checkTypeAsset(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkTypeAsset";
  const errorNotice = "Some Asset Types are invalid!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (!context.asset.type_asset) {

    //--Error--
    const errorMsg = `Type_asset not specified: ${id.chain_name}, ${id.base_denom}, ${context.asset.symbol}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  let expectedType_asset;
  const type_asset = context.asset.type_asset;
  const base = id.base_denom;

  if (base.startsWith("ibc/") && type_asset !== "ics20") expectedType_asset = "ics20";
  else if (base.startsWith("cw20")) {
    if (id.chain_name.startsWith("secret")) {
      if (type_asset !== "snip20" && type_asset !== "snip25") expectedType_asset = "snip20";
    } else {
      if (type_asset !== "cw20") expectedType_asset = "cw20";
    }
  }
  else if (
    base.startsWith("0x") &&
    !base.includes("::") &&
    !base.includes("00000") &&
    type_asset !== "erc20"
  ) expectedType_asset = "erc20";

  if (expectedType_asset) {

    //--Error--
    const errorMsg = `Incorrect asset::type_asset (expected: ${expectedType_asset}; actual: ${type_asset}) for: ${id.chain_name}, ${id.base_denom}, ${context.asset.symbol}`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);

    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

async function checkIbcDenomAccuracy(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkIbcDenomAccuracy";
  const errorNotice = "Some IBC Assets are improperty defined!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom",
    "checkTypeAsset"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (context.asset.type_asset === "ics20") {
    if (!context.asset.traces) {
      //--Error--
      const errorMsg = `Trace of ${id.chain_name}, ${id.base_denom} not found for ics20 asset (where it is required).`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }
    const path = context.asset.traces[context.asset.traces.length - 1]?.chain?.path;
    if (!path) {
      //--Error--
      const errorMsg = `Path not defined for ${id.chain_name}, ${id.base_denom}.`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }
    const ibcHash = await chain_reg.calculateIbcHash(path);
    if (ibcHash !== id.base_denom) {
      //--Error--
      const errorMsg = `IBC Denom (SHA256 Hash) of ${path} does not match ${id.chain_name}, ${id.base_denom}.`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkDenomUnits(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkDenomUnits";
  const errorNotice = "Some Asset::Denom Units are incorrect!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const base = id.base_denom;
  const display = context.asset.display;
  let VALID_BASE_UNIT;
  let VALID_DISPLAY_UNIT;
  context.asset.denom_units?.forEach((denom_unit) => {

    let denom_and_aliases = [];
    denom_and_aliases.push(denom_unit.denom);
    denom_unit.aliases?.forEach((alias) => {
      if (denom_and_aliases.includes(alias)) { return; }
      denom_and_aliases.push(alias);
    });

    //find base unit
    if (denom_and_aliases.includes(base)) {
      if (denom_unit.exponent !== 0) {
        //--Error--
        const errorMsg = `Base denomination ${base} is not defined as having 0 exponent at: ${id.chain_name}, ${id.base_denom}.`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        setCheckStatus(checks, id, checkType, false);
        return false;
      }
      if (VALID_BASE_UNIT) {
        //--Error--
        const errorMsg = `Base denomination ${ base } refers to multiple denom_units at: ${id.chain_name}, ${id.base_denom}.`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        setCheckStatus(checks, id, checkType, false);
        return false;
      }
      VALID_BASE_UNIT = true;
    }

    //find display unit
    if (display) {
      if (denom_and_aliases.includes(display)) {
        if (VALID_DISPLAY_UNIT) {
          //--Error--
          const errorMsg = `Display denomination ${display} refers to multiple denom_units at: ${id.chain_name}, ${id.base_denom}.`;
          addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
          setCheckStatus(checks, id, checkType, false);
          return false;
        }
        VALID_DISPLAY_UNIT = true;
      }
    }

    //check if IBC hashes contain lowercase letters
    denom_and_aliases.forEach((denom) => {
      if (!denom.startsWith("ibc/")) { return; }
      const substring = denom.substring(4);
      if (substring.toUpperCase() !== substring) {
        //--Error--
        const errorMsg = `Denom ${denom} is an IBC hash denomination, yet contains lowercase letters after "ibc/" at: ${id.chain_name}, ${id.base_denom}.`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        setCheckStatus(checks, id, checkType, false);
        return false;
      }
    });

  });

  if (!VALID_BASE_UNIT) {
    //--Error--
    const errorMsg = `Base denomination ${base} is not defined as a denom_unit at: ${id.chain_name}, ${id.base_denom}.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }
  if (!VALID_DISPLAY_UNIT) {
    //--Error--
    const errorMsg = `Display denomination ${display} is not defined as a denom_unit at: ${id.chain_name}, ${id.base_denom}.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkDecimals(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkDecimals";
  const errorNotice = "Some IBC-transferred Assets have the wrong amount of decimal places/exponent!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom",
    "checkDenomUnits"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  const ibcTypes = [
    "ibc",
    "ibc-cw20",
    "ibc-bridge"
  ];

  //--Logic--
  const traces = context.asset.traces;
  if (traces && traces.length) {
    const lastTrace = traces[traces.length - 1];
    if (ibcTypes.includes(lastTrace.type)) {
      const decimals = chain_reg.getAssetDecimals(id.chain_name, id.base_denom);
      const sourceAssetDecimals = chain_reg.getAssetDecimals(lastTrace.counterparty?.chain_name, lastTrace.counterparty?.base_denom);
      if (decimals == undefined || decimals !== sourceAssetDecimals) {
        //--Error--
        const errorMsg = `Decimals: ${decimals} for IBC-transferred asset: ${id.chain_name}, ${id.base_denom}
doesn't match the decimals (${sourceAssetDecimals}) for its source assset: ${lastTrace.counterparty?.chain_name}, ${lastTrace.counterparty?.base_denom}.`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        setCheckStatus(checks, id, checkType, false);
        return false;
      }
    }
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkSymbol(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkSymbol";
  const errorNotice = "Some Asset Symbols are using invalid characters!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const regexRequirement = /^[a-zA-Z0-9._-]+$/i;
  if (!regexRequirement.test(context.asset.symbol)) {
    //--Error--
    const errorMsg = `Symbol: ${context.asset.symbol} of asset ${id.chain_name}, ${id.base_denom} is invalid.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkTraceCounterpartyIsValid(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkTraceCounterpartyIsValid";
  const errorNotice = "Some Asset::Traces[]::Counterparties are invalid!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const trace = context.trace;
  let counterpartyBase = chain_reg.getAssetProperty(trace.counterparty.chain_name, trace.counterparty.base_denom, "base");
  if (!counterpartyBase) {
    //--Error--
    const errorMsg = `Trace [${id.i}] of ${id.chain_name}, ${id.base_denom} makes invalid reference to ${trace.counterparty.chain_name}, ${trace.counterparty.base_denom}.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }
  if (id.base_denom === trace.counterparty.base_denom && id.chain_name === trace.counterparty.chain_name) {
    //--Error--
    const errorMsg = `Trace [${id.i}] of ${id.chain_name}, ${id.base_denom} makes reference to self.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkIBCTraceChannelAccuracy(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkIBCTraceChannelAccuracy";
  const errorNotice = "Some Assets' IBC Channels are incorrect!";

  //--Prerequisistes--
  const prerequisites = [
    "checkTraceCounterpartyIsValid"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const base = context.asset.base;
  //if (!context.asset.traces || context.asset.traces.length === 0) { return; }

  //const lastTrace = context.asset.traces?.[context.asset.traces.length - 1];
  const lastTrace = context.trace;
  if (lastTrace.type !== "ibc" && lastTrace.type !== "ibc-cw20") { return; }

  // Sort chains alphabetically
  let list = [id.chain_name, lastTrace.counterparty.chain_name].sort();
  let chain1 = { chain_name: list[0] };
  let chain2 = { chain_name: list[1] };


  // Determine which chain is the counterparty
  let chain, counterparty;
  if (id.chain_name === chain1.chain_name) {
    chain = chain1;
    counterparty = chain2;
  } else {
    chain = chain2;
    counterparty = chain1;
  }

  // Get the IBC channels for these two chains
  const channels = chain_reg.getIBCFileProperty(chain1.chain_name, chain2.chain_name, "channels");

  if (!channels) {
    //--Error--
    const errorMsg = `Missing IBC connection registration! (To ${lastTrace.counterparty.chain_name} from ${id.chain_name} at ${base})`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
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
    //--Error--
    const errorMsg = `No matching IBC-specific channel found! (To ${lastTrace.counterparty.chain_name} from  ${id.chain_name} at ${base})`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
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
    //--Error--
    const errorMsg = `Trace [${id.i}] of ${id.chain_name}, ${base} makes reference to IBC channels not registered. (
${lastTrace.counterparty.channel_id}, ${counterparty.channel_id}
${lastTrace.chain.channel_id}, ${chain.channel_id}
)`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkWrappedTrace(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkWrappedTrace";
  const errorNotice = "Some 'wrapped' Asset::Traces[] are invalid!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const WRAPPED_TRACE_TYPE = "wrapped";
  if (context.trace.type !== WRAPPED_TRACE_TYPE) return true;
  const destinationChainName
    = context.asset.traces.length > Number(id.i) + 1
    ? context.asset.traces[Number(id.i) + 1]?.counterparty?.chain_name
    : id.chain_name;

  if (
    context.trace.type === WRAPPED_TRACE_TYPE               //is wrapped
      &&
    context.trace.counterparty.chain_name !== destinationChainName //must come from the same chain
  ) {
    //--Error--
    const errorMsg = `Trace [${id.i}] of ${id.chain_name}, ${id.base_denom} is defined as type: '${WRAPPED_TRACE_TYPE}',
but the destination asset (on: ${context.trace.counterparty.chain_name}) isn't issued on the same chain as the counterparty asset (issued on: ${destinationChainName}).`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkTraces(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkTraces";
  const errorNotice = "Some Asset Traces are invalid!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  let ANY_INVALID = false;
  for (const i in context.asset.traces) {

    id.i = i;
    context.trace = context.asset.traces[i];

    //check counterparty pointers of traces
    ANY_INVALID = !checkTraceCounterpartyIsValid(id, context, objectType, checks, errorMsgs) || ANY_INVALID;

    //check wrapped traces for same chain counterparty
    ANY_INVALID = !checkWrappedTrace(id, context, objectType, checks, errorMsgs) || ANY_INVALID;

    //only for last Trace...
    if (i === context.asset.traces.length - 1) {
      //check IBC counterparty channel accuracy
      ANY_INVALID = !checkIBCTraceChannelAccuracy(id, context, objectType, checks, errorMsgs) || ANY_INVALID;
    }

    delete id.i;

  }

  if (ANY_INVALID) {
    //--Error--
    const errorMsg = `Asset: ${id.chain_name}, ${id.base_denom} has invalid traces.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkCoingeckoId_in_State(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkCoingeckoId_in_State";
  const errorNotice = "Some Assets' Coingecko IDs are not in State!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (!coingecko.state?.coingecko_id_groups) { return true; }
  const coingecko_id = context.asset.coingecko_id;
  const chain_asset_pair = {
    chain_name: id.chain_name,
    asset: context.asset
  }
  if (!coingecko_id) { return true; }

  //find the object with this coingecko ID in the state file
  const coingeckoIdGroup = coingecko.state?.coingecko_id_groups?.find(group => group.coingecko_id === coingecko_id);
  if (!coingeckoIdGroup) {
    //--Error--
    const errorMsg = `State file missing Coingecko ID: ${coingecko_id}, registered for asset: ${id.chain_name}::${id.base_denom}.`;
    //addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    context.assets_cgidNotInState.push(chain_asset_pair);
    return false;
  }

  //see if state's coingecko group has this asset listed (bool)
  const assetExists = coingeckoIdGroup.assets.some(
    cgAsset => cgAsset.chain_name === id.chain_name && cgAsset.base_denom === id.base_denom
  );
  //if not, log so
  if (!assetExists) {
    //--Error--
    const errorMsg = `Asset ${id.chain_name}::${id.base_denom} is not listed among the assets for ID: ${coingecko_id} in the Coingecko state file.`;
    //addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    context.assets_cgidNotInState.push(chain_asset_pair);
    console.log(id.base_denom);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkCoingeckoIdAssetsShareOrigin(context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkCoingeckoIdAssetsShareOrigin";
  const errorNotice = "Some unrelated Assets share a CoinGecko ID! (define their relationship using 'traces')";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (context.assets_cgidNotInState.length <= 0) { return true; }

  let coingeckoIdGroupsToCheck = [];

  context.assets_cgidNotInState.forEach((chain_asset_pair) => {

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

    let cgidGroupOriginAsset = coingeckoIdGroup.originAsset ?? coingecko.getCoingeckoIdGroupOriginAsset(coingeckoIdGroup);

    coingeckoIdGroup.assets.forEach((asset) => {

      const originAsset = chain_reg.getOriginAsset(
        asset.chain_name,
        asset.base_denom,
        coingecko.traceTypesCoingeckoId
      );

      if (!cgidGroupOriginAsset) {
        cgidGroupOriginAsset = originAsset;
        return;
      }

      if (!deepEqual(cgidGroupOriginAsset, originAsset)) {

        //--Error--
        const errorMsg = `Within Coingecko Id Group: '${coingeckoIdGroup.coingecko_id}'
  Origin (${originAsset.chain_name}, ${originAsset.base_denom}) of Asset: ${asset.chain_name}, ${asset.base_denom}
  does not match origin: ${cgidGroupOriginAsset.chain_name}, ${cgidGroupOriginAsset.base_denom}.`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        setCheckStatus(
          checks,
          {
            chain_name: asset.chain_name,
            base_denom: asset.base_denom
          },
          checkType,
          false
        );
        return false;
      }

      setCheckStatus(
        checks,
        {
          chain_name: asset.chain_name,
          base_denom: asset.base_denom
        },
        checkType,
        true
      );
      return true;
          
    });

    
  });

  

}

async function checkCoingeckoId_in_API(context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkCoingeckoId_in_API";
  const errorNotice = "Some Coingecko IDs are not found in the API result!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  
  //Abort if we already know that non-mainnet assets have coingecko IDs.
  if (context.assets_cgidAssetNotMainnet.length > 0) {
    console.log(context.assets_cgidAssetNotMainnet.length);
    throw new Error(`CoinGecko IDs  may only be registered to mainnet assets.`);
  }
  //Currently unused ^

  //Abort if there are no new CGIDs to check
  if (!context.assets_cgidNotInState.length) { return; }
  
  if (API_FETCHING) {
    await coingecko.fetchCoingeckoData(coingecko.coingeckoEndpoints.coins_list);
    if (!coingecko.api_response) {
      console.log("No CoinGecko API Response");
      return;
    }
  }

  context.assets_cgidNotInState.forEach((chain_asset_pair) => {

    const coin = coingecko.api_response?.[coingecko.coingeckoEndpoints.coins_list.name]?.find(
      apiObject => apiObject.id === chain_asset_pair.asset.coingecko_id
    );
    if (!coin) {
      //--Error--
      const errorMsg = `Error: Coingecko ID: ${chain_asset_pair.asset.coingecko_id} at ${chain_asset_pair.chain_name}, ${chain_asset_pair.asset.base} is not in the Coingecko API result.`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(
        checks,
        {//id
          chain_name: chain_asset_pair.chain_name,
          base_denom: chain_asset_pair.asset.base
        },
        checkType,
        false
      );
      return false;
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

function checkImageSyncIsValid(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkImageSyncIsValid";
  const errorNotice = "Some Image Sync References are invalid!";

  //--Prerequisistes--
  const prerequisites = [
    "checkUniqueBaseDenom"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  if (context.asset.images) {
    for (const image of context.asset.images) {

      if (!image.image_sync) { return; }

      //origin assets can't use image sync
      if (!context.asset.traces) {
        const chainStatus = chain_reg.getFileProperty(id.chain_name, "chain", "status");
        if (!chainStatus || chainStatus === "live") {
          //--Error--
          const errorMsg = `Image Sync Pointer used for ${id.chain_name}, ${id.base_denom}, but using image sync requires traces.`;
          addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
          setCheckStatus(checks, id, checkType, false);
          return false;
        }
      }

      let base = chain_reg.getAssetProperty(image.image_sync.chain_name, image.image_sync.base_denom, "base");
      if (!base) {
        //--Error--
        const errorMsg = `Image Sync Pointer of ${id.chain_name}, ${id.base_denom} makes invalid reference to ${image.image_sync.chain_name}, ${image.image_sync.base_denom}.`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        setCheckStatus(checks, id, checkType, false);
        return false;
      }
      if (id.base_denom === image.image_sync.base_denom && id.chain_name === image.image_sync.chain_name) {
        //--Error--
        const errorMsg = `Image_sync of ${id.chain_name}, ${id.base_denom} makes reference to self.`;
        addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
        setCheckStatus(checks, id, checkType, false);
        return false;
      }
    }
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function pushLogoURIs_to_Images(images, logo_URIs) {

  if (!logo_URIs) return;
  for (const image of images) {
    for (const uri of imageURIs) {
      if (image[uri] && image[uri] === logo_URIs[uri]) {
        return;
      }
    }
  }
  images.push(logo_URIs);
  
}

function addImageObject(id, context) {

  let newImage = context.image;
  if (!context.allImages) context.allImages = [];
  let detectedImage = context.allImages.find(existingImage => {
    return existingImage.png === newImage.png && existingImage.svg === newImage.svg;
  });
  const idCopy = { ...id }; // make a shallow copy of id
  if (detectedImage) {
    detectedImage.references.push(idCopy);
  } else {
    newImage.references = [];
    newImage.references.push(idCopy);
    context.allImages.push(newImage);
  }

}

function checkImageReference(id, context, objectType, checks, errorMsgs) {

  let ANY_URI_MISSING = false;
  for (const uri of imageURIs) {//look at both png and svg
    if (!context.image[uri]) continue;
    context.uri = context.image[uri];
    ANY_URI_MISSING = !checkImageURIExistence(id, context, objectType, checks, errorMsgs) || ANY_URI_MISSING;
  }
  if (!ANY_URI_MISSING) {
    addImageObject(id, context);
  }
}

function reportErrors(errorMsgs) {

  let ERRORS_DETECTED = false;

  Object.values(errorMsgs).forEach(errorCategory => {
    if (!errorCategory.instance || errorCategory.instances.length <= 0) return;
    ERRORS_DETECTED = true;
    console.log(errorCategory.notice);
    errorCategory.instances.forEach(instance => {
      console.log(instance);
    });
    console.log(`Count: ${errorCategory.instances.length}`);
  });

  Object.values(errorMsgs).forEach(objectType => {
    Object.values(objectType).forEach(checkType => {
      if (!checkType.instances || checkType.instances?.length <= 0) return;
      ERRORS_DETECTED = true;
      console.log(`${checkType.errorNotice}: ${checkType.instances.length}`);
      checkType.instances.forEach(instance => {
        console.log(instance);
      });
      console.log(`${checkType.errorNotice}: ${checkType.instances.length}`);
    });
  });

  //Final throw (at least one error detected)
  if (ERRORS_DETECTED) {
    throw new Error(`Some data is invalid! (See console logs)`);
  }

}

export async function validate_chains(errorMsgs) {

  //get Chain Names
  const chainNames = chain_reg.getChains();

  //load coingecko state
  await coingecko.loadCoingeckoState();
  if (!coingecko.state) {
    console.log("Failed to load Coingecko State.");
  }

  let checks = {};
  let context = {};
  context.chainIdMap = new Map();
  context.assets_cgidNotInState = [];
  context.assets_cgidAssetNotMainnet = [];//unused

  //iterate each chain
  for (const chain_name of chainNames) {

    const objectType = "Chain";
    const id = {
      chain_name: chain_name
    }

    //check if chain_name matches directory name
    checkChainNameMatchDirectory(id, context, objectType, checks, errorMsgs);

    //check if chain_id is registered by another chain
    checkChainIdConflict(id, context, objectType, checks, errorMsgs);

    //check chain directory location based on network type and chain type
    checkChainDirectoryLocation(id, context, objectType, checks, errorMsgs);

    //check chain status
    checkStatus(id, context, objectType, checks, errorMsgs);

    //check for slip44
    checkSlip44(id, context, objectType, checks, errorMsgs);

    //check fee_tokens
    checkFeeTokens(id, context, objectType, checks, errorMsgs);

    //check if all staking tokens are registered
    checkStakingTokensAreRegistered(id, context, objectType, checks, errorMsgs);
    
    //--Validate Images--
    let logo_URIs = chain_reg.getFileProperty(chain_name, "chain", "logo_URIs");
    let imageReferences = chain_reg.getFileProperty(chain_name, "chain", "images") || [];
    pushLogoURIs_to_Images(imageReferences, logo_URIs);
    for (const key in imageReferences) {
      id.key = key;
      context.image = imageReferences[key];
      addImageObject(id, context);
    }
    delete id.key;

    //ensure that and version properties in codebase are also defined in the versions file.
    //compare_CodebaseVersionData_to_VersionsFile(chain_name);
    //this way removed because version data can now just be recorded in the chain.json file
    //version data recorded in the versions file will be overwitten by what's in codebase

    //get chain's network Type (mainet vs testnet vs...)
    //const chainNetworkType = chain_reg.getFileProperty(chain_name, "chain", "network_type");

    //get chain's assets
    const chainAssets = chain_reg.getFileProperty(chain_name, "assetlist", "assets");

    context.base_denoms = [];
    //iterate each asset
    for (const asset of chainAssets) {

      const objectType = "Asset";
      id.base_denom = asset.base;
      context.asset = asset;

      //check that base denom is unique within the assetlist
      checkUniqueBaseDenom(id, context, objectType, checks, errorMsgs);

      //require type_asset
      checkTypeAsset(id, context, objectType, checks, errorMsgs);

      //check ibc denom accuracy
      await checkIbcDenomAccuracy(id, context, objectType, checks, errorMsgs);

      //check denom units
      checkDenomUnits(id, context, objectType, checks, errorMsgs);

      //check decimals for IBC-transferred assets
      checkDecimals(id, context, objectType, checks, errorMsgs);

      //check symbol
      checkSymbol(id, context, objectType, checks, errorMsgs);

      //check traces
      checkTraces(id, context, objectType, checks, errorMsgs);

      //check that coingecko IDs are in the state
      checkCoingeckoId_in_State(id, context, objectType, checks, errorMsgs);

      //Update: We no longer require that coingecko ids be registered to mainnet assets only.
      //  : this is because chains and be bulk copy-and-pasted including coingecko ids
      //  : testnet assets with coingecko_id must have relationship defined to mainnet counterpart.
      //checkCoingeckoIdMainnetAssetsOnly(chain_name, asset, chainNetworkType, context.assets_cgidAssetNotMainnet);

      //check image_sync pointers of images
      checkImageSyncIsValid(id, context, objectType, checks, errorMsgs);

      //--Validate Images--
      let imageReferences = asset.images || [];
      pushLogoURIs_to_Images(imageReferences, asset.logo_URIs);
      for (const key in imageReferences) {
        const objectType = "Image";
        id.key = key
        context.image = imageReferences[key];
        addImageObject(id, context);
      }
      delete id.key;

    }
    delete id.base_denom;

  }

  //check that new coingecko IDs are in the API
  await checkCoingeckoId_in_API(context, "Asset", checks, errorMsgs);

  //check that assets with a newly defined CGID have the same origin asset as other assets that share the same CGID
  checkCoingeckoIdAssetsShareOrigin(context, "Asset", checks, errorMsgs);

  checkAllImages(context, "Image", checks, errorMsgs);

  //check that all image files are referenced as an image by a chain or asset
  await Promise.all(
    chainNames.map(
      chain_name => {
        const id = { chain_name: chain_name };
        return checkChainDirectoryImageUsage(id, context, "Chain", checks, errorMsgs);
      }
    )
  );
  
}

function checkIbcChannelStatus(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkIbcChannelStatus";
  const errorNotice = "Some IBC Channels have an Invalid Status!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const ibcChannelStatus = context.channel.tags?.status;
  if (ibcChannelStatus && !ibcChannelStatuses.includes(ibcChannelStatus)) {
    //--Error--
    const errorMsg = `Status "${ibcChannelStatus}" of IBC Channel [${id.ibcChannel}] of IBC Connection: ${id.ibcConnection} is invalid.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkIbcChainName(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkIbcChainName";
  const errorNotice = "Some IBC Connections refer to unregistered Chains!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const ibcChain_lookupChainName = chain_reg.getFileProperty(context.ibcChain.chain_name, "chain", "chain_name");
  if (!ibcChain_lookupChainName) {
    //--Error--
    const errorMsg = `Chain Name ${context.ibcChain.chain_name} defined under ${id.chainNumber} of IBC Connection: ${id.ibcConnection} is not registered.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkIbcChainId(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkIbcChainIds";
  const errorNotice = "Some IBC Connections don't have the correct chain_id defined!";

  //--Prerequisistes--
  const prerequisites = [
    "checkIbcChainName"
  ];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const ibcChain_chainId = context.ibcChain.chain_id;
  const ibcChain_lookupChainId = chain_reg.getFileProperty(context.ibcChain.chain_name, "chain", "chain_id");
  if (!ibcChain_chainId || ibcChain_chainId !== ibcChain_lookupChainId) {
    //--Error--
    const errorMsg = `Chain ID ${ibcChain_chainId} defined under ${id.chainNumber} of IBC Connection: ${id.ibcConnection} is incorrect.
chain_name: ${context.ibcChain.chain_name} corresponds to chain_id ${ibcChain_lookupChainId} in its chain.json.`;
    addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
    setCheckStatus(checks, id, checkType, false);
    return false;
  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function checkNumPreferredDefaultChannels(id, context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkNumPreferredDefaultChannels";
  const errorNotice = "Some IBC Connections more than 1 default (transfer/transfer) IBC Channel with no clear preference!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  //--Logic--
  const mainnetNetworkType = "mainnet";
  const CHAIN_1_IS_MAINNET = chain_reg.getFileProperty(context.ibcConnection.chain_1.chain_name, "chain", "network_type") === mainnetNetworkType;
  const CHAIN_2_IS_MAINNET = chain_reg.getFileProperty(context.ibcConnection.chain_2.chain_name, "chain", "network_type") === mainnetNetworkType;
  if (CHAIN_1_IS_MAINNET && CHAIN_2_IS_MAINNET) {

    let defaultChannels = [];
    let numPreferredChannels = 0;
    for (const key in context.ibcConnection.channels) {

      const CHANNEL_IS_DEFAULT = (
        context.ibcConnection.channels[key].chain_1.port_id === "transfer" &&
        context.ibcConnection.channels[key].chain_2.port_id === "transfer"
      );
      if (!CHANNEL_IS_DEFAULT) continue;
      defaultChannels.push(key);

      const CHANNEL_IS_PREFERRED = context.ibcConnection.channels[key].tags?.preferred;
      if (CHANNEL_IS_PREFERRED) numPreferredChannels++;

    }
    if (defaultChannels.length > 1 && numPreferredChannels !== 1) {
      //--Error--
      const errorMsg = `IBC Connection: ${id.ibcConnection} has more than 1 default channel,
but either many or none of them are marked as "preferred": true. [${defaultChannels}]`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      setCheckStatus(checks, id, checkType, false);
      return false;
    }

  }

  setCheckStatus(checks, id, checkType, true);
  return true;

}

function addChannelIdObject(id, context) {

  const channelId = context.channelChainInfo.channel_id;
  if (channelId === "*") { return; }
  const chainName = context.ibcConnection[id.channelChainNumber].chain_name;
  
  if (!context.allChannelIdsByChainName) context.allChannelIdsByChainName = new Map();
  if (!context.allChannelIdsByChainName.get(chainName)) context.allChannelIdsByChainName.set(chainName, new Map());
  let chainChannelIdMap = context.allChannelIdsByChainName.get(chainName);

  if (!chainChannelIdMap.get(channelId)) chainChannelIdMap.set(channelId, []);
  chainChannelIdMap.get(channelId).push(id);

}

function checkAllChannelIds(context, objectType, checks, errorMsgs) {

  //--Name--
  const checkType = "checkAllChannelIds";
  const errorNotice = "Some channel IDs for the same chain are not unique!";

  //--Prerequisistes--
  const prerequisites = [];
  for (const checkType of prerequisites) {
    if (!getCheckStatus(checks, id, checkType)) return false;
  }

  context?.allChannelIdsByChainName?.forEach((chainChannelIdMap, chainName) => {
    chainChannelIdMap.forEach((idArray, channelId) => {
      if (idArray.length <= 1) return;

      //--Error--
      const errorMsg = `For chain: ${chainName}, the channel_id: ${channelId} is registered ${idArray.length} times:
${JSON.stringify(idArray, null, 2)}`;
      addErrorInstance(errorMsgs, objectType, checkType, errorNotice, errorMsg);
      return false;

    });
  });

  return true;
}

function validate_ibc_files(errorMsgs) {

  const objectType = "IBC"

  //IBC directory name
  const ibcDirectoryName = "_IBC";

  let checks = {};
  let context = {};

  const ibcConnectionChainNumbers = ["chain_1", "chain_2"];

  //create maps of chains and channels
  context.chainNameToIbcChannelsMap = new Map();

  Array.from(chain_reg.networkTypeToDirectoryMap.keys()).forEach((networkType) => {

    //Get all IBC Files (Mainnet and Testnet)
    const networkTypeDirectory = chain_reg.networkTypeToDirectoryMap.get(networkType);
    const directory = path.join(
      networkTypeDirectory,
      ibcDirectoryName
    );
    const ibcFiles = chain_reg.getDirectoryContents(directory);

    ibcFiles.forEach((ibcFile) => {

      context.ibcConnection = chain_reg.readJsonFile(path.join(directory, ibcFile));
      const chain1 = context.ibcConnection.chain_1.chain_name;
      const chain2 = context.ibcConnection.chain_2.chain_name;
      const id = {
        ibcConnection: chain1 + ":" + chain2
      }

      //chain_1, chain_2
      for (const chainNumber of ibcConnectionChainNumbers) {

        id.chainNumber = chainNumber;
        context.ibcChain = context.ibcConnection[chainNumber];

        //check chain_name exists
        checkIbcChainName(id, context, objectType, checks, errorMsgs);

        //check chain_id accuracy
        checkIbcChainId(id, context, objectType, checks, errorMsgs);

      }
      delete id.chainNumber;

      //check for only 1 active default channel
      checkNumPreferredDefaultChannels(id, context, objectType, checks, errorMsgs);

      //Channels[]
      for (const key in context.ibcConnection.channels) {

        id.ibcChannel = key;
        context.channel = context.ibcConnection.channels[key];

        //check for valid channel status
        checkIbcChannelStatus(id, context, objectType, checks, errorMsgs);

        //chain_1, chain_2
        for (const chainNumber of ibcConnectionChainNumbers) {

          id.channelChainNumber = chainNumber;
          context.channelChainInfo = context.channel[chainNumber];

          //Adding channel ids to Map structure to check for duplicates later
          addChannelIdObject(id, context);

        }

      }

    });

  });

  //Now that all IBC files have been iterated, we can check our temporary holding structures
  //Check for IBC channel duplicates
  checkAllChannelIds(context, "ChannelId", checks, errorMsgs);

}

async function validateAll() {

  //setup chain registry
  chain_reg.setup(chainRegistryRoot);

  //prepare error catching
  let errorMsgs = {};

  //check all chains
  await validate_chains(errorMsgs);

  //check all IBC channels
  validate_ibc_files(errorMsgs);

  //check file schema references
  checkFileSchemaReferences();

  //now that we've collected errors in bulk, throw error if positive
  reportErrors(errorMsgs);//why doesn't this work!!!
  

}

async function main() {
  if (API_FETCHING) {
    console.log('Including API calls (server mode)');
    console.log('Run with arg "NO_API" for local testing');
    console.log('> node validate_data.mjs NO_API');
  } else {
    console.log('Skipping API calls (local mode)');
  }
  await validateAll();
}

main();
