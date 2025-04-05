/**
 * @class OpenApiCompatibleClient
 * Provides an interface for making API calls to OpenAI-compatible services
 * like OpenRouter.ai directly from the browser.
 *
 * !! SECURITY WARNING !!
 * Avoid embedding API keys directly in your distributed frontend code.
 * This class is intended for scenarios where the END-USER provides their own key
 * via your application's UI, or for development purposes.
 * The recommended production approach is using a backend proxy.
 */
class OpenApiCompatibleClient {
    /**
     * @param {object} config
     * @param {string} config.apiKey - The API key (REQUIRED). Provided by the end-user.
     * @param {string} [config.baseURL="https://openrouter.ai/api"] - The base URL for the API endpoint.
     * @param {object} [config.defaultHeaders={}] - Default headers to include in every request.
     * @param {string} [config.siteUrl] - Optional: Your site's URL (used for OpenRouter's HTTP-Referer header). Defaults to window.location.href.
     * @param {string} [config.appTitle] - Optional: Your application's title (used for OpenRouter's X-Title header). Defaults to document.title.
     */
    constructor({
        apiKey,
        baseURL = 'https://openrouter.ai/api/v1', // Default to OpenRouter v1
        defaultHeaders = {},
        siteUrl,
        appTitle,
    }) {
        if (!apiKey) {
            throw new Error('API key is required.');
        }
        this.apiKey = apiKey;
        this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash if present
        this.siteUrl = siteUrl || (typeof window !== 'undefined' ? window.location.href : '');
        this.appTitle = appTitle || (typeof document !== 'undefined' ? document.title : '');

        // Prepare default headers, including common OpenRouter ones
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...defaultHeaders, // Allow overriding Content-Type
            'HTTP-Referer': this.siteUrl, // Recommended for OpenRouter
            'X-Title': this.appTitle, // Recommended for OpenRouter
        };
    }

    /**
     * Prepares headers for an API request, merging defaults and adding authorization.
     * @private
     * @param {object} [requestHeaders={}] - Headers specific to the current request.
     * @returns {Headers} - Headers object ready for fetch.
     */
    _prepareHeaders(requestHeaders = {}) {
        const headers = new Headers({
            ...this.defaultHeaders,
            ...requestHeaders, // Request-specific headers override defaults
            'Authorization': `Bearer ${this.apiKey}`,
        });

        // Remove headers if their value is empty or undefined
        // (e.g. if siteUrl/appTitle were empty)
        for(const key of ['HTTP-Referer', 'X-Title']) {
            if (!headers.get(key)) {
                headers.delete(key);
            }
        }

        return headers;
    }

    /**
     * Creates a chat completion request.
     * @param {object} payload - The request payload, conforming to OpenAI's chat completion standard.
     * @param {string} payload.model - The model name.
     * @param {Array<object>} payload.messages - Array of message objects.
     * @param {boolean} [payload.stream=false] - Whether to request a streaming response.
     * @param {number} [payload.temperature] - Optional temperature.
     * @param {number} [payload.max_tokens] - Optional max tokens.
     * // ... other valid OpenAI chat completion parameters
     *
     * @param {object} [options={}] - Additional options for the request.
     * @param {HeadersInit} [options.headers] - Extra headers for this specific call.
     * @param {AbortSignal} [options.signal] - AbortSignal for cancelling the request.
     * @returns {Promise<object|AsyncGenerator<object, void, unknown>>}
     * - If stream=false, returns a Promise resolving to the JSON response.
     * - If stream=true, returns an AsyncGenerator yielding parsed data chunks.
     * @throws {Error} If the API request fails or returns an error status.
     */
    async createChatCompletion(payload, options = {}) {
        const { stream = false, ...bodyPayload } = payload;
        const requestUrl = `${this.baseURL}/chat/completions`;
        const headers = this._prepareHeaders(options.headers);
        const body = JSON.stringify({
            ...bodyPayload,
            stream, // Ensure stream flag is included in the body
        });

        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: headers,
                body: body,
                signal: options.signal, // Pass AbortSignal if provided
            });

            if (!response.ok) {
                // Attempt to parse error details from the API response
                let errorBody;
                try {
                    errorBody = await response.json();
                } catch (e) {
                    // Ignore parsing error, use status text
                }
                const errorMessage = errorBody?.error?.message || response.statusText;
                throw new Error(`API Error (${response.status}): ${errorMessage}`);
            }

            if (stream) {
                if (!response.body) {
                    throw new Error('Response body is null, cannot stream.');
                }
                // Return the async generator for handling the stream
                return this._handleStreamResponse(response.body);
            } else {
                // Return the parsed JSON object for non-streaming responses
                return await response.json();
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted.');
                // Re-throw or handle as needed, here we just log and re-throw
                throw error;
            }
            console.error('Error making API call:', error);
            throw error; // Re-throw the error for the caller to handle
        }
    }

    /**
     * Handles parsing Server-Sent Events (SSE) stream from the response body.
     * @private
     * @param {ReadableStream<Uint8Array>} responseBody
     * @returns {AsyncGenerator<object, void, unknown>} An async generator yielding parsed JSON data chunks.
     */
    async *_handleStreamResponse(responseBody) {
        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Process any remaining buffer content if needed
                    if (buffer.trim()) {
                       // console.warn("Stream ended with unprocessed buffer:", buffer);
                    }
                    break; // Exit the loop when the stream is finished
                }

                buffer += decoder.decode(value, { stream: true });

                // Process buffer line by line for SSE events
                let boundary = buffer.indexOf('\n\n');
                while (boundary !== -1) {
                    const chunk = buffer.substring(0, boundary);
                    buffer = buffer.substring(boundary + 2); // Move past the '\n\n'

                    if (chunk.startsWith('data:')) {
                        const dataString = chunk.substring(5).trim(); // Remove 'data: ' prefix

                        if (dataString === '[DONE]') {
                            // Optional: yield a special object or just let the generator finish
                            // yield { type: 'done' };
                            return; // Stream finished signal from API
                        }

                        try {
                            const parsedData = JSON.parse(dataString);
                            yield parsedData; // Yield the parsed JSON chunk
                        } catch (error) {
                            console.error('Error parsing stream data JSON:', error, 'Data:', dataString);
                            // Decide how to handle parsing errors, maybe yield an error object?
                            // yield { type: 'error', error: 'Failed to parse JSON', data: dataString };
                        }
                    } else if (chunk.trim()) {
                         // Optional: Handle other SSE lines if necessary (e.g., 'event:', 'id:', 'retry:')
                         // console.log("Received non-data SSE line:", chunk);
                    }


                    boundary = buffer.indexOf('\n\n'); // Look for the next message boundary
                }
            }
        } catch (error) {
             console.error('Error reading stream:', error);
             // Handle stream reading errors, maybe yield an error object
             // yield { type: 'error', error: 'Stream read failed', details: error };
             throw error; // Re-throw to signal failure to the consuming loop
        } finally {
            // Ensure the stream reader is released even if errors occur
            reader.releaseLock();
             // Append the final part of the decoded text if the stream finished mid-character
            buffer += decoder.decode();
             // You might want to process any final remaining buffer here if applicable
             // depending on how strict your SSE parsing needs to be
        }
    }
}

// Example of making it available globally (optional, module usage preferred)
// if (typeof window !== 'undefined') {
//   (window as any).OpenApiCompatibleClient = OpenApiCompatibleClient;
// }