// Appels HTTP vers le back-end FastAPI (module Prescriptions)
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data.detail;
    throw new Error(typeof d === "string" ? d : JSON.stringify(d) || `Erreur ${res.status}`);
  }
  return data;
}

export const prescriptionsApi = {
  options: () => request("/prescriptions/options"),
  list: (filters = {}) => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined && v !== false) p.append(k, v);
    });
    const qs = p.toString();
    return request(`/prescriptions${qs ? "?" + qs : ""}`);
  },
  alertes: () => request("/prescriptions/alertes"),
  stats: () => request("/prescriptions/stats"),
  create: (body) => request("/prescriptions", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/prescriptions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => request(`/prescriptions/${id}`, { method: "DELETE" }),
};