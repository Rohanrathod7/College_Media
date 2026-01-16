import * as tf from '@tensorflow/tfjs';

/**
 * Federated Learning Training Worker
 * This worker runs in the background to train a local model on user interaction data
 * and sends only the weight updates (gradients) back to the server.
 */

self.onmessage = async (e) => {
    const { type, data, modelUrl } = e.data;

    if (type === 'TRAIN') {
        try {
            console.log('🧠 [Federated Worker] Starting training session...');

            // 1. Fetch the Global Model configuration and weights
            const response = await fetch(modelUrl);
            const globalModelState = await response.json();

            // 2. Reconstruct the Model in TF.js
            // Current architecture: Simple Linear Recommender (10 input features -> 5 output categories)
            const model = tf.sequential();
            model.add(tf.layers.dense({
                units: 5,
                inputShape: [10],
                kernelInitializer: 'zeros',
                biasInitializer: 'zeros'
            }));

            // Load Server Weights into Local Model
            const serverWeights = tf.tensor2d(globalModelState.weights);
            const serverBias = tf.tensor1d(globalModelState.bias);
            model.setWeights([serverWeights, serverBias]);

            model.compile({
                optimizer: tf.train.sgd(0.01),
                loss: 'meanSquaredError'
            });

            // 3. Prepare Local Interaction Data
            // Data format: { inputs: number[][], labels: number[][] }
            const xs = tf.tensor2d(data.inputs);
            const ys = tf.tensor2d(data.labels);

            // 4. Local Training (Fine-tuning)
            const history = await model.fit(xs, ys, {
                epochs: 3,
                batchSize: 16,
                verbose: 0
            });

            console.log(`🧠 [Federated Worker] Training complete. Final Loss: ${history.history.loss[2]}`);

            // 5. Extract Updated Weights
            const trainedParams = model.getWeights();
            const updatedWeights = await trainedParams[0].array();
            const updatedBias = await trainedParams[1].array();

            // 6. Send Update back to Main Thread
            self.postMessage({
                type: 'TRAINING_COMPLETE',
                payload: {
                    weights: updatedWeights,
                    bias: updatedBias,
                    sample_size: data.inputs.length,
                    version: globalModelState.version
                }
            });

            // Memory Cleanup
            xs.dispose();
            ys.dispose();
            serverWeights.dispose();
            serverBias.dispose();
            model.dispose();

        } catch (error) {
            console.error('🧠 [Federated Worker] Error:', error);
            self.postMessage({ type: 'TRAINING_ERROR', error: error.message });
        }
    }
};
