"""Intentions manquantes et exemples supplémentaires pour l'assistant NLP.

À importer dans routes/nlp.py APRÈS nlp_patients et nlp_medicaments :
    import nlp_complements
"""
import re
from typing import Any, Dict, List, Tuple

from nlp_engine import Intention, REGISTRE_INTENTIONS, enregistrer_intention

# ---------------------------------------------------------------------
# 1. Quels patients prennent tel médicament ?
# ---------------------------------------------------------------------
def _gen_patients_par_medicament(entites: Dict[str, Any]) -> Tuple[str, str]:
    cible = entites.get("medicament") or entites.get("molecule") or ""
    mol = entites.get("molecule") or cible
    filtre = ""
    if cible:
        filtre = f"""FILTER(
    REGEX(COALESCE(?nomCommercial, ""), "{re.escape(cible)}", "i") ||
    REGEX(COALESCE(?nomMolecule, ""), "{re.escape(mol)}", "i") ||
    REGEX(STR(?m), "{re.escape(cible)}", "i")
  )"""
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?nomPatient ?prenomPatient ?nomCommercial WHERE {{
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nomPatient ; :prendMedicament ?m .
  OPTIONAL {{ ?p :prenom ?prenomPatient }}
  OPTIONAL {{ ?m :nomCommercial ?nomCommercial }}
  OPTIONAL {{ ?m (:contientMolecule|:contientPrincipeActif)/:nom ?nomMolecule }}
  {filtre}
}} ORDER BY ?nomPatient"""
    return "SELECT", sparql


def _synth_patients_par_medicament(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("medicament") or entites.get("molecule") or "ce médicament"
    if not lignes:
        return f"Aucun patient ne prend '{cible}' dans l'ontologie."
    noms = sorted({f"{l.get('prenomPatient', '')} {l.get('nomPatient', '')}".strip() for l in lignes})
    return f"{len(noms)} patient(s) prennent '{cible}' : " + ", ".join(noms) + "."


enregistrer_intention(Intention(
    id_intention="patients_par_medicament",
    domaine="Patients (Membre C)",
    description="Lister les patients qui prennent un médicament ou une molécule donnée",
    exemples=[
        "Quels patients prennent de l'Aspirine ?",
        "Qui prend du Doliprane ?",
        "Quels patients prennent de la Warfarine ?",
        "Patients sous Ibuprofène",
        "Liste des patients traités par la Metformine",
        "Qui prend de l'Amoxicilline ?",
    ],
    mots_cles=["patients prennent", "qui prend", "patients sous", "traites par"],
    generateur_sparql=_gen_patients_par_medicament,
    synthetiseur_reponse=_synth_patients_par_medicament,
))


# ---------------------------------------------------------------------
# 2. Combien de patients ?
# ---------------------------------------------------------------------
def _gen_compter_patients(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT (COUNT(DISTINCT ?p) AS ?nb) WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom .
}"""
    return "SELECT", sparql


def _synth_compter_patients(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    nb = lignes[0].get("nb", 0) if lignes else 0
    return f"{nb} patient(s) sont enregistrés dans l'ontologie."


enregistrer_intention(Intention(
    id_intention="compter_patients",
    domaine="Patients (Membre C)",
    description="Compter le nombre de patients enregistrés",
    exemples=[
        "Combien de patients sont enregistrés ?",
        "Combien y a-t-il de patients ?",
        "Nombre de patients",
        "Quel est le nombre total de patients ?",
        "Combien de dossiers patients existent ?",
    ],
    mots_cles=["combien", "nombre de patients"],
    generateur_sparql=_gen_compter_patients,
    synthetiseur_reponse=_synth_compter_patients,
))


# ---------------------------------------------------------------------
# 3. Exemples supplémentaires pour des intentions existantes
# ---------------------------------------------------------------------
_EXEMPLES_EN_PLUS = {
    "interactions_patients": [
        "Y a-t-il des interactions médicamenteuses ?",
        "Quelles interactions médicamenteuses existent ?",
    ],
}
for _id, _ex in _EXEMPLES_EN_PLUS.items():
    if _id in REGISTRE_INTENTIONS:
        for _e in _ex:
            if _e not in REGISTRE_INTENTIONS[_id].exemples:
                REGISTRE_INTENTIONS[_id].exemples.append(_e)