%% =========================================================================
%  AI Medical Doctor–Patient Management System
%  MATLAB Deep Learning Microservice Listener
% =========================================================================
%  Listens for incoming HTTP POST requests from the Node.js backend on
%  port 6000 (http://127.0.0.1:6000/predict) and returns JSON risk classification.
% =========================================================================

function matlab_service(port)
    if nargin < 1
        port = 6000;
    end

    fprintf('=================================================================\n');
    fprintf('🚀 Starting MATLAB Deep Learning Microservice on port %d...\n', port);
    fprintf('🌐 Endpoint: http://127.0.0.1:%d/predict\n', port);
    fprintf('📡 Ready to accept requests from Node.js backend.\n');
    fprintf('=================================================================\n');

    server = tcpserver('127.0.0.1', port, 'ConnectionChangedFcn', @handleClientConnection);
    fprintf('Press Ctrl+C in MATLAB command window to terminate service.\n');

    while true
        pause(1);
    end
end

function handleClientConnection(src, ~)
    if src.Connected
        pause(0.05);
        if src.NumBytesAvailable > 0
            rawRequest = read(src, src.NumBytesAvailable, 'string');
            
            % Split headers and body
            parts = split(rawRequest, sprintf('\r\n\r\n'));
            if numel(parts) < 2
                parts = split(rawRequest, sprintf('\n\n'));
            end
            
            reqBody = '{}';
            if numel(parts) >= 2
                reqBody = parts{2};
            end

            % Run MATLAB Deep Learning prediction
            resultJson = predict_risk(reqBody);

            % Build standard HTTP/1.1 200 response
            httpResponse = sprintf([...
                'HTTP/1.1 200 OK\r\n' ...
                'Content-Type: application/json\r\n' ...
                'Access-Control-Allow-Origin: *\r\n' ...
                'Content-Length: %d\r\n' ...
                'Connection: close\r\n\r\n' ...
                '%s'], numel(resultJson), resultJson);

            write(src, httpResponse, 'string');
        end
    end
end
