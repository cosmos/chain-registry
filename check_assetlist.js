const assetlist = require('./rizqprotocol/assetlist.json');
const schema = require('./assetlist.schema.json');

const required = schema.required || [];
const missing = required.filter(field => !(field in assetlist));

if (missing.length > 0) {
  console.log('Missing required fields in assetlist:', missing);
} else {
  console.log('✅ All required assetlist fields present');
}
