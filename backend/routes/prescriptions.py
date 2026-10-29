"""
Module D - Prescriptions : CRUD + filtrage + recherche + alertes (SPARQL via Fuseki)
"""
import os
import re
import uuid
from datetime import date
from typing import List, Optional

import requests
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])

# ------------------------------------------------------------------
# Configuration Fuseki
# ------------------------------------------------------------------
FUSEKI_DATASET = os.getenv("FUSEKI_DATASET", "http://localhost:3030/pharma")
QUERY_URL = f"{FUSEKI_DATASET}/query"
UPDATE_URL = f"{FUSEKI_DATASET}/update"

NS = "http://www.esprit.tn/ontologies/pharma-sante#"
PREFIXES = f"""PREFIX :    <{NS}>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

ID_RE = re.compile(r"^[A-Za-z0-9_]+$")


# ------------------------------------------------------------------
# Helpers bas niveau
# ------------------------------------------------------------------
def sparql_select(query: str) -> List[dict]:
    """Execute un SELECT et renvoie une liste de dict {variable: valeur}."""
    try:
        r = requests.post(
            QUERY_URL,
            data={"query": query},
            headers={"Accept": "application/sparql-results+json"},
            timeout=15,
        )
    except requests.RequestException as e:
        raise HTTPException(503, f"Fuseki injoignable : {e}")
    if r.status_code != 200:
        raise HTTPException(500, f"Erreur SPARQL : {r.text[:300]}")
    rows = []
    for b in r.json()["results"]["bindings"]:
        rows.append({k: v["value"] for k, v in b.items()})
    return rows


def sparql_ask(query: str) -> bool:
    try:
        r = requests.post(
            QUERY_URL,
            data={"query": query},
            headers={"Accept": "application/sparql-results+json"},
            timeout=15,
        )
    except requests.RequestException as e:
        raise HTTPException(503, f"Fuseki injoignable : {e}")
    if r.status_code != 200:
        raise HTTPException(500, f"Erreur SPARQL : {r.text[:300]}")
    return r.json()["boolean"]


def sparql_update(update: str) -> None:
    try:
        r = requests.post(UPDATE_URL, data={"update": update}, timeout=15)
    except requests.RequestException as e:
        raise HTTPException(503, f"Fuseki injoignable : {e}")
    if r.status_code not in (200, 204):
        raise HTTPException(500, f"Erreur SPARQL Update : {r.text[:300]}")


def lit(s: str) -> str:
    """Echappe une chaine pour l'inclure dans un litteral SPARQL (anti-injection)."""
    s = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "")
    return f'"{s}"'


def iri(local_id: str) -> str:
    """Construit :Identifiant apres validation (anti-injection)."""
    if not ID_RE.match(local_id or ""):
        raise HTTPException(400, f"Identifiant invalide : {local_id!r}")
    return f":{local_id}"


# ------------------------------------------------------------------
# Modele de donnees (corps des requetes POST / PUT)
# ------------------------------------------------------------------
class PrescriptionIn(BaseModel):
    medecin: str = Field(..., description="id du medecin, ex: Dr_BenSalah")
    patient: str = Field(..., description="id du patient, ex: Pat_Amina")
    medicaments: List[str] = Field(..., min_length=1)
    pharmacien: Optional[str] = None
    date_prescription: date
    duree_jours: int = Field(..., ge=1, le=3650)
    posologie: str = Field(..., min_length=1, max_length=300)


def validate_payload(p: PrescriptionIn) -> None:
    """Verifie que les references existent et respectent les axiomes de l'ontologie."""
    checks = [(p.medecin, "Medecin"), (p.patient, "Patient")]
    if p.pharmacien:
        checks.append((p.pharmacien, "Pharmacien"))
    for local_id, cls in checks:
        if not sparql_ask(PREFIXES + f"ASK {{ {iri(local_id)} a :{cls} }}"):
            raise HTTPException(400, f"'{local_id}' n'est pas un(e) {cls} connu(e)")
    # Axiome : une prescription ne porte que sur des MedicamentSurOrdonnance
    for m in p.medicaments:
        if not sparql_ask(PREFIXES + f"ASK {{ {iri(m)} a :MedicamentSurOrdonnance }}"):
            raise HTTPException(
                400, f"'{m}' n'est pas un medicament sur ordonnance (axiome de l'ontologie)"
            )


def build_triples(pid: str, p: PrescriptionIn) -> str:
    t = [f"{iri(pid)} a :Prescription ;",
         f"   :emisePar {iri(p.medecin)} ;",
         f"   :pourPatient {iri(p.patient)} ;"]
    for m in sorted(set(p.medicaments)):
        t.append(f"   :prescritMedicament {iri(m)} ;")
    if p.pharmacien:
        t.append(f"   :delivreePar {iri(p.pharmacien)} ;")
    t.append(f'   :datePrescription "{p.date_prescription.isoformat()}T00:00:00"^^xsd:dateTime ;')
    t.append(f'   :dureeTraitementJours "{p.duree_jours}"^^xsd:integer ;')
    t.append(f"   :posologie {lit(p.posologie)} .")
    return "\n".join(t)


# ------------------------------------------------------------------
# READ : listes pour les formulaires (medecins, patients, ...)
# ------------------------------------------------------------------
@router.get("/options")
def options():
    q = PREFIXES + """
SELECT ?type ?id ?label WHERE {
  { ?x a :Medecin    . BIND("medecins"    AS ?type) }
  UNION { ?x a :Pharmacien . BIND("pharmaciens" AS ?type) }
  UNION { ?x a :Patient    . BIND("patients"    AS ?type) }
  UNION { ?x a :MedicamentSurOrdonnance . BIND("medicaments" AS ?type) }
  OPTIONAL { ?x :prenom ?pr } OPTIONAL { ?x :nom ?n } OPTIONAL { ?x :nomCommercial ?nc }
  BIND(STRAFTER(STR(?x), "#") AS ?id)
  BIND(COALESCE(?nc, CONCAT(COALESCE(?pr, ""), " ", COALESCE(?n, ""))) AS ?label)
}
ORDER BY ?type ?label
"""
    out = {"medecins": [], "pharmaciens": [], "patients": [], "medicaments": []}
    for r in sparql_select(q):
        out[r["type"]].append({"id": r["id"], "label": r["label"].strip()})
    return out


# ------------------------------------------------------------------
# READ : liste + filtrage + recherche
# ------------------------------------------------------------------
LIST_SELECT = """
SELECT ?p ?date ?duree ?posologie
       ?doc ?docNom ?pat ?patNom ?ph ?phNom
       (GROUP_CONCAT(DISTINCT CONCAT(STRAFTER(STR(?m), "#"), "|", ?mNom); separator=";") AS ?meds)
WHERE {
  ?p a :Prescription ;
     :emisePar ?doc ;
     :pourPatient ?pat ;
     :prescritMedicament ?m .
  ?m :nomCommercial ?mNom .
  ?doc :nom ?dn . OPTIONAL { ?doc :prenom ?dp }
  ?pat :nom ?pn . OPTIONAL { ?pat :prenom ?pp }
  BIND(CONCAT("Dr ", COALESCE(?dp, ""), " ", ?dn) AS ?docNom)
  BIND(CONCAT(COALESCE(?pp, ""), " ", ?pn) AS ?patNom)
  OPTIONAL { ?p :datePrescription ?date }
  OPTIONAL { ?p :dureeTraitementJours ?duree }
  OPTIONAL { ?p :posologie ?posologie }
  OPTIONAL { ?p :delivreePar ?ph . ?ph :nom ?phn . OPTIONAL { ?ph :prenom ?php }
             BIND(CONCAT(COALESCE(?php, ""), " ", ?phn) AS ?phNom) }
  %(filters)s
}
GROUP BY ?p ?date ?duree ?posologie ?doc ?docNom ?pat ?patNom ?ph ?phNom
ORDER BY DESC(?date) ?p
"""


def parse_row(r: dict) -> dict:
    meds = []
    for chunk in filter(None, r.get("meds", "").split(";")):
        mid, _, nom = chunk.partition("|")
        meds.append({"id": mid, "nom": nom})
    sid = lambda k: r[k].split("#")[-1] if k in r else None
    return {
        "id": sid("p"),
        "date": (r.get("date") or "")[:10],
        "duree_jours": int(r["duree"]) if r.get("duree") else None,
        "posologie": r.get("posologie", ""),
        "medecin": {"id": sid("doc"), "nom": r["docNom"].strip()},
        "patient": {"id": sid("pat"), "nom": r["patNom"].strip()},
        "pharmacien": {"id": sid("ph"), "nom": r["phNom"].strip()} if "ph" in r else None,
        "medicaments": meds,
    }


@router.get("")
def list_prescriptions(
    q: Optional[str] = Query(None, description="recherche libre"),
    medecin: Optional[str] = None,
    patient: Optional[str] = None,
    medicament: Optional[str] = None,
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    duree_min: Optional[int] = None,
    non_delivrees: bool = False,
):
    f = []
    if q:
        s = lit(q.lower())
        f.append(f"""FILTER( CONTAINS(LCASE(?patNom), {s}) || CONTAINS(LCASE(?docNom), {s})
                 || CONTAINS(LCASE(COALESCE(?posologie, "")), {s})
                 || EXISTS {{ ?p :prescritMedicament ?mq . ?mq :nomCommercial ?mqn .
                             FILTER(CONTAINS(LCASE(?mqn), {s})) }} )""")
    if medecin:
        f.append(f"FILTER(?doc = {iri(medecin)})")
    if patient:
        f.append(f"FILTER(?pat = {iri(patient)})")
    if medicament:
        f.append(f"FILTER EXISTS {{ ?p :prescritMedicament {iri(medicament)} }}")
    if date_debut:
        f.append(f'FILTER(?date >= "{date_debut}T00:00:00"^^xsd:dateTime)')
    if date_fin:
        f.append(f'FILTER(?date <= "{date_fin}T23:59:59"^^xsd:dateTime)')
    if duree_min:
        f.append(f"FILTER(?duree >= {int(duree_min)})")
    if non_delivrees:
        f.append("FILTER NOT EXISTS { ?p :delivreePar ?x }")

    query = PREFIXES + LIST_SELECT % {"filters": "\n  ".join(f)}
    items = [parse_row(r) for r in sparql_select(query)]
    return {"count": len(items), "sparql": query, "items": items}


# ------------------------------------------------------------------
# READ : alertes (interactions medicamenteuses) et statistiques
# ------------------------------------------------------------------
@router.get("/alertes")
def alertes():
    q = PREFIXES + """
SELECT DISTINCT ?p ?m1 ?n1 ?m2 ?n2 WHERE {
  ?p a :Prescription ; :prescritMedicament ?m1 , ?m2 .
  { ?m1 :interagitAvec ?m2 } UNION { ?m2 :interagitAvec ?m1 }
  ?m1 :nomCommercial ?n1 . ?m2 :nomCommercial ?n2 .
  FILTER(STR(?m1) < STR(?m2))
}
ORDER BY ?p
"""
    return [
        {"prescription": r["p"].split("#")[-1], "medicament1": r["n1"], "medicament2": r["n2"]}
        for r in sparql_select(q)
    ]


@router.get("/stats")
def stats():
    q = PREFIXES + """
SELECT ?doc ?nom (COUNT(DISTINCT ?p) AS ?nb) WHERE {
  ?p a :Prescription ; :emisePar ?doc .
  ?doc :nom ?nom .
} GROUP BY ?doc ?nom ORDER BY DESC(?nb)
"""
    return [{"medecin": r["nom"], "nb": int(r["nb"])} for r in sparql_select(q)]


# ------------------------------------------------------------------
# READ : une prescription
# ------------------------------------------------------------------
@router.get("/{pid}")
def get_prescription(pid: str):
    q = PREFIXES + LIST_SELECT % {"filters": f"FILTER(?p = {iri(pid)})"}
    rows = sparql_select(q)
    if not rows:
        raise HTTPException(404, "Prescription introuvable")
    return parse_row(rows[0])


# ------------------------------------------------------------------
# CREATE
# ------------------------------------------------------------------
@router.post("", status_code=201)
def create_prescription(body: PrescriptionIn):
    validate_payload(body)
    pid = f"Presc_{uuid.uuid4().hex[:8]}"
    update = PREFIXES + f"INSERT DATA {{\n{build_triples(pid, body)}\n}}"
    sparql_update(update)
    return {"id": pid, "sparql": update}


# ------------------------------------------------------------------
# UPDATE (remplace toutes les proprietes sauf le type)
# ------------------------------------------------------------------
@router.put("/{pid}")
def update_prescription(pid: str, body: PrescriptionIn):
    if not sparql_ask(PREFIXES + f"ASK {{ {iri(pid)} a :Prescription }}"):
        raise HTTPException(404, "Prescription introuvable")
    validate_payload(body)
    update = PREFIXES + f"""
DELETE {{ {iri(pid)} ?p ?o }}
WHERE  {{ {iri(pid)} ?p ?o . FILTER(?p != rdf:type) }} ;
INSERT DATA {{
{build_triples(pid, body)}
}}"""
    sparql_update(update)
    return {"id": pid, "sparql": update}


# ------------------------------------------------------------------
# DELETE
# ------------------------------------------------------------------
@router.delete("/{pid}")
def delete_prescription(pid: str):
    if not sparql_ask(PREFIXES + f"ASK {{ {iri(pid)} a :Prescription }}"):
        raise HTTPException(404, "Prescription introuvable")
    update = PREFIXES + f"""
DELETE WHERE {{ {iri(pid)} ?p ?o }} ;
DELETE WHERE {{ ?s ?p {iri(pid)} }}"""
    sparql_update(update)
    return {"deleted": pid, "sparql": update}