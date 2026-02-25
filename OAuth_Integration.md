# OAuth 2.0 Integration Guide for CandyCode & Tinker

This document outlines the OAuth 2.0 integration implemented in Tinker (v8.0+) and the roadmap for CandyCode, explaining why it is a superior alternative to API key authentication for Google Gemini models.

## Why OAuth 2.0?

While API keys are simple to set up, OAuth 2.0 provides several advantages:
- **Higher Rate Limits**: 60 Requests Per Minute (RPM) vs 15 RPM for the free tier API key.
- **Better Security**: Credentials are tied to a specific Google Cloud project and user authorization.
- **User Experience**: Users don't need to copy-paste long strings; they just click "Authorize".

## Integration in Tinker CLI

Tinker uses a hybrid approach, supporting both API Key and OAuth 2.0. The integration is handled by two main components in `tinker.py`:

### 1. `OAuthManager`
Handles the OAuth 2.0 flow, including:
- Checking for `client_secret.json`.
- Loading/refreshing tokens from `token.json`.
- Initiating the local server flow for user authorization.

### 2. `GeminiClient`
Unified client that selects the authentication method based on configuration:
- If `use_oauth` is enabled and a token is available, it adds the `Authorization: Bearer <token>` header.
- If `use_oauth` is disabled or fails, it falls back to API Key if available.
- **Strict Mode**: When OAuth is selected, Tinker bypasses the API key parameter in the URL entirely.

## OAuth Integration in CandyCode (Electron)

Integrating OAuth in a desktop app like CandyCode requires a slightly different approach than a CLI:

1.  **Authorization Flow**: Use Electron's `shell.openExternal` to open the authorization URL in the user's browser.
2.  **Redirect Handling**: Set up a deep link (e.g., `candycode://auth`) or a temporary local server to capture the authorization code.
3.  **Secure Storage**: Store the `refresh_token` and `access_token` in the OS keychain (using Electron's `safeStorage` or `keytar`) rather than a plain `token.json`.
4.  **Service Integration**: Update `gemini.service.ts` to check for OAuth tokens before falling back to the API key.

### Implementation Sketch for CandyCode:
```typescript
// In electron/services/gemini.service.ts
private async getHeaders() {
  const token = await this.authService.getAccessToken();
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  return { 'Content-Type': 'application/json' };
}

private getUrl(model: string) {
  const base = `${this.baseUrl}/models/${model}:streamGenerateContent`;
  if (this.useOAuth) return base;
  return `${base}?key=${this.apiKey}`;
}
```

## Monetization & Packaging: CandyCode vs. Vertex AI

When packaging CandyCode for users, you have two primary paths for providing AI capabilities:

### 1. CandyCode (BYOK - Bring Your Own Key/OAuth)
Users provide their own Google AI Studio API Key or OAuth credentials.
- **Pros**: 
    - **Zero Cost**: You don't pay for the user's AI usage.
    - **High Limits**: Users get 60 RPM (OAuth) or 15 RPM (API Key) for free.
    - **Privacy**: User data stays between them and Google.
- **Cons**: 
    - **Friction**: Users must go through the "developer" setup on Google Cloud.
    - **Target Audience**: Limited to technical users or those willing to follow a guide.
- **Monetization**: Sell the software as a one-time purchase (e.g., $49) or a subscription for the IDE features, not the tokens.

### 2. Vertex AI Integration (Managed Backend)
You host a backend that proxies requests to Google Cloud Vertex AI.
- **Pros**:
    - **Seamless**: Users just sign up and start typing. No keys required.
    - **Professional**: Enterprise-grade reliability and no "free tier" limitations.
    - **Control**: You can implement your own safety filters and analytics.
- **Cons**:
    - **Cost**: You pay for every token used.
    - **Complexity**: Requires a backend, user database, and billing integration (Stripe).
- **Monetization**: SaaS subscription (e.g., $20/month). You keep the margin between the subscription fee and the Vertex AI costs.

## Comparison Table

| Feature | OAuth / API Key (AI Studio) | Vertex AI (Managed) |
| :--- | :--- | :--- |
| **Setup Ease** | Easy (Developer) / Hard (User) | Hard (Developer) / Easy (User) |
| **Cost to You** | $0 | Pay-as-you-go |
| **RPM Limits** | 15 - 60 RPM | Virtually Unlimited |
| **Context Window** | 1M+ (Gemini 2.5) | 1M+ (Gemini 2.5) |
| **Best For** | Power users, Dev tools, Open Source | General public, Enterprise, SaaS |

## Recommendation

**For CandyCode's current stage, I recommend the OAuth (BYOK) approach.**

CandyCode is an agentic IDE designed for developers. These users are comfortable creating a Google Cloud project to get 60 RPM for free. It allows you to distribute the app without worrying about burning through a central budget or managing a complex billing backend.

**Transition Strategy**:
1.  **Phase 1**: Perfect the OAuth/API Key integration (BYOK).
2.  **Phase 2**: If the app gains traction, offer a "Pro" tier where users pay you for a managed Vertex AI experience, removing the need for their own keys.

## Implementation Ease
- **API Key**: 1/10 (Just a string)
- **OAuth**: 4/10 (Requires handling redirects and token refreshes)
- **Vertex AI**: 8/10 (Requires backend, IAM, and billing)

OAuth is the "sweet spot" for AlphaStudio—providing professional-grade performance (60 RPM) at zero cost to you.
