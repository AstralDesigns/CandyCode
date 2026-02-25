# Refactoring CandyCode for Production Gemini Access (Subscription Model)

This document outlines the necessary refactoring steps to transition CandyCode's Gemini model access from a direct API key implementation to a server-side proxy model, enabling a subscription-based usage where users pay CandyCode directly, and CandyCode manages the Gemini API costs.

## Current State: Direct API Key Implementation

Currently, CandyCode relies on users providing their individual Gemini API keys. This model is suitable for development and personal use but presents several challenges for a production application with a subscription model:
*   **Security Risk**: User API keys are stored and used client-side, making them vulnerable to exposure.
*   **Billing Complexity**: Each user is responsible for their own Gemini usage, preventing a unified billing model.
*   **Rate Limiting**: Client-side rate limiting is harder to manage globally across all users.
*   **Feature Limitations**: Advanced features requiring server-side processing or aggregated usage data are difficult to implement.

## Proposed Architecture: Backend Proxy for Gemini Access

The refactored architecture will introduce a dedicated backend service that acts as a secure proxy between the CandyCode client (Electron app) and the Gemini API.

```
+----------------+       +-------------------+       +-----------------+       +--------------+
| CandyCode      |       | Your Backend      |       | Google Cloud    |       | Gemini API   |
| (Electron App) | <---> | (API Proxy)       | <---> | (Authentication)| <---> | (Generative  |
| - Frontend     |       | - User Auth       |       |                 |       |   AI Models) |
| - IPC Renderer |       | - Gemini API Key  |       |                 |       |              |
|                |       | - Rate Limiting   |       |                 |       |              |
|                |       | - Usage Tracking  |       |                 |       |              |
|                |       | - Billing         |       |                 |       |              |
+----------------+       +-------------------+       +-----------------+       +--------------+
       ^                         ^
       |                         |
       +-------------------------+
       User Authentication & Billing
```

### Key Components:

1.  **CandyCode Client (Frontend & Electron Main Process)**:
    *   No longer handles Gemini API keys directly.
    *   Makes requests to the new backend API proxy instead of `window.electronAPI.aiBackendService` for Gemini calls.
    *   Handles user authentication with your backend.
    *   Displays usage information provided by your backend.

2.  **Your Backend (API Proxy Service)**:
    *   **User Authentication & Authorization**: Securely authenticates CandyCode users and authorizes their access to Gemini models based on their subscription status.
    *   **Gemini API Key Management**: Stores and uses your *own* Gemini API key(s) securely. This key is never exposed to the client. Consider using Google Cloud's Secret Manager for storing the API key.
    *   **Request Proxying**: Receives requests from the CandyCode client, forwards them to the Gemini API, and returns the responses.
    *   **Rate Limiting**: Implements centralized rate limiting to manage your overall Gemini usage and prevent abuse. For example, you might allow 100 requests per minute for a basic tier and 1000 for a premium tier.
    *   **Usage Tracking**: Tracks individual user usage of Gemini models (e.g., input/output token counts, number of API calls) for billing purposes.
    *   **Billing Integration**: Interfaces with your chosen billing system (e.g., Stripe, Paddle, Chargebee) to charge users based on their consumption or subscription tier.
    *   **Error Handling**: Provides robust error handling, translating Gemini API errors into user-friendly messages for the client, and logging detailed errors server-side.

3.  **Google Cloud (for Managed Gemini Access)**:
    *   Your backend will interact with Google Cloud's Generative AI services (Vertex AI or direct Gemini API) using your project's service account credentials or API key. Using Vertex AI offers more control and enterprise features.

## Refactoring Steps

### 1. Backend Service Development (New Component)

This is the most significant new piece of infrastructure.

*   **Choose a Technology Stack**:
    *   **Node.js**: Express.js for a lightweight API, NestJS for a more structured, enterprise-grade application (e.g., with TypeScript, modules, dependency injection).
    *   **Python**: Flask for simplicity, FastAPI for high performance with automatic API documentation, Django for a full-featured web framework.
    *   **Go**: For high-performance, concurrent services.
*   **Setup User Authentication**:
    *   **Registration/Login**: Implement endpoints for user creation and authentication.
    *   **Session Management**: Use JWT (JSON Web Tokens) for stateless authentication, or traditional session cookies. JWTs are often preferred for API-driven applications.
    *   **Example**: A `/api/auth/register` endpoint for new users and `/api/auth/login` to issue JWTs.
*   **Implement Gemini Proxy Endpoint**:
    *   Create an endpoint (e.g., `POST /api/gemini/chat`) that the Electron app will call.
    *   This endpoint will receive the user's prompt, `model` (e.g., `gemini-pro`), and other parameters from the client.
    *   **Server-Side Gemini API Call**: Use a Gemini client library (e.g., `@google/generative-ai` for Node.js, `google-generative-ai` for Python) with your *server-side* API key or service account credentials.
    *   **Streaming Responses**: If using streaming Gemini models, implement server-sent events (SSE) or WebSockets to stream responses back to the Electron client for a real-time chat experience.
    *   **Example (Node.js/Express)**:
        ```javascript
        // backend/src/routes/gemini.js
        const express = require('express');
        const router = express.Router();
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const authMiddleware = require('../middleware/auth'); // Your auth middleware
        const usageMiddleware = require('../middleware/usage'); // Your usage tracking middleware

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        router.post('/chat', authMiddleware, usageMiddleware, async (req, res) => {
          try {
            const { prompt, model, history } = req.body;
            const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-pro' });

            const chat = geminiModel.startChat({
              history: history || [],
              generationConfig: { maxOutputTokens: 2000 },
            });

            const result = await chat.sendMessageStream(prompt);

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                res.write(`data: ${JSON.stringify({ type: 'text', data: chunkText })}\n\n`);
                // Update usage for the user
                req.user.trackUsage({ tokens: chunkText.length }); // Example usage tracking
              }
            }
            res.write('data: {"type": "done"}\n\n');
            res.end();
          } catch (error) {
            console.error('Gemini API error:', error);
            res.status(500).json({ error: 'Failed to get response from Gemini.' });
          }
        });

        module.exports = router;
        ```
*   **Secure API Key Storage**:
    *   **Environment Variables**: For development and small deployments, use `.env` files.
    *   **Google Cloud Secret Manager**: Recommended for production on Google Cloud for robust key rotation, access control, and auditing.
    *   **Other Secret Management**: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault for multi-cloud or on-premise deployments.
*   **Implement Usage Tracking and Billing Logic**:
    *   **Database Schema**: Add tables for `users`, `subscriptions`, and `usage_records` (e.g., `user_id`, `timestamp`, `model_name`, `input_tokens`, `output_tokens`, `cost`).
    *   **Billing Integration**:
        *   **Stripe/Paddle Webhooks**: Listen for subscription events (new subscription, renewal, cancellation) from your billing provider.
        *   **Usage-Based Billing**: If offering usage-based pricing, periodically send usage data from your backend to the billing provider.
*   **Add Rate Limiting**:
    *   **Middleware**: Implement rate limiting middleware (e.g., `express-rate-limit` for Node.js) based on user ID or IP address.
    *   **Tier-Based Limits**: Dynamically apply different rate limits based on the user's subscription tier.
*   **Deployment**:
    *   **Google Cloud Run**: Ideal for serverless container deployment, scales automatically, pay-per-use.
    *   **Google Kubernetes Engine (GKE)**: For more complex microservices architectures and fine-grained control.
    *   **Other Platforms**: AWS Lambda/ECS, Azure App Service, Heroku.

### 1.1. Focus on Vertex AI Approach for Gemini Access

While direct Gemini API access is an option, leveraging Google Cloud's Vertex AI platform provides significant advantages for production deployments, especially for enterprise-grade applications like CandyCode.

**What is Vertex AI?**
Vertex AI is Google Cloud's unified machine learning platform that allows you to build, deploy, and scale ML models. It provides a comprehensive set of tools for the entire ML lifecycle, including data preparation, model training, deployment, and monitoring. For Generative AI, Vertex AI offers managed access to Google's foundation models, including Gemini.

**Benefits of Using Vertex AI for Gemini Access:**

*   **Enhanced Security and Compliance**: Vertex AI integrates seamlessly with Google Cloud's identity and access management (IAM), audit logging, and compliance certifications, providing a more secure and auditable environment for sensitive AI workloads.
*   **Managed Infrastructure**: Vertex AI handles the underlying infrastructure for serving Gemini models, reducing operational overhead and ensuring high availability and scalability without requiring you to manage servers.
*   **Unified ML Platform**: If CandyCode ever expands to include custom ML models or other Google Cloud ML services, Vertex AI provides a single platform for managing all ML assets.
*   **Fine-tuning and Customization**: Vertex AI offers capabilities to fine-tune Gemini models with your own data, allowing for more domain-specific and accurate responses. This is crucial for tailoring AI to specific user needs.
*   **Monitoring and Explainability**: Advanced monitoring tools within Vertex AI allow you to track model performance, detect drift, and gain insights into model predictions. Explainable AI features can help understand why a model made a particular decision.
*   **Cost Management and Optimization**: Vertex AI provides detailed cost breakdowns and tools to optimize spending on AI inference, helping CandyCode manage its operational costs more effectively.
*   **Private Endpoints**: For enhanced security and reduced latency, you can configure private endpoints to access Gemini models within your Virtual Private Cloud (VPC) network, ensuring that traffic does not traverse the public internet.

**Integration with Your Backend Proxy:**

Instead of making direct calls to the public Gemini API endpoint, your backend proxy service would interact with Vertex AI's Generative AI API endpoints. This typically involves:

1.  **Authentication**: Using Google Cloud service account credentials (recommended for server-to-server communication) to authenticate with Vertex AI. These credentials should be securely stored (e.g., in Google Cloud Secret Manager).
2.  **API Client Libraries**: Utilizing Google Cloud client libraries for Vertex AI (e.g., `google-cloud-aiplatform` for Python, `@google-cloud/aiplatform` for Node.js) to interact with Gemini models hosted on Vertex AI.
3.  **Project and Location**: Specifying your Google Cloud project ID and the desired region (e.g., `us-central1`) when making API calls to Vertex AI.

**Example (Python/FastAPI Backend using Vertex AI SDK)**:

```python
# backend/app/api/endpoints/gemini.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.cloud import aiplatform
from google.cloud.aiplatform.generative_models import GenerativeModel, Part, Content
import os

# Initialize Vertex AI SDK
aiplatform.init(project=os.environ.get("GOOGLE_CLOUD_PROJECT"), location=os.environ.get("GOOGLE_CLOUD_LOCATION"))

router = APIRouter()

class ChatRequest(BaseModel):
    prompt: str
    model: str = "gemini-pro"
    history: list = []

# Assuming you have an authentication dependency
async def get_current_user():
    # Implement your user authentication logic here
    # For now, a placeholder
    return {"user_id": "test_user"}

@router.post("/chat")
async def chat_with_gemini(request: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        # Initialize the model with Vertex AI
        gemini_model = GenerativeModel(request.model)

        # Convert history to Vertex AI Content objects
        vertex_history = []
        for item in request.history:
            role = item.get("role")
            parts = [Part.from_text(p) for p in item.get("parts", [])]
            if role and parts:
                vertex_history.append(Content(role=role, parts=parts))

        chat = gemini_model.start_chat(
            history=vertex_history,
            # generation_config={"max_output_tokens": 2000} # Example config
        )

        # Send the message
        response = await chat.send_message_async(request.prompt)

        # Stream the response back (simplified for example)
        full_response_text = ""
        for chunk in response: # Assuming response object is iterable for streaming
            chunk_text = chunk.text
            if chunk_text:
                full_response_text += chunk_text
                # Here you would typically stream this back to the client
                # For this example, we'll just accumulate and return

        # Implement usage tracking here (e.g., log tokens used)
        # user["user_id"].track_usage(input_tokens=..., output_tokens=...)

        return {"response": full_response_text}
    except Exception as e:
        print(f"Vertex AI Gemini error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get response from Gemini via Vertex AI: {str(e)}")
```

By adopting the Vertex AI approach, CandyCode can build a more robust, secure, and scalable foundation for its Gemini-powered features, aligning with best practices for enterprise-grade AI applications on Google Cloud.

### 2. CandyCode Client Modifications (`src/`, `electron/`)

#### 2.1. Frontend (`src/`)

*   **Remove API Key Input**:
    *   **`src/store.ts`**: Remove `geminiApiKey` from the `Store` interface and initial state.
    *   **`src/components/Settings.tsx`**: Remove the UI elements for `geminiApiKey`.
    *   **`src/services/ai-backend-api.service.ts`**: Remove the `apiKey` parameter from the `chatStream` method and any direct usage of `geminiApiKey`.
*   **Update `ai-backend-api.service.ts`**:
    *   Modify `src/services/ai-backend-api.service.ts` to use `fetch` or a dedicated HTTP client (e.g., `axios`) to send requests to your new backend proxy URL (e.g., `https://api.candycode.com/api/gemini/chat`).
    *   **Authentication Header**: Include the user's authentication token (e.g., JWT) in the `Authorization` header of all requests to your backend.
    *   **Example (Simplified `chatStream` in `ai-backend-api.service.ts`)**:
        ```typescript
        // src/services/ai-backend-api.service.ts
        import { useAuthStore } from '../stores/authStore'; // Assuming you create an auth store

        async function chatStream(prompt: string, options: ChatOptions, onChunk: (chunk: AIBackendChunk) => void) {
          const token = useAuthStore.getState().authToken; // Get token from auth store
          if (!token) throw new Error('User not authenticated.');

          const response = await fetch('https://api.alphastudio.com/api/gemini/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ prompt, model: options.model, history: options.conversationHistory }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Backend API error.');
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error('Failed to get stream reader.');

          // Implement logic to read from stream and call onChunk
          // This will involve decoding SSE messages or similar
        }
        ```
*   **User Authentication Integration**:
    *   **New Auth Store**: Create a Zustand store (e.g., `src/stores/authStore.ts`) to manage user authentication state (`authToken`, `userId`, `isLoggedIn`, etc.).
    *   **Login/Registration UI**: Create new components for users to log in or register with your backend. This might be a modal or a dedicated settings tab.
    *   **Token Storage**: Securely store the received authentication token. For Electron, `keytar` (Node.js native module) is recommended for storing sensitive data like tokens. Alternatively, `localStorage` can be used, but with careful consideration of XSS risks.
*   **Display Usage/Subscription Status**: Add new UI components (e.g., in a "Account" section of `Settings.tsx` or a dedicated dashboard) to display information like:
    *   Current subscription tier.
    *   Remaining API credits/tokens for the billing period.
    *   Links to manage subscriptions on your website.

#### 2.2. Electron Main Process (`electron/main.ts`)

*   **Remove Direct Gemini IPC Handler**: The `ipcMain.handle('ai-backend:chat', ...)` and `ipcMain.handle('ai-backend:list-models', ...)` handlers that directly interact with `AIBackendService` should be removed. The frontend will now communicate directly with your HTTP backend.
*   **`AIBackendService` Refactor or Removal**: The `electron/services/ai-backend.service.ts` should be either:
    *   **Removed entirely**: If all AI interactions go through your new HTTP backend.
    *   **Refactored**: To act as a thin wrapper for HTTP calls to your new backend, or to handle *only* local model interactions if you plan to support both cloud and local models.
*   **`preload.ts` Adjustments**: Remove `aiBackendService` related exports from `electron/preload.ts` as they will no longer be needed if the frontend directly calls your HTTP backend.

### 3. Deployment and Infrastructure

*   **Backend Deployment**: Deploy your new backend service to a scalable and secure cloud environment (e.g., Google Cloud Run, Google Kubernetes Engine, AWS, Azure). Ensure it has a public HTTPS endpoint.
*   **Database**: Set up a robust and scalable database (e.g., PostgreSQL, MongoDB, Cloud Spanner) for user accounts, subscription details, and usage logs.
*   **Billing System**: Integrate with a payment gateway (e.g., Stripe, Paddle) and a subscription management platform.
*   **Monitoring & Logging**: Implement robust monitoring for your backend service, including API usage, errors, performance metrics, and security logs. Use tools like Google Cloud Monitoring, Prometheus/Grafana, or Datadog.

## Security Considerations

*   **Never expose your Gemini API key client-side.** This is the primary goal of this refactoring.
*   **Secure Backend Endpoints**: Implement proper authentication and authorization for all backend endpoints. Use strong password hashing (e.g., bcrypt) and secure token management.
*   **HTTPS**: All communication between the Electron client and your backend *must* use HTTPS to prevent eavesdropping and data tampering.
*   **Input Validation**: Validate and sanitize all inputs received by your backend to prevent common web vulnerabilities like injection attacks (SQL, XSS) and malformed requests.
*   **Least Privilege**: Ensure your backend service account or API keys used to access the Gemini API only have the necessary permissions. Avoid using root or overly broad permissions.
*   **Rate Limiting on Backend**: Essential to prevent abuse and control your own Gemini API costs.
*   **Client-Side Security**: Even with a backend, consider Electron-specific security best practices, such as `contextIsolation: true` and `nodeIntegration: false` in `webPreferences` (which you already have), and review for potential XSS vulnerabilities in your renderer process.

## Benefits of this Approach

*   **Centralized Control**: Full control over Gemini API usage, costs, and features.
*   **Enhanced Security**: Your Gemini API key is never exposed to users, significantly reducing security risks.
*   **Flexible Billing**: Implement various subscription tiers, usage-based billing, or free trial models, directly managed by CandyCode.
*   **Scalability**: Your backend can be scaled independently to handle increased user demand without impacting client-side performance.
*   **New Features**: Enables development of server-side features like custom model fine-tuning, advanced analytics on user interactions, personalized AI experiences, and more complex integrations with other services.
*   **Auditing and Reporting**: Easier to audit and report on overall Gemini usage and costs.

This refactoring represents a significant architectural shift but is essential for transforming CandyCode into a robust, secure, and commercially viable product.


## Future Enhancements

*   **Detailed Cost Analysis**: Provide more granular cost breakdowns for different models or features.
*   **Advanced Analytics**: Implement dashboards to visualize user engagement and AI model performance.
*   **Multi-Model Support**: Expand the backend to support other AI models (e.g., open-source, other cloud providers) and allow dynamic switching.
*   **Offline Capabilities**: Explore caching and local processing for certain AI tasks to improve responsiveness and reduce reliance on constant backend connectivity. This can be particularly relevant for an Electron app.
*   **User Feedback Loop**: Integrate mechanisms for users to provide feedback on AI responses, which can be used to improve model performance or fine-tuning efforts.
*   **Compliance and Data Governance**: Further detail on how to ensure compliance with data privacy regulations (e.g., GDPR, CCPA) when handling user data and AI interactions.
*   **Internationalization (i18n)**: Prepare the application for global audiences by supporting multiple languages and regional settings.
*   **Accessibility (a11y)**: Ensure the application is usable by individuals with disabilities, adhering to accessibility guidelines.
*   **Automated Testing**: Implement comprehensive unit, integration, and end-to-end tests for both the client and backend to ensure stability and prevent regressions.
*   **CI/CD Pipeline**: Set up a Continuous Integration/Continuous Deployment pipeline to automate testing, building, and deployment processes.
*   **Observability**: Enhance logging, metrics, and tracing across the entire system to provide better insights into its health and performance.


