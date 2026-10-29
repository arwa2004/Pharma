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

  // ==========================================
  // DOMAINE A : MÉDICAMENTS & COMPOSITION
  // ==========================================
  listerMedicaments: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    });
    const s = qs.toString();
    return request(`/medicaments${s ? "?" + s : ""}`);
  },
  listerMedicamentsContreIndicationAbsolue: () => request("/medicaments/contre-indication-absolue"),
  ficheMedicament: (id) => request(`/medicaments/${id}`),
  creerMedicament: (data) => request("/medicaments", { method: "POST", body: JSON.stringify(data) }),
  modifierMedicament: (id, data) => request(`/medicaments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  supprimerMedicament: (id) => request(`/medicaments/${id}`, { method: "DELETE" }),
  askOrdonnance: (id) => request(`/medicaments/${id}/ask-ordonnance`),
  describeMedicament: (id) => request(`/medicaments/${id}/describe`),
  rechercheRapide: (q) => request(`/medicaments/recherche?q=${encodeURIComponent(q)}`),

  // Référentiels Domaine A
  referentielMolecules: () => request("/medicaments/referentiel/molecules"),
  referentielFormes: () => request("/medicaments/referentiel/formes"),
  referentielVoies: () => request("/medicaments/referentiel/voies"),
  referentielClasses: () => request("/medicaments/referentiel/classes"),
  referentielLaboratoires: () => request("/medicaments/referentiel/laboratoires"),
  referentielExcipients: () => request("/medicaments/referentiel/excipients"),

  // Composition (Relations)
  associerMolecule: (idMed, idMol) => request(`/medicaments/${idMed}/molecules/${idMol}`, { method: "POST" }),
  dissocierMolecule: (idMed, idMol) => request(`/medicaments/${idMed}/molecules/${idMol}`, { method: "DELETE" }),
  associerExcipient: (idMed, idExc) => request(`/medicaments/${idMed}/excipients/${idExc}`, { method: "POST" }),
  dissocierExcipient: (idMed, idExc) => request(`/medicaments/${idMed}/excipients/${idExc}`, { method: "DELETE" }),

  // Laboratoires (CRUD)
  listerLaboratoires: () => request("/medicaments/laboratoires/liste"),
  creerLaboratoire: (data) => request("/medicaments/laboratoires", { method: "POST", body: JSON.stringify(data) }),
  modifierLaboratoire: (id, data) => request(`/medicaments/laboratoires/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  supprimerLaboratoire: (id) => request(`/medicaments/laboratoires/${id}`, { method: "DELETE" }),

  // ==========================================
  // DOMAINE C : PATIENTS (Référentiels & CRUD)
  // ==========================================
  referentielMedicaments: () => request("/patients/referentiel/medicaments"),
  referentielPathologies: () => request("/patients/referentiel/pathologies"),
  referentielMedecins: () => request("/patients/referentiel/medecins"),

  ajouterMedicament: (idPatient, idMed) => request(`/patients/${idPatient}/medicaments/${idMed}`, { method: "POST" }),
  supprimerMedicament: (idPatient, idMed) => request(`/patients/${idPatient}/medicaments/${idMed}`, { method: "DELETE" }),
  ajouterPathologie: (idPatient, idPatho) => request(`/patients/${idPatient}/pathologies/${idPatho}`, { method: "POST" }),
  supprimerPathologie: (idPatient, idPatho) => request(`/patients/${idPatient}/pathologies/${idPatho}`, { method: "DELETE" }),
  assignerMedecin: (idPatient, idMedecin) => request(`/patients/${idPatient}/medecin/${idMedecin}`, { method: "PUT" }),
  retirerMedecin: (idPatient) => request(`/patients/${idPatient}/medecin`, { method: "DELETE" }),

  askPolymedique: (idPatient) => request(`/patients/${idPatient}/ask-polymedique`),
  describeRdf: (idPatient) => request(`/patients/${idPatient}/describe`),
  interactionsPatient: (idPatient) => request(`/patients/${idPatient}/interactions`),

  // ==========================================
  // MODULE IA / NLP (spaCy local sans LLM)
  // ==========================================
  askNlp: (question) =>
    request("/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  exemplesNlp: () => request("/ask/exemples"),
  intentionsNlp: () => request("/ask/intentions"),
};
