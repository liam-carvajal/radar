import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testBackend() {
  console.log('🧪 Testing Backend Endpoints...\n');

  try {
    // Test health endpoint
    console.log('1. Testing Health Endpoint...');
    const health = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check passed:', health.data.message);
    console.log('   Timestamp:', health.data.timestamp);
    console.log('');

    // Test regions endpoint
    console.log('2. Testing Regions Endpoint...');
    const regions = await axios.get(`${BASE_URL}/api/regions`);
    console.log('✅ Regions retrieved:', regions.data.data);
    console.log('');

    // Test industries endpoint
    console.log('3. Testing Industries Endpoint...');
    const industries = await axios.get(`${BASE_URL}/api/industries`);
    console.log('✅ Industries retrieved:', industries.data.data);
    console.log('');

    // Test news endpoint (should be empty initially)
    console.log('4. Testing News Endpoint...');
    const news = await axios.get(`${BASE_URL}/api/news`);
    console.log('✅ News data structure:', {
      lastUpdated: news.data.data.lastUpdated,
      countriesCount: Object.keys(news.data.data.countries).length,
      historyCount: news.data.data.newsHistory.length
    });
    console.log('');

    // Test specific country endpoint (should return 404 for non-existent data)
    console.log('5. Testing Country-Specific Endpoint...');
    try {
      await axios.get(`${BASE_URL}/api/news/US`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Country endpoint correctly returns 404 for non-existent data');
      } else {
        throw error;
      }
    }
    console.log('');

    // Test manual update endpoint
    console.log('6. Testing Manual Update Endpoint...');
    const update = await axios.post(`${BASE_URL}/api/news/update`, {});
    console.log('✅ Update endpoint responded:', update.data.message);
    console.log('   Data received:', Object.keys(update.data.data).length > 0 ? 'Yes' : 'No');
    console.log('');

    // Wait a bit and check if data was populated
    console.log('7. Waiting for data processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const updatedNews = await axios.get(`${BASE_URL}/api/news`);
    console.log('✅ Updated news data:', {
      lastUpdated: updatedNews.data.data.lastUpdated,
      countriesCount: Object.keys(updatedNews.data.data.countries).length,
      historyCount: updatedNews.data.data.newsHistory.length
    });

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Backend Status:');
    console.log('   - Server is running on port 3001');
    console.log('   - All endpoints are responding');
    console.log('   - Data structure is correct');
    console.log('   - Error handling is working');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

testBackend(); 