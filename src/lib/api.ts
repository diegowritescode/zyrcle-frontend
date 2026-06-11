/**
 * Central API configuration.
 *
 * The backend base URL is read from the `VITE_API_URL` environment variable
 * (see `.env` / `.env.example`). When it is not set we fall back to the local
 * dev backend so `npm run dev` works out of the box.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Build a full backend URL from a path like `/api/rutas/quemadas`. */
export const apiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
