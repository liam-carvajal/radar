import { OpenAI } from 'openai';

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 3600000 // 1 hour timeout
});

// Simple test prompt
const testPrompt = `You are an expert at understanding macro and micro economic trends in the past 7 days across the world in the direct context of advertising industry.

Please provide a brief analysis of recent economic news for the US and Europe in the retail and beauty/wellness industries.

Format your response as:

Country: US
Industry: Retail
News headline: "Sample news headline" (Source, Date)
How does it affect the advertising business: Brief explanation
Positivity score: 7
Importance score: 8

Country: Europe
Industry: Beauty/Wellness
News headline: "Sample news headline" (Source, Date)
How does it affect the advertising business: Brief explanation
Positivity score: 6
Importance score: 7`;

async function testO4Model() {
  try {
    console.log('Testing o4-mini-deep-research model...');
    console.log('Prompt:', testPrompt.substring(0, 200) + '...');
    
    const response = await client.responses.create({
      model: "o4-mini-deep-research",
      input: testPrompt,
      tools: [
        {"type": "web_search_preview"}
      ]
    });

    console.log('\n=== MODEL RESPONSE ===');
    console.log('Response object:', JSON.stringify(response, null, 2));
    
    console.log('\n=== OUTPUT TEXT ===');
    console.log(response.output_text || 'No output text received');
    
    console.log('\n=== RESPONSE STRUCTURE ===');
    console.log('Response type:', typeof response);
    console.log('Response keys:', Object.keys(response));
    
    if (response.output_text) {
      console.log('\n=== PARSED LINES ===');
      const lines = response.output_text.split('\n');
      lines.forEach((line, index) => {
        console.log(`${index + 1}: ${line}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing o4 model:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data
    });
  }
}

// Run the test
testO4Model(); 