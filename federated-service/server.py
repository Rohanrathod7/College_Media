import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)

# Constants
MIN_UPDATES_FOR_AGGREGATION = 3

# Mock Global Model State (Simple Linear Recommender Weights)
# In reality, this would load/save to disk or use TensorFlow/PyTorch
global_model = {
    "weights": np.random.normal(0, 0.1, (10, 5)).tolist(), # 10 Features -> 5 Categories
    "bias": np.zeros(5).tolist(),
    "version": 1
}

# Buffer for Incoming Gradients
update_buffer = []

@app.route('/api/model', methods=['GET'])
def get_model():
    """Download the current Global Model"""
    return jsonify(global_model)

@app.route('/api/train', methods=['POST'])
def upload_gradients():
    """Receive local model updates ( Federated Averaging )"""
    global global_model, update_buffer
    
    data = request.json
    if not data or 'weights' not in data:
        return jsonify({"error": "Invalid payload"}), 400

    # Store update
    update_buffer.append(data)
    print(f"Received update from client. Buffer: {len(update_buffer)}/{MIN_UPDATES_FOR_AGGREGATION}")

    # Check if we should aggregate
    if len(update_buffer) >= MIN_UPDATES_FOR_AGGREGATION:
        aggregate()
        return jsonify({"status": "aggregated", "version": global_model["version"]})

    return jsonify({"status": "queued"})

def aggregate():
    """Perform Federated Averaging (FedAvg)"""
    global global_model, update_buffer
    
    print("Starting Aggregation...")
    
    total_samples = sum(u.get("sample_size", 1) for u in update_buffer)
    
    # Initialize accumulators
    new_weights = np.zeros_like(global_model["weights"])
    new_bias = np.zeros_like(global_model["bias"])
    
    # Weighted Average
    for update in update_buffer:
        w = np.array(update["weights"])
        b = np.array(update["bias"])
        n = update.get("sample_size", 1)
        weight_factor = n / total_samples
        
        new_weights += w * weight_factor
        new_bias += b * weight_factor
    
    # Update Global Model
    global_model["weights"] = new_weights.tolist()
    global_model["bias"] = new_bias.tolist()
    global_model["version"] += 1
    
    # Clear buffer
    update_buffer = []
    print(f"Aggregation Complete! New Version: {global_model['version']}")

if __name__ == '__main__':
    print("🚀 Federated Learning Server running on port 6000")
    app.run(host='0.0.0.0', port=6000)
