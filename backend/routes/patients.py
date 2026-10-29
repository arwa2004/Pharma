"""Routes du domaine Patients (membre C).

Lecture & Filtrage :
    GET    /patients                              liste (filtres : q, age_min, age_max, renvoie nb_mÃ©dicaments et nb_pathologies)
    GET    /patients/polymedies                   classe dÃ©finie PatientPolymedique (>= 3 mÃ©d.)
    GET    /patients/pathologie-multiple          classe dÃ©finie PatientAPathologieMultiple (>= 2 patho.)
    GET    /patients/referentiel/medicaments      liste de tous les mÃ©dicaments disponibles (pour sÃ©lection UI)
    GET    /patients/referentiel/pathologies      liste de toutes les pathologies disponibles (pour sÃ©lection UI)
    GET    /patients/referentiel/medecins         liste de tous les mÃ©decins disponibles (pour sÃ©lection UI)
    GET    /patients/{id}                         fiche dÃ©taillÃ©e + interactions croisÃ©es
    GET    /patients/{id}/interactions            requÃªte croisÃ©e (mÃ©dicaments en interaction)
    GET    /patients/{id}/ask-polymedique         requÃªte ASK (vÃ©rifie si polymÃ©diquÃ©)
    GET    /patients/{id}/describe                requÃªte DESCRIBE (graphe RDF Turtle)
    GET    /patients/recherche/union              requÃªte UNION (recherche croisÃ©e)

CRUD Patients (Admin) :
    POST   /patients                              crÃ©ation patient
    PUT    /patients/{id}                         modification attributs simples
    DELETE /patients/{id}                         suppression sÃ©curisÃ©e (vÃ©rifie contrainte Prescription)

CRUD des Relations Ontologiques (Admin) :
    POST   /patients/{id}/medicaments/{id_med}    associe un mÃ©dicament (:prendMedicament)
    DELETE /patients/{id}/medicaments/{id_med}    retire un mÃ©dicament
    POST   /patients/{id}/pathologies/{id_patho}  associe une pathologie (:souffreDe)
    DELETE /patients/{id}/pathologies/{id_patho}  retire une pathologie
    PUT    /patients/{id}/medecin/{id_medecin}    assigne le mÃ©decin (:estSuiviPar max 1)
    DELETE /patients/{id}/medecin                 retire le mÃ©decin rÃ©fÃ©rent
"""
import re
import unicodedata
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

import fuseki_client as fc

router = APIRouter(prefix="/patients", tags=["Patients"])

IdPatient = Annotated[str, Path(pattern=r"^[A-Za-z0-9_\-]+$", description="ex : Pat_Sami")]
IdEntite = Annotated[str, Path(pattern=r"^[A-Za-z0-9_\-]+$", description="ex : Med_Amoxicilline")]


# ---------- ModÃ¨les de donnÃ©es ----------

class PatientIn(BaseModel):
    nom: str = Field(..., min_length=1)
    prenom: Optional[str] = None
    age: int = Field(..., ge=0, le=120)


class PatientUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=1)
    prenom: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=120)


# ---------- Fonctions utilitaires ----------

def _reponse(data, sparql: str):
    return {"data": data, "sparql": sparql.strip()}


def _existe(id_patient: str) -> bool:
    lignes = fc.select(f"SELECT ?t WHERE {{ :{id_patient} a ?t }} LIMIT 1")
    return len(lignes) > 0


def _generer_id(nom: str) -> str:
    """'Ben Ali' -> 'Pat_BenAli' (avec un suffixe numÃ©rique si conflit)."""
    ascii_nom = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode()
    base = re.sub(r"[^A-Za-z0-9]", "", ascii_nom.title()) or "Inconnu"
    candidat, n = f"Pat_{base}", 1
    while _existe(candidat):
        n += 1
        candidat = f"Pat_{base}{n}"
    return candidat


# ---------- RÃ©fÃ©rentiels pour menus dÃ©roulants UI ----------

@router.get("/referentiel/medicaments")
def referentiel_medicaments():
    """Liste tous les mÃ©dicaments disponibles pour les listes dÃ©roulantes."""
    requete = """
SELECT DISTINCT ?id ?nom WHERE {
  ?m a/rdfs:subClassOf* :Medicament .
  OPTIONAL { ?m :nomCommercial ?nom }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
} ORDER BY ?nom ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/pathologies")
def referentiel_pathologies():
    """Liste toutes les pathologies pour les listes dÃ©roulantes."""
    requete = """
SELECT DISTINCT ?id ?nom WHERE {
  ?x a/rdfs:subClassOf* :Pathologie .
  OPTIONAL { ?x :libelle ?nom }
  BIND(STRAFTER(STR(?x), "#") AS ?id)
} ORDER BY ?nom ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/medecins")
def referentiel_medecins():
    """Liste tous les mÃ©decins pour les listes dÃ©roulantes."""
    requete = """
SELECT DISTINCT ?id ?nom ?prenom WHERE {
  ?d a/rdfs:subClassOf* :Medecin .
  OPTIONAL { ?d :nom ?nom }
  OPTIONAL { ?d :prenom ?prenom }
  BIND(STRAFTER(STR(?d), "#") AS ?id)
} ORDER BY ?nom ?prenom"""
    return _reponse(fc.select(requete), requete)


# ---------- RequÃªtes SPARQL variÃ©es (ASK, UNION, DESCRIBE) ----------

@router.get("/recherche/union")
def recherche_croisee_union():
    """RequÃªte UNION dÃ©montrant la combinaison d'antÃ©cÃ©dents mÃ©dicamenteux et pathologiques."""
    requete = """
SELECT DISTINCT ?id ?nom ?typeLien ?element WHERE {
  {
    ?p :prendMedicament ?elem .
    BIND("MÃ©dicament pris" AS ?typeLien)
  }
  UNION
  {
    ?p :souffreDe ?elem .
    BIND("Pathologie" AS ?typeLien)
  }
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom .
  BIND(STRAFTER(STR(?p), "#") AS ?id)
  BIND(STRAFTER(STR(?elem), "#") AS ?element)
} ORDER BY ?nom ?typeLien"""
    return _reponse(fc.select(requete), requete)


@router.get("/alertes/interactions-tous")
def alertes_interactions_toutes():
    """RequÃªte croisÃ©e : trouve tous les patients prenant des mÃ©dicaments en interaction."""
    requete = """
SELECT DISTINCT ?id ?nom ?medA ?nomMedA ?medB ?nomMedB ?interaction ?libelle WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom ;
     :prendMedicament ?a , ?b .
  ?i :impliqueMedicament ?a , ?b .
  FILTER(STR(?a) < STR(?b))
  OPTIONAL { ?a :nomCommercial ?nomMedA }
  OPTIONAL { ?b :nomCommercial ?nomMedB }
  OPTIONAL { ?i :libelle ?libelle }
  BIND(STRAFTER(STR(?p), "#") AS ?id)
  BIND(STRAFTER(STR(?a), "#") AS ?medA)
  BIND(STRAFTER(STR(?b), "#") AS ?medB)
  BIND(STRAFTER(STR(?i), "#") AS ?interaction)
} ORDER BY ?nom"""
    return _reponse(fc.select(requete), requete)


# ---------- Listes et Vues DÃ©finies ----------

@router.get("")
def lister_patients(
    q: Optional[str] = Query(None, description="recherche dans le nom ou le prÃ©nom"),
    age_min: Optional[int] = Query(None, ge=0, le=120),
    age_max: Optional[int] = Query(None, ge=0, le=120),
):
    """Liste tous les patients avec dÃ©compte simultanÃ© des mÃ©dicaments et pathologies."""
    filtres = []
    if q:
        filtres.append(
            'FILTER(REGEX(CONCAT(?nom, " ", COALESCE(?prenom, "")), '
            f'{fc.lit(re.escape(q))}, "i"))'
        )
    if age_min is not None:
        filtres.append(f"FILTER(?age >= {age_min})")
    if age_max is not None:
        filtres.append(f"FILTER(?age <= {age_max})")

    requete = f"""
SELECT ?id ?nom ?prenom ?age
       (COUNT(DISTINCT ?m) AS ?nb_medicaments)
       (COUNT(DISTINCT ?x) AS ?nb_pathologies)
WHERE {{
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom ; :age ?age .
  OPTIONAL {{ ?p :prenom ?prenom }}
  OPTIONAL {{ ?p :prendMedicament ?m }}
  OPTIONAL {{ ?p :souffreDe ?x }}
  BIND(STRAFTER(STR(?p), "#") AS ?id)
  {chr(10).join(filtres)}
}}
GROUP BY ?id ?nom ?prenom ?age
ORDER BY ?nom"""
    return _reponse(fc.select(requete), requete)


@router.get("/polymedies")
def patients_polymedies():
    """Classe dÃ©finie PatientPolymedique : au moins 3 mÃ©dicaments distincts."""
    requete = """
SELECT ?id ?nom ?prenom ?age
       (COUNT(DISTINCT ?m) AS ?nb_medicaments)
       (COUNT(DISTINCT ?x) AS ?nb_pathologies)
WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom ; :age ?age .
  OPTIONAL { ?p :prenom ?prenom }
  OPTIONAL { ?p :prendMedicament ?m }
  OPTIONAL { ?p :souffreDe ?x }
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}
GROUP BY ?id ?nom ?prenom ?age
HAVING (COUNT(DISTINCT ?m) >= 3)
ORDER BY ?nom"""
    return _reponse(fc.select(requete), requete)


@router.get("/pathologie-multiple")
def patients_pathologie_multiple():
    """Classe dÃ©finie PatientAPathologieMultiple : au moins 2 pathologies distinctes."""
    requete = """
SELECT ?id ?nom ?prenom ?age
       (COUNT(DISTINCT ?m) AS ?nb_medicaments)
       (COUNT(DISTINCT ?x) AS ?nb_pathologies)
WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom ; :age ?age .
  OPTIONAL { ?p :prenom ?prenom }
  OPTIONAL { ?p :prendMedicament ?m }
  OPTIONAL { ?p :souffreDe ?x }
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}
GROUP BY ?id ?nom ?prenom ?age
HAVING (COUNT(DISTINCT ?x) >= 2)
ORDER BY ?nom"""
    return _reponse(fc.select(requete), requete)


# ---------- Fiche DÃ©taillÃ©e & RequÃªtes spÃ©cifiques par Patient ----------

@router.get("/{id_patient}/ask-polymedique")
def verifier_polymedication_ask(id_patient: IdPatient):
    """ExÃ©cute une requÃªte ASK pour tester directement la polymÃ©dication en boolÃ©en."""
    requete = f"""
ASK {{
  :{id_patient} :prendMedicament ?m1 , ?m2 , ?m3 .
  FILTER(?m1 != ?m2 && ?m1 != ?m3 && ?m2 != ?m3)
}}"""
    est_poly = fc.ask(requete)
    return _reponse({"id": id_patient, "polymedique_ask": est_poly}, requete)


@router.get("/{id_patient}/describe")
def exporter_rdf_describe(id_patient: IdPatient):
    """ExÃ©cute une requÃªte DESCRIBE pour renvoyer le sous-graphe RDF du patient en Turtle."""
    requete = f"DESCRIBE :{id_patient}"
    turtle = fc.describe(requete)
    return _reponse({"id": id_patient, "rdf_turtle": turtle}, requete)


@router.get("/{id_patient}/interactions")
def interactions_patient(id_patient: IdPatient):
    """RequÃªte croisÃ©e : vÃ©rifie si le patient prend des mÃ©dicaments interagissant entre eux."""
    requete = f"""
SELECT DISTINCT ?medA ?nomMedA ?medB ?nomMedB ?interaction ?libelle WHERE {{
  :{id_patient} :prendMedicament ?a , ?b .
  ?i :impliqueMedicament ?a , ?b .
  FILTER(STR(?a) < STR(?b))
  OPTIONAL {{ ?a :nomCommercial ?nomMedA }}
  OPTIONAL {{ ?b :nomCommercial ?nomMedB }}
  OPTIONAL {{ ?i :libelle ?libelle }}
  BIND(STRAFTER(STR(?a), "#") AS ?medA)
  BIND(STRAFTER(STR(?b), "#") AS ?medB)
  BIND(STRAFTER(STR(?i), "#") AS ?interaction)
}}"""
    return _reponse(fc.select(requete), requete)


@router.get("/{id_patient}")
def fiche_patient(id_patient: IdPatient):
    """Fiche patient complÃ¨te incluant antÃ©cÃ©dents, mÃ©decin et alertes sÃ©mantiques."""
    info = fc.select(f"""
SELECT ?nom ?prenom ?age WHERE {{
  :{id_patient} a/rdfs:subClassOf* :Patient ; :nom ?nom ; :age ?age .
  OPTIONAL {{ :{id_patient} :prenom ?prenom }}
}} LIMIT 1""")
    if not info:
        raise HTTPException(404, f"Patient {id_patient} introuvable")

    medicaments = fc.select(f"""
SELECT ?id ?nom WHERE {{
  :{id_patient} :prendMedicament ?m .
  OPTIONAL {{ ?m :nomCommercial ?nom }}
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} ORDER BY ?nom ?id""")

    pathologies = fc.select(f"""
SELECT ?id ?nom WHERE {{
  :{id_patient} :souffreDe ?x .
  OPTIONAL {{ ?x :libelle ?nom }}
  BIND(STRAFTER(STR(?x), "#") AS ?id)
}} ORDER BY ?nom ?id""")

    medecin = fc.select(f"""
SELECT ?id ?nom ?prenom WHERE {{
  :{id_patient} :estSuiviPar ?m .
  OPTIONAL {{ ?m :nom ?nom }}
  OPTIONAL {{ ?m :prenom ?prenom }}
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} LIMIT 1""")

    # DÃ©tection des interactions croisÃ©es
    interactions = fc.select(f"""
SELECT DISTINCT ?medA ?nomMedA ?medB ?nomMedB ?interaction ?libelle WHERE {{
  :{id_patient} :prendMedicament ?a , ?b .
  ?i :impliqueMedicament ?a , ?b .
  FILTER(STR(?a) < STR(?b))
  OPTIONAL {{ ?a :nomCommercial ?nomMedA }}
  OPTIONAL {{ ?b :nomCommercial ?nomMedB }}
  OPTIONAL {{ ?i :libelle ?libelle }}
  BIND(STRAFTER(STR(?a), "#") AS ?medA)
  BIND(STRAFTER(STR(?b), "#") AS ?medB)
  BIND(STRAFTER(STR(?i), "#") AS ?interaction)
}}""")

    fiche = {
        "id": id_patient,
        **info[0],
        "medicaments": medicaments,
        "pathologies": pathologies,
        "medecin": medecin[0] if medecin else None,
        "interactions": interactions,
        "polymedique": len(medicaments) >= 3,
        "pathologie_multiple": len(pathologies) >= 2,
    }
    return _reponse(fiche, "RequÃªtes SELECT combinÃ©es (infos, mÃ©dicaments, pathologies, mÃ©decin, interactions)")


# ---------- CRUD Patients (RÃ©servÃ© Admin) ----------

@router.post("", status_code=201)
def creer_patient(p: PatientIn):
    id_patient = _generer_id(p.nom)
    triplets = [f"a :Patient", f":nom {fc.lit(p.nom)}"]
    if p.prenom:
        triplets.append(f":prenom {fc.lit(p.prenom)}")
    triplets.append(f":age {p.age}")
    requete = f"INSERT DATA {{\n  :{id_patient} " + " ;\n    ".join(triplets) + " .\n}"
    fc.update(requete)
    return _reponse({"id": id_patient, "nom": p.nom, "prenom": p.prenom, "age": p.age}, requete)


@router.put("/{id_patient}")
def modifier_patient(p: PatientUpdate, id_patient: IdPatient):
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")
    champs = p.model_dump(exclude_none=True)
    if not champs:
        raise HTTPException(400, "Aucun champ Ã  modifier")

    operations = []
    for champ, valeur in champs.items():
        v = fc.lit(valeur) if isinstance(valeur, str) else valeur
        operations.append(f"DELETE WHERE {{ :{id_patient} :{champ} ?ancien }}")
        operations.append(f"INSERT DATA {{ :{id_patient} :{champ} {v} }}")
    requete = " ;\n".join(operations)
    fc.update(requete)
    return _reponse({"id": id_patient, **champs}, requete)


@router.delete("/{id_patient}")
def supprimer_patient(id_patient: IdPatient):
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")

    # RESPECT DE L'AXIOME ONTOLOGIQUE : Prescription :pourPatient exactly 1 :Patient
    prescriptions = fc.select(f"""
SELECT ?presc WHERE {{
  ?presc a/rdfs:subClassOf* :Prescription ; :pourPatient :{id_patient} .
}} LIMIT 5""")
    if prescriptions:
        noms_p = ", ".join([f":{p['presc']}" for p in prescriptions])
        raise HTTPException(
            status_code=400,
            detail=(
                f"Suppression bloquÃ©e (Axiome OWL) : le patient :{id_patient} est rÃ©fÃ©rencÃ© par {len(prescriptions)} "
                f"prescription(s) ({noms_p}). Une prescription ne peut exister sans patient."
            ),
        )

    requete = (
        f"DELETE WHERE {{ :{id_patient} ?p ?o }} ;\n"
        f"DELETE WHERE {{ ?s ?p :{id_patient} }}"
    )
    fc.update(requete)
    return _reponse({"supprime": id_patient}, requete)


# ---------- CRUD DES RELATIONS ONTOLOGIQUES (VALEUR AJOUTÃ‰E) ----------

@router.post("/{id_patient}/medicaments/{id_medicament}", status_code=201)
def ajouter_medicament_patient(
    id_patient: IdPatient,
    id_medicament: IdEntite,
):
    """Ajoute le lien :prendMedicament entre le patient et le mÃ©dicament."""
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")
    requete = f"INSERT DATA {{\n  :{id_patient} :prendMedicament :{id_medicament} .\n}}"
    fc.update(requete)
    return _reponse({"patient": id_patient, "medicament": id_medicament, "action": "ajoute"}, requete)


@router.delete("/{id_patient}/medicaments/{id_medicament}")
def supprimer_medicament_patient(
    id_patient: IdPatient,
    id_medicament: IdEntite,
):
    """Retire le lien :prendMedicament."""
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")
    requete = f"DELETE DATA {{\n  :{id_patient} :prendMedicament :{id_medicament} .\n}}"
    fc.update(requete)
    return _reponse({"patient": id_patient, "medicament": id_medicament, "action": "supprime"}, requete)


@router.post("/{id_patient}/pathologies/{id_pathologie}", status_code=201)
def ajouter_pathologie_patient(
    id_patient: IdPatient,
    id_pathologie: IdEntite,
):
    """Ajoute le lien :souffreDe entre le patient et la pathologie."""
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")
    requete = f"INSERT DATA {{\n  :{id_patient} :souffreDe :{id_pathologie} .\n}}"
    fc.update(requete)
    return _reponse({"patient": id_patient, "pathologie": id_pathologie, "action": "ajoute"}, requete)


@router.delete("/{id_patient}/pathologies/{id_pathologie}")
def supprimer_pathologie_patient(
    id_patient: IdPatient,
    id_pathologie: IdEntite,
):
    """Retire le lien :souffreDe."""
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")
    requete = f"DELETE DATA {{\n  :{id_patient} :souffreDe :{id_pathologie} .\n}}"
    fc.update(requete)
    return _reponse({"patient": id_patient, "pathologie": id_pathologie, "action": "supprime"}, requete)


@router.put("/{id_patient}/medecin/{id_medecin}")
def assigner_medecin_patient(
    id_patient: IdPatient,
    id_medecin: IdEntite,
):
    """Assigne un mÃ©decin rÃ©fÃ©rent en respectant l'axiome :estSuiviPar max 1 Medecin."""
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")
    # Supprime l'ancien mÃ©decin Ã©ventuel puis insÃ¨re le nouveau
    requete = (
        f"DELETE WHERE {{ :{id_patient} :estSuiviPar ?ancien }} ;\n"
        f"INSERT DATA  {{ :{id_patient} :estSuiviPar :{id_medecin} }}"
    )
    fc.update(requete)
    return _reponse({"patient": id_patient, "medecin": id_medecin, "action": "assigne"}, requete)


@router.delete("/{id_patient}/medecin")
def retirer_medecin_patient(
    id_patient: IdPatient,
):
    """Retire le mÃ©decin rÃ©fÃ©rent (:estSuiviPar)."""
    if not _existe(id_patient):
        raise HTTPException(404, f"Patient {id_patient} introuvable")
    requete = f"DELETE WHERE {{ :{id_patient} :estSuiviPar ?ancien }}"
    fc.update(requete)
    return _reponse({"patient": id_patient, "action": "medecin_retire"}, requete)
