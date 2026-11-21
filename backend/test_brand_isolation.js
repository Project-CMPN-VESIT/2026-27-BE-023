const axios = require('axios');

async function testIsolation() {
  try {
    console.log("1. Triggering predictions for 'Apparel & Fashion'...");
    const predResApparel = await axios.post('http://localhost:5000/api/trigger-prediction', {}, {
      headers: { 'x-brand': 'Apparel & Fashion' }
    });
    console.log("Apparel Prediction Result:", predResApparel.data);

    console.log("\n2. Fetching products for 'Apparel & Fashion'...");
    const productsApparel = await axios.get('http://localhost:5000/api/products', {
      headers: { 'x-brand': 'Apparel & Fashion' }
    });
    console.log(`Found ${productsApparel.data.length} products. First product: ${productsApparel.data[0]?.name}`);

    console.log("\n3. Fetching predictions for 'Apparel & Fashion'...");
    const predictionsApparel = await axios.get('http://localhost:5000/api/predictions', {
      headers: { 'x-brand': 'Apparel & Fashion' }
    });
    console.log(`Found ${predictionsApparel.data.length} predictions. First prediction: Product ID ${predictionsApparel.data[0]?.product_id}, Demand: ${predictionsApparel.data[0]?.predicted_demand}, Recommended Stock: ${predictionsApparel.data[0]?.recommended_stock}`);

    console.log("\n4. Triggering predictions for 'Electronics & Gadgets'...");
    const predResElectronics = await axios.post('http://localhost:5000/api/trigger-prediction', {}, {
      headers: { 'x-brand': 'Electronics & Gadgets' }
    });
    console.log("Electronics Prediction Result:", predResElectronics.data);

    console.log("\n5. Fetching products for 'Electronics & Gadgets'...");
    const productsElectronics = await axios.get('http://localhost:5000/api/products', {
      headers: { 'x-brand': 'Electronics & Gadgets' }
    });
    console.log(`Found ${productsElectronics.data.length} products. First product: ${productsElectronics.data[0]?.name}`);

    console.log("\n6. Fetching predictions for 'Electronics & Gadgets'...");
    const predictionsElectronics = await axios.get('http://localhost:5000/api/predictions', {
      headers: { 'x-brand': 'Electronics & Gadgets' }
    });
    console.log(`Found ${predictionsElectronics.data.length} predictions. First prediction: Product ID ${predictionsElectronics.data[0]?.product_id}, Demand: ${predictionsElectronics.data[0]?.predicted_demand}, Recommended Stock: ${predictionsElectronics.data[0]?.recommended_stock}`);

  } catch (err) {
    console.error("Test failed:", err.response ? err.response.data : err.message);
  }
}

testIsolation();
