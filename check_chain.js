const chain = require('./rizqprotocol/chain.json');
const schema = require('./chain.schema.json');

const required = schema.required || [];
const missing = required.filter(field => !(field in chain));

if (missing.length > 0) {
  console.log('Missing required fields:', missing);
} else {
  console.log('✅ All required fields present');
}
