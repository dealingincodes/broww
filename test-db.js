// Quick connection test for MongoDB Atlas
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const uri = process.env.MONGODB_URI;

if (!uri || uri.includes('<db_password>')) {
  console.log('\n❌ Please replace <db_password> in your .env file with your actual database user password.\n');
  process.exit(1);
}

console.log('\n⏳ Connecting to MongoDB Atlas cluster...');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

async function run() {
  try {
    await client.connect();
    console.log('✅ Successfully connected to MongoDB Atlas!');
    const d = client.db(process.env.MONGODB_DB || 'betbook');
    const collections = await d.listCollections().toArray();
    console.log(`📁 Database "${d.databaseName}" is ready.`);
    console.log('🎉 Your database connection is working perfectly!\n');
  } catch (err) {
    console.error('\n❌ Connection error:', err.message);
    if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
      console.log('👉 Hint: Check that the password you entered is correct for user "dealingincodes_db_user".');
    } else if (err.message.includes('queryTxt ETIMEOUT') || err.message.includes('connection timed out')) {
      console.log('👉 Hint: Make sure Network Access in MongoDB Atlas has 0.0.0.0/0 (Allow access from anywhere) enabled.');
    }
  } finally {
    await client.close();
  }
}

run();
