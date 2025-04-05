// --- In your application's code ---

// Assume you have an input field where the user enters their key
const userApiKey = document.getElementById('apiKeyInput').value;
const siteUrl = window.location.href;
const appTitle = 'My Awesome SPA'; // Or dynamically get document.title

if (!userApiKey) {
    alert('Please enter your OpenRouter/OpenAI API Key!');
    return;
}

const client = new OpenApiCompatibleClient({
    apiKey: userApiKey,
    // Optional: Override base URL if not using OpenRouter default
    // baseURL: 'https://api.openai.com/v1',
    siteUrl: siteUrl,
    appTitle: appTitle,
});

// --- Example: Non-Streaming Call ---
async function getCompletion() {
    try {
        const payload = {
            model: 'openai/gpt-3.5-turbo', // Or a model available on OpenRouter
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'What is the capital of France?' }
            ],
            temperature: 0.7,
            // stream: false // default is false
        };
        console.log('Sending request:', payload);
        const result = await client.createChatCompletion(payload);
        console.log('API Response:', result);
        const messageContent = result.choices[0]?.message?.content;
        alert('Assistant says: ' + messageContent);

    } catch (error) {
        console.error('API Call failed:', error);
        alert('Error: ' + error.message);
    }
}

// --- Example: Streaming Call ---
async function streamCompletion() {
    const outputElement = document.getElementById('streamingOutput');
    outputElement.textContent = ''; // Clear previous output

    try {
        const payload = {
            model: 'mistralai/mistral-7b-instruct', // Example OpenRouter model
            messages: [
                { role: 'user', content: 'Write a short story about a robot learning to paint.' }
            ],
            stream: true
        };

         console.log('Sending streaming request:', payload);
        const stream = await client.createChatCompletion(payload);

        // Use a for-await-of loop to process the stream
        for await (const chunk of stream) {
            // Extract content from the chunk based on OpenAI's streaming format
            const contentPart = chunk.choices?.[0]?.delta?.content;
            if (contentPart) {
                console.log('Stream chunk:', contentPart);
                outputElement.textContent += contentPart; // Append content to UI
            }
        }
        console.log('Streaming finished.');

    } catch (error) {
        console.error('Streaming API Call failed:', error);
        outputElement.textContent += `\n\n--- ERROR: ${error.message} ---`;
        alert('Streaming Error: ' + error.message);
    }
}

// Add event listeners to buttons or triggers to call these functions
// document.getElementById('getCompletionBtn').addEventListener('click', getCompletion);
// document.getElementById('streamCompletionBtn').addEventListener('click', streamCompletion);