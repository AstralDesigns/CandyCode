/**
 * Web Search Service
 * Provides web search capability for the AI agent using DuckDuckGo
 */
export interface WebSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  error?: string;
}

export class WebSearchService {
  async search(query: string, maxResults: number = 5): Promise<WebSearchResult> {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      const results: Array<{ title: string; url: string; snippet: string }> = [];
      const resultRegex = /<div class="result[^"]*">[\s\S]*?<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let match;
      let count = 0;

      while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
        const url = match[1];
        const title = this.cleanHtml(match[2]);
        if (url && title && !url.includes('duckduckgo.com')) {
          results.push({
            title,
            url: url.startsWith('http') ? url : `https:${url}`,
            snippet: '',
          });
          count++;
        }
      }

      return { query, results: results.slice(0, maxResults) };
    } catch (error: any) {
      return {
        query,
        results: [],
        error: error.message || 'Search failed',
      };
    }
  }

  private cleanHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  }
}

export const webSearchService = new WebSearchService();
