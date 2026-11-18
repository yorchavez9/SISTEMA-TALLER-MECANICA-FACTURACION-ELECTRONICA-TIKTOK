/**
 * GET JSON contra el backend (misma sesión). Las consultas a la API SUNAT las
 * hace siempre Laravel; el navegador nunca recibe credenciales.
 */
export async function getJson<T>(
    url: string,
    params: Record<string, string | number | null | undefined> = {},
): Promise<T> {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            query.set(key, String(value));
        }
    });

    const response = await fetch(`${url}?${query.toString()}`, {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
}
