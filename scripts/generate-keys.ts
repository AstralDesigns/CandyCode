import * as crypto from 'crypto';

type Tier = 'standard' | 'pro';

function generateLicenseKey(tier: Tier): string {
  // 1. Prefix based on tier
  const prefix = tier === 'pro' ? 'ALPHA-PRO' : 'ALPHA-STD';
  
  // 2. Generate random entropy (8 bytes = 16 hex chars)
  const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  
  // 3. Create a simplistic checksum (last 4 chars) based on the random part
  // This allows the client to validate structure without a database
  const hash = crypto.createHash('sha256').update(randomBytes).digest('hex').toUpperCase();
  const checksum = hash.substring(0, 4);
  
  // Format: PREFIX-RANDOM-CHECKSUM
  // Example: ALPHA-PRO-1A2B3C4D5E6F7G8H-9I0J
  return `${prefix}-${randomBytes}-${checksum}`;
}

// Generate some keys
console.log('--- CandyCode License Generator ---\n');

console.log('STANDARD TIERS:');
for (let i = 0; i < 5; i++) {
  console.log(generateLicenseKey('standard'));
}

console.log('\nPRO TIERS:');
for (let i = 0; i < 5; i++) {
  console.log(generateLicenseKey('pro'));
}
