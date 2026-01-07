"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithNet = fetchWithNet;
/**
 * Helper to convert Electron net module response to fetch-like interface
 * This bypasses Electron's fetch networking issues for Chinese servers
 */
const electron_1 = require("electron");
const url_1 = require("url");
async function fetchWithNet(url, options) {
    return new Promise((resolve, reject) => {
        const urlObj = new url_1.URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const requestBody = options.body || '';
        const requestOptions = {
            method: options.method || 'GET',
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            port: urlObj.port ? parseInt(urlObj.port) : (isHttps ? 443 : 80),
            path: urlObj.pathname + (urlObj.search || ''),
        };
        // Set headers
        if (options.headers) {
            requestOptions.headers = options.headers;
        }
        const request = electron_1.net.request(requestOptions);
        let responseResolve = null;
        let responseReject = null;
        let responseBody = '';
        let responseHeaders = {};
        let statusCode = 0;
        let statusMessage = '';
        // Handle abort signal
        if (options.signal) {
            options.signal.addEventListener('abort', () => {
                request.abort();
                if (responseReject) {
                    responseReject(new Error('Request aborted'));
                }
                else {
                    reject(new Error('Request aborted'));
                }
            });
        }
        request.on('response', (response) => {
            statusCode = response.statusCode;
            statusMessage = response.statusMessage || '';
            // Collect headers
            response.headers && Object.keys(response.headers).forEach(key => {
                const value = response.headers[key];
                responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : (value || '');
            });
            // Create a readable stream from the response
            const chunks = [];
            response.on('data', (chunk) => {
                chunks.push(chunk);
                responseBody += chunk.toString();
            });
            response.on('end', () => {
                // Create a ReadableStream from the collected chunks
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    start(controller) {
                        for (const chunk of chunks) {
                            controller.enqueue(new Uint8Array(chunk));
                        }
                        controller.close();
                    }
                });
                // Create Headers object
                const headers = new Headers();
                Object.entries(responseHeaders).forEach(([key, value]) => {
                    headers.set(key, value);
                });
                const netResponse = {
                    status: statusCode,
                    statusText: statusMessage,
                    ok: statusCode >= 200 && statusCode < 300,
                    headers,
                    body: stream,
                    text: async () => responseBody,
                    json: async () => JSON.parse(responseBody),
                };
                if (responseResolve) {
                    responseResolve(netResponse);
                }
                else {
                    resolve(netResponse);
                }
            });
            response.on('error', (err) => {
                if (responseReject) {
                    responseReject(err);
                }
                else {
                    reject(err);
                }
            });
        });
        request.on('error', (err) => {
            if (responseReject) {
                responseReject(err);
            }
            else {
                reject(err);
            }
        });
        request.on('abort', () => {
            const err = new Error('Request aborted');
            if (responseReject) {
                responseReject(err);
            }
            else {
                reject(err);
            }
        });
        // Write request body if present
        if (requestBody) {
            request.write(requestBody);
        }
        request.end();
    });
}
//# sourceMappingURL=moonshot-net-helper.js.map