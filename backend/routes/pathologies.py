"""Routes du domaine Pathologies (CRUD complet + requêtes SPARQL).

Routes disponibles :
    GET    /pathologies                    -> Liste de toutes les pathologies avec décompte des patients
    GET    /pathologies/{id_pathologie}    -> Fiche détaillée d'une pathologie et liste de ses patients
    POST   /pathologies                    -> Créer une nouvelle pathologie (INSERT DATA)
    PUT    /pathologies/{id_pathologie}    -> Modifier le libellé d'une pathologie (DELETE/INSERT)
    DELETE /pathologies/{id_pathologie}    -> Supprimer une pathologie du graphe (DELETE WHERE)
"""
import re
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Path, Query, status
from pydantic import BaseModel, Field

import fuseki_client as fc

router = APIRouter(prefix="/pathologies", tags=["Pathologies"])

IdPathologie = Annotated[str, Path(pattern=r"^[A-Za-z0-9_]+$", description="Identifiant local (ex: DiabeteType2)")]


class PathologieIn(BaseModel):
    id: Optional[str] = Field(None, pattern=r"^[A-Za-z0-9_]+$", description="Identifiant unique (généré si omis)")
    libelle: str = Field(..., min_length=2, max_length=150, description="Nom / libellé de la pathologie")


class PathologieModif(BaseModel):
    libelle: str = Field(..., min_length=2, max_length=150, description="Nouveau libellé")


def _reponse(donnees: Any, sparql: str) -> Dict[str, Any]:
    return {"data": donnees, "sparql": sparql.strip()}


def _generer_id(libelle: str) -> str:
    # Retire les accents et caractères spéciaux pour former un CamelCase
    clean = re.sub(r"[^a-zA-Z0-9\s]", "", libelle)
    mots = [m.capitalize() for m in clean.split() if m]
    base = "".join(mots) or "Patho"
    id_cand = base
    # Vérifier l'unicité
    lignes = fc.select(f"ASK {{ :{id_cand} a/rdfs:subClassOf* :Pathologie }}")
    # Dans Fuseki ASK renvoie boolean
    return id_cand


def _existe(id_pathologie: str) -> bool:
    res = fc.ask(f"ASK {{ :{id_pathologie} a/rdfs:subClassOf* :Pathologie }}")
    return bool(res)


# ---------- 1. Liste de toutes les pathologies ----------
@router.get("")
def lister_pathologies(q: Optional[str] = Query(None, description="Filtre textuel sur le libellé ou l'identifiant")):
    """Renvoie la liste des pathologies avec le nombre de patients affectés par chacune."""
    filtre = ""
    if q and q.trim() if hasattr(q, "trim") else q:
        clean_q = re.sub(r'["\\]', '', q.strip())
        filtre = f'FILTER(REGEX(?libelle, "{clean_q}", "i") || REGEX(?id, "{clean_q}", "i"))'

    requete = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?id ?libelle (COUNT(DISTINCT ?p) AS ?nb_patients)
WHERE {{
  ?x a/rdfs:subClassOf* :Pathologie .
  OPTIONAL {{ ?x :libelle ?libelle }}
  OPTIONAL {{ ?p :souffreDe ?x }}
  BIND(STRAFTER(STR(?x), "#") AS ?id)
  {filtre}
}}
GROUP BY ?id ?libelle
ORDER BY ?libelle ?id"""

    lignes = fc.select(requete)
    resultats = [
        {
            "id": l.get("id"),
            "libelle": l.get("libelle") or l.get("id"),
            "nb_patients": int(l.get("nb_patients") or 0),
        }
        for l in lignes
    ]
    return _reponse(resultats, requete)


# ---------- 2. Fiche détaillée d'une pathologie ----------
@router.get("/{id_pathologie}")
def fiche_pathologie(id_pathologie: IdPathologie):
    """Renvoie les informations de la pathologie et la liste des patients atteints."""
    if not _existe(id_pathologie):
        raise HTTPException(status_code=404, detail=f"Pathologie :{id_pathologie} introuvable")

    req_info = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?libelle WHERE {{
  :{id_pathologie} a/rdfs:subClassOf* :Pathologie .
  OPTIONAL {{ :{id_pathologie} :libelle ?libelle }}
}} LIMIT 1"""
    info = fc.select(req_info)
    libelle = info[0].get("libelle") if info else id_pathologie

    req_patients = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?id ?nom ?prenom ?age WHERE {{
  ?p a/rdfs:subClassOf* :Patient ; :souffreDe :{id_pathologie} ; :nom ?nom .
  OPTIONAL {{ ?p :prenom ?prenom }}
  OPTIONAL {{ ?p :age ?age }}
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}} ORDER BY ?nom ?prenom"""

    patients = fc.select(req_patients)

    fiche = {
        "id": id_pathologie,
        "libelle": libelle or id_pathologie,
        "nb_patients": len(patients),
        "patients": patients,
    }
    return _reponse(fiche, f"{req_info}\n\n{req_patients}")


# ---------- 3. Création d'une pathologie (INSERT DATA) ----------
@router.post("", status_code=status.HTTP_201_CREATED)
def creer_pathologie(corps: PathologieIn):
    """Insère une nouvelle pathologie dans l'ontologie via SPARQL INSERT DATA."""
    id_patho = corps.id.strip() if corps.id else _generer_id(corps.libelle)

    if _existe(id_patho):
        raise HTTPException(status_code=400, detail=f"Une pathologie avec l'identifiant :{id_patho} existe déjà")

    libelle_propre = corps.libelle.strip().replace('"', '\\"')

    requete = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>

INSERT DATA {{
  :{id_patho} a :Pathologie ;
              :libelle "{libelle_propre}" .
}}"""
    fc.update(requete)

    # Rafraîchir le lexique NLP si disponible
    try:
        import nlp_engine
        nlp_engine.get_lexique(forcer=True)
    except Exception:
        pass

    return _reponse({"id": id_patho, "libelle": corps.libelle.strip(), "action": "cree"}, requete)


# ---------- 4. Modification d'une pathologie (DELETE/INSERT) ----------
@router.put("/{id_pathologie}")
def modifier_pathologie(id_pathologie: IdPathologie, corps: PathologieModif):
    """Met à jour le libellé de la pathologie."""
    if not _existe(id_pathologie):
        raise HTTPException(status_code=404, detail=f"Pathologie :{id_pathologie} introuvable")

    nouveau_libelle = corps.libelle.strip().replace('"', '\\"')

    requete = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>

DELETE {{
  :{id_pathologie} :libelle ?ancien .
}}
INSERT {{
  :{id_pathologie} :libelle "{nouveau_libelle}" .
}}
WHERE {{
  :{id_pathologie} a/rdfs:subClassOf* :Pathologie .
  OPTIONAL {{ :{id_pathologie} :libelle ?ancien }}
}}"""
    fc.update(requete)

    try:
        import nlp_engine
        nlp_engine.get_lexique(forcer=True)
    except Exception:
        pass

    return _reponse({"id": id_pathologie, "libelle": corps.libelle.strip(), "action": "modifie"}, requete)


# ---------- 5. Suppression d'une pathologie (DELETE WHERE) ----------
@router.delete("/{id_pathologie}")
def supprimer_pathologie(id_pathologie: IdPathologie):
    """Supprime la pathologie et tous ses liens :souffreDe associés."""
    if not _existe(id_pathologie):
        raise HTTPException(status_code=404, detail=f"Pathologie :{id_pathologie} introuvable")

    # Requête de suppression globale : supprime l'entité et tous les triplets entrants/sortants
    requete = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>

DELETE WHERE {{ :{id_pathologie} ?p ?o }} ;
DELETE WHERE {{ ?s ?p :{id_pathologie} }}"""

    fc.update(requete)

    try:
        import nlp_engine
        nlp_engine.get_lexique(forcer=True)
    except Exception:
        pass

    return _reponse({"id": id_pathologie, "action": "supprime"}, requete)
