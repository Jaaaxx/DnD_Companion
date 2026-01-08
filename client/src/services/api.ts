const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Clerk instance will be set by the app
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clerkInstance: any = null;

export function setClerkInstance(clerk: unknown) {
  clerkInstance = clerk;
}

class ApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    // Get the Clerk session token
    const token = await clerkInstance?.session?.getToken();
    
    if (token) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
    }

    return {
      'Content-Type': 'application/json',
    };
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'An error occurred');
    }
    
    return data;
  }
}

export const api = new ApiClient();


