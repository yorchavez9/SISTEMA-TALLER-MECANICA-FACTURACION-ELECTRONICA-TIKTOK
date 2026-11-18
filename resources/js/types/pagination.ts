/** Estructura que devuelve LengthAwarePaginator de Laravel al serializarse. */
export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    from: number | null;
    to: number | null;
    total: number;
    links: PaginationLink[];
    prev_page_url: string | null;
    next_page_url: string | null;
    first_page_url: string;
    last_page_url: string;
    path: string;
};
