// CLIENT

const API_URL = import.meta.env.VITE_API_URL as string;

if (!API_URL) {
    throw new Error("Missing VITE_API_URL. Add it to app/frontend/.env.local");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
        ...(init.headers || {}),
        "content-type": "application/json",
        },
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data as T;
}
