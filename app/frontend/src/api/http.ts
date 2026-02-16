// CLIENT
/// <reference types="vite/client" />

const API_URL = import.meta.env.VITE_API_URL as string;

if (!API_URL) {
    throw new Error("Missing VITE_API_URL. Add it to app/frontend/.env.local");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    // TODO: Implement JWT token retrieval from AWS Amplify session
    // Example:
    // import { fetchAuthSession } from 'aws-amplify/auth';
    // const session = await fetchAuthSession();
    // const token = session.tokens?.idToken?.toString();

    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
        ...(init.headers || {}),
        "content-type": "application/json",
        // TODO: Uncomment when frontend is ready to send JWT
        // ...(token && { "authorization": `Bearer ${token}` }),
        },
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data as T;
}
