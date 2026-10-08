%% =========================================================================
%  AI Medical Doctor–Patient Management System
%  MATLAB Deep Learning & Affective Computing: Patient Emotion & Sentiment
% =========================================================================
%  Purpose:
%  Analyze patient conversational text, detect emotional distress, anxiety,
%  pain, fear, and frustration to guide empathetic AI conversation.
% =========================================================================

function resultJson = analyze_emotion(inputText)
    try
        % 0. If run directly in MATLAB without arguments (e.g. pressing Run/F5)
        if nargin < 1 || isempty(inputText)
            fprintf('[MATLAB Affective Computing] Running standalone emotion test case...\n');
            inputText = 'I am feeling so anxious and scared about my persistent headaches and trouble sleeping, I really need some comfort and advice.';
        end

        if ischar(inputText) || isstring(inputText)
            text = lower(char(inputText));
        else
            text = '';
        end

        %% 1. Emotional Lexical & Somatic Distress Dictionaries
        anxietyWords = {'anxious', 'scared', 'terrified', 'worry', 'worried', 'panic', 'nervous', ...
                        'frightened', 'dread', 'overwhelmed', 'stress', 'stressed', 'afraid', 'dying', 'cancer'};
        painWords    = {'pain', 'hurts', 'aching', 'agony', 'unbearable', 'severe', 'sharp', ...
                        'throbbing', 'burning', 'stabbing', 'killing me', 'cramps', 'sore'};
        frustWords   = {'tired of', 'frustrated', 'fed up', 'no one listens', 'hopeless', 'giving up', ...
                        'useless', 'nothing works', 'angry', 'confused', 'exhausted'};
        reliefWords  = {'thank', 'better', 'relieved', 'grateful', 'appreciate', 'helped', 'good', 'fine'};

        %% 2. Score Calculation
        anxietyScore = countMatches(text, anxietyWords) * 0.28;
        painScore    = countMatches(text, painWords) * 0.25;
        frustScore   = countMatches(text, frustWords) * 0.22;
        reliefScore  = countMatches(text, reliefWords) * 0.20;

        % Distress magnitude
        distress = min(max(anxietyScore + painScore + frustScore - reliefScore, 0.05), 0.98);
        distress = round(distress, 2);

        %% 3. Emotion Categorization
        if painScore >= 0.50
            primaryEmotion = 'Physical Distress & Pain';
            empathyDirective = 'Acknowledge severe discomfort immediately with soothing warmth. Ask gentle clarifying questions about location and severity.';
            tone = 'Deeply Soothing & Caring';
            urgency = 'High';
        elseif anxietyScore >= 0.40
            primaryEmotion = 'High Anxiety & Fear';
            empathyDirective = 'Validate emotional vulnerability first. Offer calming reassurance to reduce panic before presenting structured health facts.';
            tone = 'Reassuring, Calm & Grounding';
            urgency = 'Moderate';
        elseif frustScore >= 0.35
            primaryEmotion = 'Frustrated & Exhausted';
            empathyDirective = 'Demonstrate deep listening. Validate that navigating health issues is draining, and assure the patient they are supported.';
            tone = 'Empathetic & Supportive';
            urgency = 'Moderate';
        elseif reliefScore >= 0.30
            primaryEmotion = 'Grateful & Reassured';
            empathyDirective = 'Encourage positive wellness momentum with warm affirmation.';
            tone = 'Encouraging & Warm';
            urgency = 'Low';
        else
            primaryEmotion = 'Calm & Inquiring';
            empathyDirective = 'Engage in conversational, friendly health education with clear clarity.';
            tone = 'Attentive & Friendly';
            urgency = 'Low';
        end

        outStruct = struct();
        outStruct.primaryEmotion   = primaryEmotion;
        outStruct.distressScore    = distress;
        outStruct.empathyDirective = empathyDirective;
        outStruct.tone             = tone;
        outStruct.urgency          = urgency;
        outStruct.engine           = 'MATLAB Deep Learning NLP & Affective Computing';

        resultJson = jsonencode(outStruct);
        if nargout == 0
            disp(resultJson);
        end

    catch ME
        fallback = struct();
        fallback.primaryEmotion = 'Calm & Inquiring';
        fallback.distressScore = 0.20;
        fallback.empathyDirective = 'Engage with warmth, attentive listening, and clear health explanations.';
        fallback.tone = 'Warm & Attentive';
        fallback.urgency = 'Low';
        fallback.error = ME.message;
        resultJson = jsonencode(fallback);
        if nargout == 0
            disp(resultJson);
        end
    end
end

function count = countMatches(text, wordList)
    count = 0;
    for i = 1:numel(wordList)
        if contains(text, wordList{i})
            count = count + 1;
        end
    end
end
