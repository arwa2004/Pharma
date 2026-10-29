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

  // ---------- Module Risques (membre B) ----------
  referentielMedicamentsRisques: () => request("/risques/referentiel/medicaments"),
  referentielPathologiesRisques: () => request("/risques/referentiel/pathologies"),

  // Vues / classes définies
  medicamentsRisque: () => request("/risques/medicaments-risque"),
  medicamentsCiAbsolue: () => request("/risques/medicaments-ci-absolue"),
  medicamentsInteraction: () => request("/risques/medicaments-interaction"),
  unionRisques: () => request("/risques/recherche/union"),
  alertesVigilanceRisques: () => request("/risques/alertes/vigilance"),

  // Effets secondaires
  listerEffets: (params = "") => request(`/risques/effets${params}`),
  ficheEffet: (id) => request(`/risques/effets/${id}`),
  askGraveEffet: (id) => request(`/risques/effets/${id}/ask-grave`),
  describeEffet: (id) => request(`/risques/effets/${id}/describe`),
  creerEffet: (body) => request("/risques/effets", { method: "POST", body: JSON.stringify(body) }),
  modifierEffet: (id, body) => request(`/risques/effets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  supprimerEffet: (id) => request(`/risques/effets/${id}`, { method: "DELETE" }),
  associerMedicamentEffet: (id, idMed) => request(`/risques/effets/${id}/medicaments/${idMed}`, { method: "POST" }),
  retirerMedicamentEffet: (id, idMed) => request(`/risques/effets/${id}/medicaments/${idMed}`, { method: "DELETE" }),

  // Contre-indications
  listerContreIndications: (params = "") => request(`/risques/contre-indications${params}`),
  ficheContreIndication: (id) => request(`/risques/contre-indications/${id}`),
  askAbsolueCi: (id) => request(`/risques/contre-indications/${id}/ask-absolue`),
  describeCi: (id) => request(`/risques/contre-indications/${id}/describe`),
  creerContreIndication: (body) => request("/risques/contre-indications", { method: "POST", body: JSON.stringify(body) }),
  modifierContreIndication: (id, body) => request(`/risques/contre-indications/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  supprimerContreIndication: (id) => request(`/risques/contre-indications/${id}`, { method: "DELETE" }),
  associerMedicamentCi: (id, idMed) => request(`/risques/contre-indications/${id}/medicaments/${idMed}`, { method: "POST" }),
  retirerMedicamentCi: (id, idMed) => request(`/risques/contre-indications/${id}/medicaments/${idMed}`, { method: "DELETE" }),
  associerPathologieCi: (id, idPatho) => request(`/risques/contre-indications/${id}/pathologies/${idPatho}`, { method: "POST" }),
  retirerPathologieCi: (id, idPatho) => request(`/risques/contre-indications/${id}/pathologies/${idPatho}`, { method: "DELETE" }),

  // Interactions
  listerInteractions: (params = "") => request(`/risques/interactions${params}`),
  ficheInteraction: (id) => request(`/risques/interactions/${id}`),
  describeInteraction: (id) => request(`/risques/interactions/${id}/describe`),
  creerInteraction: (body) => request("/risques/interactions", { method: "POST", body: JSON.stringify(body) }),
  modifierInteraction: (id, body) => request(`/risques/interactions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  supprimerInteraction: (id) => request(`/risques/interactions/${id}`, { method: "DELETE" }),
  ajouterMedicamentInteraction: (id, idMed) => request(`/risques/interactions/${id}/medicaments/${idMed}`, { method: "POST" }),
  retirerMedicamentInteraction: (id, idMed) => request(`/risques/interactions/${id}/medicaments/${idMed}`, { method: "DELETE" }),

  // Module IA / NLP (spaCy local sans LLM)
  askNlp: (question) =>
    request("/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  exemplesNlp: () => request("/ask/exemples"),
  intentionsNlp: () => request("/ask/intentions"),
};
