import os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import pandas as pd
from supabase import create_client, Client
from model import train_model, predict_demand, analyze_advanced_insights
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise ValueError("Missing Supabase credentials in .env")

supabase: Client = create_client(url, key)

class PredictionResponse(BaseModel):
    message: str
    predictions_generated: int

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "InventAI ML Analytics Service"}

@app.post("/predict", response_model=PredictionResponse)
def generate_predictions(x_brand: str = Header(None)):
    brand = x_brand or 'Apparel & Fashion'
    # 1. Fetch historical sales data from Supabase for the selected brand
    sales_response = supabase.table("sales").select("*").eq("brand", brand).execute()
    sales_data = sales_response.data
    
    if len(sales_data) < 5:
        # Graceful handling for initial setup
        # Return success with 0 predictions
        return {"message": f"Insufficient sales data in database for brand '{brand}' (minimum 5 logs required).", "predictions_generated": 0}
        
    df = pd.DataFrame(sales_data)
    
    # 2. Train model and predict
    predictions = predict_demand(df)
    
    # 3. Save predictions to Supabase
    for pred in predictions:
        product_id = pred['product_id']
        predicted_demand = int(float(pred['predicted_demand']))
        
        # Get current product threshold to recommend stock under this brand
        prod_response = supabase.table("products").select("threshold").eq("product_id", product_id).eq("brand", brand).execute()
        product = prod_response.data[0] if prod_response.data else None
        threshold = product["threshold"] if product else 10
        recommended_stock = int(max(predicted_demand + threshold, 0))
        
        # Clean old prediction for this product and brand
        supabase.table("predictions").delete().eq("product_id", product_id).eq("brand", brand).execute()
        
        # Insert new prediction with brand
        supabase.table("predictions").insert({
            "product_id": product_id,
            "predicted_demand": predicted_demand,
            "recommended_stock": recommended_stock,
            "brand": brand
        }).execute()
        
    return {"message": f"Predictions successfully generated and stored for brand '{brand}'", "predictions_generated": len(predictions)}

@app.get("/analytics-insights")
def get_advanced_insights(x_brand: str = Header(None)):
    brand = x_brand or 'Apparel & Fashion'
    try:
        # Fetch data from Supabase filtered by brand
        sales_response = supabase.table("sales").select("*").eq("brand", brand).execute()
        products_response = supabase.table("products").select("*").eq("brand", brand).execute()
        
        sales_data = sales_response.data
        products_data = products_response.data
        
        if not products_data:
            return {
                "deadStock": [],
                "trending": [],
                "safetyThresholds": [],
                "seasonalPrediction": f"No active products to generate seasonal models for brand '{brand}'.",
                "recommendations": []
            }
            
        sales_df = pd.DataFrame(sales_data) if sales_data else pd.DataFrame(columns=['product_id', 'quantity_sold', 'date'])
        
        insights = analyze_advanced_insights(sales_df, products_data)
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate advanced insights for brand '{brand}': {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
