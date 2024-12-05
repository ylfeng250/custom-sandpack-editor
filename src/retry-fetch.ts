interface RetryOptions {
    maxRetries?: number;
    delay?: number;
  }
  
  export async function retryFetch(url: string, options: RetryOptions = {}): Promise<Response> {
    const { maxRetries = 3, delay = 1000 } = options;
    let lastError: Error | null = null;
  
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  
    throw lastError;
  }
  