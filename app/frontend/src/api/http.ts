// CLIENT
/// <reference types="vite/client" />

import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = import.meta.env.VITE_API_URL as string;

if (!API_URL) {
    throw new Error("Missing VITE_API_URL. Add it to app/frontend/.env.local");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    // Retrieve JWT token from AWS Amplify session
    let token: string | undefined;
    try {
        const session = await fetchAuthSession();
        token = session.tokens?.idToken?.toString();
    } catch (err) {
        // User might not be authenticated - token will be undefined
        console.debug('Failed to fetch auth session:', err);
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
        ...(init.headers || {}),
        "content-type": "application/json",
        ...(token && { "authorization": `Bearer ${token}` }),
        },
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data as T;
}
