// Pequeño cliente para hablar con el backend (FastAPI). Todas las rutas empiezan con /api.
const TOKEN_KEY = 'inventario.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // El navegador no permite guardar datos (modo privado): la sesión durará hasta recargar
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Traduce los errores de validación más comunes de FastAPI/Pydantic
function validationMessage(error) {
  const field = error.loc?.[error.loc.length - 1];
  const messages = {
    greater_than: `debe ser mayor que ${error.ctx?.gt}`,
    greater_than_equal: `debe ser mayor o igual a ${error.ctx?.ge}`,
    less_than_equal: `debe ser menor o igual a ${error.ctx?.le}`,
    string_too_short: 'es obligatorio',
    string_too_long: `admite máximo ${error.ctx?.max_length} caracteres`,
    missing: 'es obligatorio',
    decimal_max_places: `admite máximo ${error.ctx?.decimal_places} decimales`,
    string_pattern_mismatch: 'tiene un formato no válido',
    too_short: 'debe tener al menos un elemento',
  };
  const text = messages[error.type] || error.msg?.replace(/^Value error, /, '');
  return field && typeof field === 'string' ? `${field}: ${text}` : text;
}

function errorMessage(body, status) {
  if (typeof body?.detail === 'string') return body.detail;
  if (Array.isArray(body?.detail)) return body.detail.map(validationMessage).join('\n');
  if (status >= 500) return 'Error en el servidor. Intenta de nuevo.';
  return `Error ${status}`;
}

export async function api(path, { method = 'GET', body, form, params } = {}) {
  let url = `/api${path}`;
  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.append(key, value);
    });
    if (query.toString()) url += `?${query}`;
  }

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form instanceof FormData) {
    payload = form; // Subida de archivos
  } else if (form) {
    payload = new URLSearchParams(form); // Formulario de inicio de sesión
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0);
  }

  if (response.status === 401 && token) onUnauthorized();
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(errorMessage(data, response.status), response.status);
  return data;
}

api.get = (path, params) => api(path, { params });
api.post = (path, body) => api(path, { method: 'POST', body });
api.put = (path, body) => api(path, { method: 'PUT', body });
api.del = (path) => api(path, { method: 'DELETE' });
