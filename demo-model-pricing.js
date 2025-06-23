const fetch = require('node-fetch');
require('dotenv').config();

// Demo: Model pricing and cost tracking
async function demoModelPricing() {
  console.log('🎯 Model Pricing & Cost Tracking Demo\n');
  
  // Note: You'll need to replace this with your actual admin API key
  const adminApiKey = 'your_admin_api_key_here';
  const baseUrl = 'http://localhost:3000';
  
  try {
    // 1. Get all model pricing
    console.log('1. Getting model pricing information...');
    const pricingResponse = await fetch(`${baseUrl}/api/model-pricing`, {
      headers: { 'X-API-Key': adminApiKey }
    });
    
    if (pricingResponse.ok) {
      const pricingData = await pricingResponse.json();
      console.log('✅ Available models and pricing:');
      pricingData.pricing.forEach(model => {
        console.log(`   📊 ${model.model}`);
        console.log(`      ${model.description}`);
        console.log(`      Input:  $${model.inputCostPer1M}/1M tokens ($${model.inputCostPer1K}/1K)`);
        console.log(`      Output: $${model.outputCostPer1M}/1M tokens ($${model.outputCostPer1K}/1K)`);
        console.log('');
      });
    }
    
    // 2. Compare costs for different models
    console.log('2. Comparing costs for the same prompt across models...');
    const testPrompt = `Write a short story about a robot learning to paint. 
    The story should be creative and engaging, about 500 words long.`;
    
    const modelsToTest = [
      'claude-3-haiku-20240307',      // Cheapest
      'claude-3-5-haiku-20241022',    // Medium-cheap
      'claude-3-5-sonnet-20241022',   // Medium
      'claude-3-opus-20240229'        // Most expensive
    ];
    
    for (const model of modelsToTest) {
      const estimateResponse = await fetch(`${baseUrl}/api/estimate-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': adminApiKey
        },
        body: JSON.stringify({
          prompt: testPrompt,
          model: model,
          estimatedOutputTokens: 600 // Roughly 500 words
        })
      });
      
      if (estimateResponse.ok) {
        const estimate = await estimateResponse.json();
        console.log(`   💰 ${model}:`);
        console.log(`      Estimated cost: $${estimate.totalCost.toFixed(4)} (${estimate.creditsRequired} credits)`);
        console.log(`      Tokens: ${estimate.inputTokens} in + ${estimate.outputTokens} out = ${estimate.totalTokens} total`);
      }
    }
    
    // 3. Show cost difference
    console.log('\n3. Cost comparison summary:');
    console.log('   For a typical story generation request:');
    console.log('   • Claude 3 Haiku:     ~5-10 credits  ($0.05-$0.10)  ⚡ Fastest & cheapest');
    console.log('   • Claude 3.5 Haiku:   ~15-25 credits ($0.15-$0.25)  🚀 Good balance');
    console.log('   • Claude 3.5 Sonnet:  ~30-50 credits ($0.30-$0.50)  🎯 Best overall');
    console.log('   • Claude 3 Opus:      ~150-250 credits ($1.50-$2.50) 🏆 Highest quality');
    
    // 4. Real usage recommendations
    console.log('\n4. Usage recommendations:');
    console.log('   • Structure Generation: Use Sonnet for coherent plots');
    console.log('   • Scene Generation: Use Haiku for speed, Sonnet for quality');
    console.log('   • Dialogue Generation: Use Sonnet or Opus for natural conversation');
    console.log('   • Plot Points: Use Haiku for basic beats, Sonnet for complex causality');
    
  } catch (error) {
    if (error.message.includes('401')) {
      console.error('❌ Authentication failed. Make sure to:');
      console.error('   1. Start your server: npm start');
      console.error('   2. Update adminApiKey with your actual admin API key');
      console.error('   3. The admin API key is shown when you first start the server');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Utility: Show pricing table
function showPricingTable() {
  console.log('\n📊 CLAUDE MODEL PRICING TABLE\n');
  console.log('┌─────────────────────────────┬──────────────┬──────────────┬─────────────────┐');
  console.log('│ Model                       │ Input $/1M   │ Output $/1M  │ Use Case        │');
  console.log('├─────────────────────────────┼──────────────┼──────────────┼─────────────────┤');
  console.log('│ claude-3-haiku-20240307     │ $0.25        │ $1.25        │ Fast & cheap    │');
  console.log('│ claude-3-5-haiku-20241022   │ $1.00        │ $5.00        │ Better quality  │');
  console.log('│ claude-3-5-sonnet-20241022  │ $3.00        │ $15.00       │ Best balance    │');
  console.log('│ claude-3-opus-20240229      │ $15.00       │ $75.00       │ Highest quality │');
  console.log('└─────────────────────────────┴──────────────┴──────────────┴─────────────────┘');
  console.log('\n💡 Pro tip: Start with Haiku for testing, upgrade to Sonnet for production');
}

// Run the demo
console.log('🎬 Film Script Generator - Model Pricing Demo');
showPricingTable();
demoModelPricing().catch(console.error); 