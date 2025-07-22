import fs from 'fs';
import { execSync } from 'child_process';

console.log('🚀 Setting up Radar Backend...\n');

// Check if .env file exists
if (!fs.existsSync('.env')) {
  console.log('📝 Creating .env file...');
  const envContent = `# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3001
`;
  
  fs.writeFileSync('.env', envContent);
  console.log('✅ .env file created!');
  console.log('⚠️  Please edit .env file and add your OpenAI API key');
} else {
  console.log('✅ .env file already exists');
}

// Check if OpenAI API key is set
const envContent = fs.readFileSync('.env', 'utf8');
if (envContent.includes('your_openai_api_key_here')) {
  console.log('\n⚠️  IMPORTANT: Please edit the .env file and replace "your_openai_api_key_here" with your actual OpenAI API key');
  console.log('   You can get your API key from: https://platform.openai.com/api-keys');
}

console.log('\n📋 Available commands:');
console.log('   npm run dev:server    - Start the backend server');
console.log('   npm run dev           - Start the frontend');
console.log('   npm run dev:full      - Start both frontend and backend');
console.log('\n🌐 Once running, the API will be available at:');
console.log('   http://localhost:3001/api/health');
console.log('   http://localhost:3001/api/news');
console.log('\n🎯 To start the server now, run: npm run dev:server'); 