// Service API – accès direct, sans authentification
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(BASE + path, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("API injoignable : le back-end (port 8000) est-il lancé ?");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const d = body?.detail;
    const message =
      typeof d === "string"
        ? d
        : Array.isArray(d)
        ? d.map((e) => e.msg).join(", ")
        : `Erreur ${res.status}`;
    throw new Error(message);
  }
  return body; // forme commune : { data, sparql }
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body = {}) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" }),

  // Référentiels pour menus déroulants
  referentielMedicaments: () => request("/patients/referentiel/medicaments"),
  referentielPathologies: () => request("/patients/referentiel/pathologies"),
  referentielMedecins: () => request("/patients/referentiel/medecins"),

  // CRUD des relations ontologiques
  ajouterMedicament: (idPatient, idMed) => request(`/patients/${idPatient}/medicaments/${idMed}`, { method: "POST" }),
  supprimerMedicament: (idPatient, idMed) => request(`/patients/${idPatient}/medicaments/${idMed}`, { method: "DELETE" }),
  ajouterPathologie: (idPatient, idPatho) => request(`/patients/${idPatient}/pathologies/${idPatho}`, { method: "POST" }),
  supprimerPathologie: (idPatient, idPatho) => request(`/patients/${idPatient}/pathologies/${idPatho}`, { method: "DELETE" }),
  assignerMedecin: (idPatient, idMedecin) => request(`/patients/${idPatient}/medecin/${idMedecin}`, { method: "PUT" }),
  retirerMedecin: (idPatient) => request(`/patients/${idPatient}/medecin`, { method: "DELETE" }),

  // Variété de requêtes SPARQL
  askPolymedique: (idPatient) => request(`/patients/${idPatient}/ask-polymedique`),
  describeRdf: (idPatient) => request(`/patients/${idPatient}/describe`),
  interactionsPatient: (idPatient) => request(`/patients/${idPatient}/interactions`),

  // Module IA / NLP (spaCy local sans LLM)
  askNlp: (question) =>
    request("/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  exemplesNlp: () => request("/ask/exemples"),
  intentionsNlp: () => request("/ask/intentions"),
};
