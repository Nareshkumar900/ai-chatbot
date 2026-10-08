%% =========================================================================
%  AI Medical Doctor–Patient Management System
%  MATLAB Deep Learning Module: Serious Situation & Risk Classification
%  Architecture: Hybrid 1D-CNN + Bidirectional LSTM (BiLSTM) Network
% =========================================================================
%  Purpose:
%  Flag potentially serious clinical situations and recommend professional care.
%  Input: Multi-parameter longitudinal patient vitals & lab report biomarkers.
%  Output: 3-Class Risk Classification ('Low Risk', 'Moderate Risk', 'High Risk')
%          and continuous Risk Score (0.00 to 1.00).
% =========================================================================

function [net, trainInfo] = train_risk_classifier()
    fprintf('=================================================================\n');
    fprintf('🩺 MATLAB Deep Learning: Training Medical Risk Classifier (CNN-BiLSTM)\n');
    fprintf('=================================================================\n');

    %% 1. Synthetic Longitudinal Clinical Training Dataset Generation
    % Features (10 parameters):
    % 1. Systolic BP (mmHg)
    % 2. Diastolic BP (mmHg)
    % 3. Heart Rate / Pulse (bpm)
    % 4. Fasting Blood Glucose (mg/dL)
    % 5. HbA1c (%)
    % 6. Serum Creatinine (mg/dL)
    % 7. Total Cholesterol (mg/dL)
    % 8. Triglycerides (mg/dL)
    % 9. Oxygen Saturation (SpO2 %)
    % 10. Patient Age (Years)

    numSamples = 1500;
    timeSteps = 6; % Sequential consultation visits
    numFeatures = 10;

    X = cell(numSamples, 1);
    Y = categorical(zeros(numSamples, 1));

    rng(42); % Reproducibility

    for i = 1:numSamples
        % Distribute classes: 40% Low Risk, 35% Moderate Risk, 25% High Risk
        r = rand();
        sequence = zeros(numFeatures, timeSteps);

        if r < 0.40
            % --- Class 1: Low Risk (Stable baseline parameters) ---
            for t = 1:timeSteps
                sysBP    = normrnd(118, 5);
                diaBP    = normrnd(76, 4);
                hr       = normrnd(72, 6);
                glucose  = normrnd(88, 6);
                hba1c    = normrnd(5.2, 0.2);
                creat    = normrnd(0.9, 0.1);
                chol     = normrnd(175, 12);
                trig     = normrnd(120, 15);
                spo2     = normrnd(98, 1);
                age      = normrnd(35, 10);
                sequence(:, t) = [sysBP; diaBP; hr; glucose; hba1c; creat; chol; trig; spo2; age];
            end
            Y(i) = 'Low Risk';

        elseif r < 0.75
            % --- Class 2: Moderate Risk (Borderline / Stage 1 metrics) ---
            for t = 1:timeSteps
                sysBP    = normrnd(138, 8)  + (t * 1.5);
                diaBP    = normrnd(88, 5)   + (t * 0.8);
                hr       = normrnd(82, 8);
                glucose  = normrnd(135, 12) + (t * 2.0);
                hba1c    = normrnd(6.6, 0.3);
                creat    = normrnd(1.2, 0.15);
                chol     = normrnd(220, 18);
                trig     = normrnd(175, 20);
                spo2     = normrnd(96, 1.2);
                age      = normrnd(52, 9);
                sequence(:, t) = [sysBP; diaBP; hr; glucose; hba1c; creat; chol; trig; spo2; age];
            end
            Y(i) = 'Moderate Risk';

        else
            % --- Class 3: High Risk (Significant deterioration / crisis thresholds) ---
            for t = 1:timeSteps
                sysBP    = normrnd(165, 12) + (t * 3.5);
                diaBP    = normrnd(102, 7)  + (t * 2.0);
                hr       = normrnd(108, 14);
                glucose  = normrnd(230, 30) + (t * 4.0);
                hba1c    = normrnd(8.8, 0.8);
                creat    = normrnd(2.4, 0.4);
                chol     = normrnd(280, 25);
                trig     = normrnd(290, 40);
                spo2     = normrnd(90, 3.0) - (t * 0.8);
                age      = normrnd(64, 8);
                sequence(:, t) = [sysBP; diaBP; hr; glucose; hba1c; creat; chol; trig; spo2; age];
            end
            Y(i) = 'High Risk';
        end

        X{i} = sequence;
    end

    %% 2. Partition Train and Validation Sets (80/20 Split)
    cv = cvpartition(numSamples, 'HoldOut', 0.20);
    trainIdx = training(cv);
    valIdx   = test(cv);

    XTrain = X(trainIdx);
    YTrain = Y(trainIdx);
    XVal   = X(valIdx);
    YVal   = Y(valIdx);

    %% 3. Deep Learning Network Architecture (1D-CNN + BiLSTM + Softmax)
    layers = [
        % Sequence Input (10 clinical biomarkers x 6 longitudinal time steps)
        sequenceInputLayer(numFeatures, 'Name', 'clinical_input', 'Normalization', 'zscore')
        
        % 1D Convolutional feature extractor (Biomarker feature correlations)
        convolution1dLayer(3, 32, 'Padding', 'same', 'Name', 'conv1d_biomarkers')
        batchNormalizationLayer('Name', 'bn_conv')
        reluLayer('Name', 'relu_conv')
        
        % Bidirectional LSTM Layer (Captures forward and backward deterioration trajectory)
        bilstmLayer(64, 'OutputMode', 'last', 'Name', 'bilstm_temporal')
        dropoutLayer(0.25, 'Name', 'dropout_reg')
        
        % Dense classification head
        fullyConnectedLayer(32, 'Name', 'fc_dense')
        reluLayer('Name', 'relu_dense')
        fullyConnectedLayer(3, 'Name', 'fc_classes') % 3 classes: Low, Moderate, High
        softmaxLayer('Name', 'softmax_probabilities')
        classificationLayer('Name', 'risk_classification')
    ];

    %% 4. Training Options
    options = trainingOptions('adam', ...
        'MaxEpochs', 25, ...
        'MiniBatchSize', 32, ...
        'InitialLearnRate', 0.005, ...
        'LearnRateSchedule', 'piecewise', ...
        'LearnRateDropPeriod', 10, ...
        'LearnRateDropFactor', 0.5, ...
        'ValidationData', {XVal, YVal}, ...
        'ValidationFrequency', 20, ...
        'Shuffle', 'every-epoch', ...
        'Verbose', true, ...
        'Plots', 'none');

    %% 5. Model Training Execution
    fprintf('🚀 Initiating Deep Learning optimization...\n');
    net = trainNetwork(XTrain, YTrain, layers, options);

    %% 6. Validation Evaluation
    YPred = classify(net, XVal);
    accuracy = sum(YPred == YVal) / numel(YVal);
    fprintf('✅ Training Complete. Validation Classification Accuracy: %.2f%%\n', accuracy * 100);

    %% 7. Persist Trained Weights and Architecture
    modelPath = fullfile(fileparts(mfilename('fullpath')), 'trained_risk_model.mat');
    save(modelPath, 'net', 'accuracy');
    fprintf('💾 Model successfully saved to: %s\n', modelPath);

    trainInfo = struct('accuracy', accuracy, 'modelPath', modelPath);
end
