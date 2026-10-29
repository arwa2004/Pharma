import re
import unicodedata
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field, model_validator

import fuseki_client as fc
from nlp_risques import analyser_symptomes

router = APIRouter(prefix="/risques", tags=["Risques"])

IdRisque = Annotated[str, Path(pattern=r"^[A-Za-z0-9_\-]+$", description="ex : Eff_Nausees")]
IdEntite = Annotated[str, Path(pattern=r"^[A-Za-z0-9_\-]+$", description="ex : Med_Warfarine")]


# ---------- Modèles Pydantic ----------

class SymptomeRequest(BaseModel):
    texte: str

class EffetIn(BaseModel):
    libelle: str = Field(..., min_length=1)
    grave: bool = False
    frequenceEffet: Optional[float] = Field(None, ge=0, le=100)
    id_medicament: str = Field(..., description="Médicament concerné (axiome : minCardinality 1 sur :estEffetDe)")


class EffetUpdate(BaseModel):
    libelle: Optional[str] = Field(None, min_length=1)
    frequenceEffet: Optional[float] = Field(None, ge=0, le=100)
    grave: Optional[bool] = None


class ContreIndicationIn(BaseModel):
    libelle: str = Field(..., min_length=1)
    absolue: bool = False
    id_pathologie: str = Field(..., description="Pathologie concernée (axiome : someValuesFrom :Pathologie)")
    id_medicament: Optional[str] = Field(None, description="Médicament à associer immédiatement (facultatif)")


class ContreIndicationUpdate(BaseModel):
    libelle: Optional[str] = Field(None, min_length=1)
    absolue: Optional[bool] = None


class InteractionIn(BaseModel):
    libelle: str = Field(..., min_length=1)
    id_medicament_a: str
    id_medicament_b: str

    @model_validator(mode="after")
    def _distincts(self):
        if self.id_medicament_a == self.id_medicament_b:
            raise ValueError("Une interaction nécessite 2 médicaments distincts (axiome : minCardinality 2)")
        return self


class InteractionUpdate(BaseModel):
    libelle: str = Field(..., min_length=1)


# ---------- Fonctions utilitaires ----------

def _reponse(data, sparql: str):
    return {"data": data, "sparql": sparql.strip()}


def _existe(id_entite: str) -> bool:
    lignes = fc.select(f"SELECT ?t WHERE {{ :{id_entite} a ?t }} LIMIT 1")
    return len(lignes) > 0


def _generer_id(prefixe: str, libelle: str) -> str:
    """'Risque hépatique sévère' -> 'Eff_RisqueHepatiqueSevere' (suffixe numérique si conflit)."""
    ascii_lib = unicodedata.normalize("NFKD", libelle).encode("ascii", "ignore").decode()
    base = re.sub(r"[^A-Za-z0-9]", "", ascii_lib.title()) or "Inconnu"
    candidat, n = f"{prefixe}_{base}", 1
    while _existe(candidat):
        n += 1
        candidat = f"{prefixe}_{base}{n}"
    return candidat


# =====================================================================
# NLP : ANALYSEUR DE SYMPTÔMES
# =====================================================================

@router.post("/analyser")
async def analyser_texte_symptomes(payload: SymptomeRequest):
    """Analyse un texte en langage naturel pour détecter les risques médicamenteux."""
    if len(payload.texte.strip()) < 5:
        raise HTTPException(400, "Veuillez fournir une description plus détaillée.")
        
    resultat = analyser_symptomes(payload.texte)
    
    # On utilise _reponse pour garder le même format que le reste de l'API
    return _reponse(resultat, "Analyse NLP locale (SPARQL généré dynamiquement en arrière-plan)")


# =====================================================================
# RÉFÉRENTIELS ET CLASSES DÉFINIES
# =====================================================================

@router.get("/referentiel/medicaments")
def referentiel_medicaments():
    """Liste tous les médicaments disponibles pour les listes déroulantes."""
    requete = """
SELECT DISTINCT ?id ?nom WHERE {
  ?m a/rdfs:subClassOf* :Medicament .
  OPTIONAL { ?m :nomCommercial ?nom }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
} ORDER BY ?nom ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/pathologies")
def referentiel_pathologies():
    """Liste toutes les pathologies disponibles pour les listes déroulantes."""
    requete = """
SELECT DISTINCT ?id ?nom WHERE {
  ?x a/rdfs:subClassOf* :Pathologie .
  OPTIONAL { ?x :libelle ?nom }
  BIND(STRAFTER(STR(?x), "#") AS ?id)
} ORDER BY ?nom ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/medicaments-risque")
def medicaments_a_risque():
    """Classe définie :MedicamentRisque = médicament ayant ≥ 1 effet secondaire grave."""
    requete = """
SELECT DISTINCT ?id ?nom (COUNT(DISTINCT ?eg) AS ?nb_effets_graves) WHERE {
  ?m a/rdfs:subClassOf* :Medicament ; :aEffetSecondaire ?eg .
  ?eg a :EffetSecondaireGrave .
  OPTIONAL { ?m :nomCommercial ?nom }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}
GROUP BY ?id ?nom
ORDER BY ?nom"""
    return _reponse(fc.select(requete), requete)


@router.get("/medicaments-ci-absolue")
def medicaments_ci_absolue():
    """Classe définie :MedicamentAContreIndicationAbsolue."""
    requete = """
SELECT DISTINCT ?id ?nom (COUNT(DISTINCT ?ci) AS ?nb_ci_absolues) WHERE {
  ?m a/rdfs:subClassOf* :Medicament ; :aContreIndication ?ci .
  ?ci a :ContreIndicationAbsolue .
  OPTIONAL { ?m :nomCommercial ?nom }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}
GROUP BY ?id ?nom
ORDER BY ?nom"""
    return _reponse(fc.select(requete), requete)


@router.get("/medicaments-interaction")
def medicaments_avec_interaction():
    """Classe définie :MedicamentAInteraction."""
    requete = """
SELECT DISTINCT ?id ?nom (COUNT(DISTINCT ?i) AS ?nb_interactions) WHERE {
  ?i :impliqueMedicament ?m . ?m a/rdfs:subClassOf* :Medicament .
  OPTIONAL { ?m :nomCommercial ?nom }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}
GROUP BY ?id ?nom
ORDER BY ?nom"""
    return _reponse(fc.select(requete), requete)


# ---------- Requêtes SPARQL variées ----------

@router.get("/recherche/union")
def recherche_croisee_union():
    """Requête UNION : combine effets graves et contre-indications absolues par médicament."""
    requete = """
SELECT DISTINCT ?id ?nom ?typeRisque ?element ?libelle WHERE {
  {
    ?m :aEffetSecondaire ?elem .
    ?elem a :EffetSecondaireGrave ; :libelle ?libelle .
    BIND("Effet secondaire grave" AS ?typeRisque)
  }
  UNION
  {
    ?m :aContreIndication ?elem .
    ?elem a :ContreIndicationAbsolue ; :libelle ?libelle .
    BIND("Contre-indication absolue" AS ?typeRisque)
  }
  ?m a/rdfs:subClassOf* :Medicament .
  OPTIONAL { ?m :nomCommercial ?nom }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
  BIND(STRAFTER(STR(?elem), "#") AS ?element)
} ORDER BY ?nom ?typeRisque"""
    return _reponse(fc.select(requete), requete)


@router.get("/alertes/vigilance")
def alertes_vigilance():
    """Cumule les 3 facteurs de risque (effet grave, CI absolue, interaction) par médicament."""
    requete = """
SELECT ?id ?nom
       (COUNT(DISTINCT ?eg) AS ?nb_effets_graves)
       (COUNT(DISTINCT ?cia) AS ?nb_ci_absolues)
       (COUNT(DISTINCT ?i) AS ?nb_interactions)
WHERE {
  ?m a/rdfs:subClassOf* :Medicament .
  OPTIONAL { ?m :nomCommercial ?nom }
  OPTIONAL { ?m :aEffetSecondaire ?eg . ?eg a :EffetSecondaireGrave }
  OPTIONAL { ?m :aContreIndication ?cia . ?cia a :ContreIndicationAbsolue }
  OPTIONAL { ?i :impliqueMedicament ?m }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}
GROUP BY ?id ?nom
HAVING (COUNT(DISTINCT ?eg) >= 1 || COUNT(DISTINCT ?cia) >= 1 || COUNT(DISTINCT ?i) >= 1)
ORDER BY DESC(?nb_effets_graves) DESC(?nb_ci_absolues) DESC(?nb_interactions)"""
    return _reponse(fc.select(requete), requete)


# =====================================================================
# EFFETS SECONDAIRES
# =====================================================================

@router.get("/effets")
def lister_effets(
    q: Optional[str] = Query(None, description="recherche dans le libellé"),
    type: Optional[str] = Query(None, pattern="^(grave|benin)$"),
):
    """Liste tous les effets secondaires avec le nombre de médicaments concernés."""
    filtres = []
    if q:
        filtres.append(f'FILTER(REGEX(?libelle, {fc.lit(re.escape(q))}, "i"))')
    classe = ":EffetSecondaireGrave" if type == "grave" else ":EffetSecondaireBenin" if type == "benin" else ":EffetSecondaire"

    requete = f"""
SELECT ?id ?libelle ?frequenceEffet ?grave (COUNT(DISTINCT ?m) AS ?nb_medicaments) WHERE {{
  ?e a/rdfs:subClassOf* {classe} ; a/rdfs:subClassOf* :EffetSecondaire ; :libelle ?libelle .
  OPTIONAL {{ ?e :frequenceEffet ?frequenceEffet }}
  OPTIONAL {{ ?m :aEffetSecondaire ?e }}
  BIND(EXISTS {{ ?e a :EffetSecondaireGrave }} AS ?grave)
  BIND(STRAFTER(STR(?e), "#") AS ?id)
  {chr(10).join(filtres)}
}}
GROUP BY ?id ?libelle ?frequenceEffet ?grave
ORDER BY DESC(?grave) ?libelle"""
    return _reponse(fc.select(requete), requete)


@router.get("/effets/{id_effet}")
def fiche_effet(id_effet: IdRisque):
    """Fiche détaillée d'un effet secondaire : attributs + médicaments concernés."""
    info = fc.select(f"""
SELECT ?libelle ?frequenceEffet ?grave WHERE {{
  :{id_effet} a/rdfs:subClassOf* :EffetSecondaire ; :libelle ?libelle .
  OPTIONAL {{ :{id_effet} :frequenceEffet ?frequenceEffet }}
  BIND(EXISTS {{ :{id_effet} a :EffetSecondaireGrave }} AS ?grave)
}} LIMIT 1""")
    if not info:
        raise HTTPException(404, f"Effet secondaire {id_effet} introuvable")

    medicaments = fc.select(f"""
SELECT ?id ?nom WHERE {{
  ?m :aEffetSecondaire :{id_effet} .
  OPTIONAL {{ ?m :nomCommercial ?nom }}
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} ORDER BY ?nom""")

    fiche = {"id": id_effet, **info[0], "medicaments": medicaments}
    return _reponse(fiche, "Requêtes SELECT combinées (infos + médicaments concernés)")


@router.get("/effets/{id_effet}/ask-grave")
def verifier_grave_ask(id_effet: IdRisque):
    """Requête ASK : teste directement l'appartenance à :EffetSecondaireGrave."""
    requete = f"ASK {{ :{id_effet} a :EffetSecondaireGrave }}"
    est_grave = fc.ask(requete)
    return _reponse({"id": id_effet, "grave_ask": est_grave}, requete)


@router.get("/effets/{id_effet}/describe")
def describe_effet(id_effet: IdRisque):
    """Requête DESCRIBE : sous-graphe RDF Turtle de l'effet secondaire."""
    requete = f"DESCRIBE :{id_effet}"
    return _reponse({"id": id_effet, "rdf_turtle": fc.describe(requete)}, requete)


@router.post("/effets", status_code=201)
def creer_effet(e: EffetIn):
    if not _existe(e.id_medicament):
        raise HTTPException(404, f"Médicament {e.id_medicament} introuvable")

    id_effet = _generer_id("Eff", e.libelle)
    classe = "EffetSecondaireGrave" if e.grave else "EffetSecondaireBenin"
    triplets = [f"a :{classe}", f":libelle {fc.lit(e.libelle)}"]
    if e.frequenceEffet is not None:
        triplets.append(f":frequenceEffet {e.frequenceEffet}")

    requete = (
        f"INSERT DATA {{\n  :{id_effet} " + " ;\n    ".join(triplets) + " .\n"
        f"  :{e.id_medicament} :aEffetSecondaire :{id_effet} .\n}}"
    )
    fc.update(requete)
    return _reponse(
        {"id": id_effet, "libelle": e.libelle, "grave": e.grave,
         "frequenceEffet": e.frequenceEffet, "medicament_initial": e.id_medicament},
        requete,
    )


@router.put("/effets/{id_effet}")
def modifier_effet(e: EffetUpdate, id_effet: IdRisque):
    if not _existe(id_effet):
        raise HTTPException(404, f"Effet secondaire {id_effet} introuvable")
    champs = e.model_dump(exclude_none=True)
    if not champs:
        raise HTTPException(400, "Aucun champ à modifier")

    operations = []
    if "libelle" in champs:
        operations.append(f"DELETE WHERE {{ :{id_effet} :libelle ?a }}")
        operations.append(f"INSERT DATA {{ :{id_effet} :libelle {fc.lit(champs['libelle'])} }}")
    if "frequenceEffet" in champs:
        operations.append(f"DELETE WHERE {{ :{id_effet} :frequenceEffet ?a }}")
        operations.append(f"INSERT DATA {{ :{id_effet} :frequenceEffet {champs['frequenceEffet']} }}")
    if "grave" in champs:
        nouvelle_classe = "EffetSecondaireGrave" if champs["grave"] else "EffetSecondaireBenin"
        ancienne_classe = "EffetSecondaireBenin" if champs["grave"] else "EffetSecondaireGrave"
        operations.append(f"DELETE DATA {{ :{id_effet} a :{ancienne_classe} }}")
        operations.append(f"INSERT DATA {{ :{id_effet} a :{nouvelle_classe} }}")

    requete = " ;\n".join(operations)
    fc.update(requete)
    return _reponse({"id": id_effet, **champs}, requete)


@router.delete("/effets/{id_effet}")
def supprimer_effet(id_effet: IdRisque):
    if not _existe(id_effet):
        raise HTTPException(404, f"Effet secondaire {id_effet} introuvable")
    requete = (
        f"DELETE WHERE {{ :{id_effet} ?p ?o }} ;\n"
        f"DELETE WHERE {{ ?s ?p :{id_effet} }}"
    )
    fc.update(requete)
    return _reponse({"supprime": id_effet}, requete)


@router.post("/effets/{id_effet}/medicaments/{id_medicament}", status_code=201)
def associer_medicament_effet(id_effet: IdRisque, id_medicament: IdEntite):
    if not _existe(id_effet):
        raise HTTPException(404, f"Effet secondaire {id_effet} introuvable")
    if not _existe(id_medicament):
        raise HTTPException(404, f"Médicament {id_medicament} introuvable")
    requete = f"INSERT DATA {{\n  :{id_medicament} :aEffetSecondaire :{id_effet} .\n}}"
    fc.update(requete)
    return _reponse({"effet": id_effet, "medicament": id_medicament, "action": "associe"}, requete)


@router.delete("/effets/{id_effet}/medicaments/{id_medicament}")
def retirer_medicament_effet(id_effet: IdRisque, id_medicament: IdEntite):
    if not _existe(id_effet):
        raise HTTPException(404, f"Effet secondaire {id_effet} introuvable")

    lies = fc.select(f"SELECT ?m WHERE {{ ?m :aEffetSecondaire :{id_effet} }}")
    if len(lies) <= 1:
        raise HTTPException(
            400,
            f"Suppression bloquée (Axiome OWL) : :{id_effet} doit rester lié à au moins 1 médicament "
            f"(minCardinality 1 sur :estEffetDe). Supprimez l'effet entier à la place.",
        )
    requete = f"DELETE DATA {{\n  :{id_medicament} :aEffetSecondaire :{id_effet} .\n}}"
    fc.update(requete)
    return _reponse({"effet": id_effet, "medicament": id_medicament, "action": "retire"}, requete)


# =====================================================================
# CONTRE-INDICATIONS
# =====================================================================

@router.get("/contre-indications")
def lister_contre_indications(
    q: Optional[str] = Query(None, description="recherche dans le libellé"),
    type: Optional[str] = Query(None, pattern="^(absolue|relative)$"),
):
    filtres = []
    if q:
        filtres.append(f'FILTER(REGEX(?libelle, {fc.lit(re.escape(q))}, "i"))')
    classe = ":ContreIndicationAbsolue" if type == "absolue" else ":ContreIndicationRelative" if type == "relative" else ":ContreIndication"

    requete = f"""
SELECT ?id ?libelle ?absolue (COUNT(DISTINCT ?m) AS ?nb_medicaments) (COUNT(DISTINCT ?patho) AS ?nb_pathologies) WHERE {{
  ?ci a/rdfs:subClassOf* {classe} ; a/rdfs:subClassOf* :ContreIndication ; :libelle ?libelle .
  OPTIONAL {{ ?m :aContreIndication ?ci }}
  OPTIONAL {{ ?ci :concernePathologie ?patho }}
  BIND(EXISTS {{ ?ci a :ContreIndicationAbsolue }} AS ?absolue)
  BIND(STRAFTER(STR(?ci), "#") AS ?id)
  {chr(10).join(filtres)}
}}
GROUP BY ?id ?libelle ?absolue
ORDER BY DESC(?absolue) ?libelle"""
    return _reponse(fc.select(requete), requete)


@router.get("/contre-indications/{id_ci}")
def fiche_contre_indication(id_ci: IdRisque):
    info = fc.select(f"""
SELECT ?libelle ?absolue WHERE {{
  :{id_ci} a/rdfs:subClassOf* :ContreIndication ; :libelle ?libelle .
  BIND(EXISTS {{ :{id_ci} a :ContreIndicationAbsolue }} AS ?absolue)
}} LIMIT 1""")
    if not info:
        raise HTTPException(404, f"Contre-indication {id_ci} introuvable")

    medicaments = fc.select(f"""
SELECT ?id ?nom WHERE {{
  ?m :aContreIndication :{id_ci} .
  OPTIONAL {{ ?m :nomCommercial ?nom }}
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} ORDER BY ?nom""")

    pathologies = fc.select(f"""
SELECT ?id ?nom WHERE {{
  :{id_ci} :concernePathologie ?p .
  OPTIONAL {{ ?p :libelle ?nom }}
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}} ORDER BY ?nom""")

    fiche = {"id": id_ci, **info[0], "medicaments": medicaments, "pathologies": pathologies}
    return _reponse(fiche, "Requêtes SELECT combinées (infos + médicaments + pathologies)")


@router.get("/contre-indications/{id_ci}/ask-absolue")
def verifier_absolue_ask(id_ci: IdRisque):
    requete = f"ASK {{ :{id_ci} a :ContreIndicationAbsolue }}"
    return _reponse({"id": id_ci, "absolue_ask": fc.ask(requete)}, requete)


@router.get("/contre-indications/{id_ci}/describe")
def describe_contre_indication(id_ci: IdRisque):
    requete = f"DESCRIBE :{id_ci}"
    return _reponse({"id": id_ci, "rdf_turtle": fc.describe(requete)}, requete)


@router.post("/contre-indications", status_code=201)
def creer_contre_indication(ci: ContreIndicationIn):
    if not _existe(ci.id_pathologie):
        raise HTTPException(404, f"Pathologie {ci.id_pathologie} introuvable")
    if ci.id_medicament and not _existe(ci.id_medicament):
        raise HTTPException(404, f"Médicament {ci.id_medicament} introuvable")

    id_ci = _generer_id("CI", ci.libelle)
    classe = "ContreIndicationAbsolue" if ci.absolue else "ContreIndicationRelative"
    triplets = [f"a :{classe}", f":libelle {fc.lit(ci.libelle)}", f":concernePathologie :{ci.id_pathologie}"]

    requete = f"INSERT DATA {{\n  :{id_ci} " + " ;\n    ".join(triplets) + " .\n"
    if ci.id_medicament:
        requete += f"  :{ci.id_medicament} :aContreIndication :{id_ci} .\n"
    requete += "}"
    fc.update(requete)
    return _reponse(
        {"id": id_ci, "libelle": ci.libelle, "absolue": ci.absolue,
         "pathologie": ci.id_pathologie, "medicament_initial": ci.id_medicament},
        requete,
    )


@router.put("/contre-indications/{id_ci}")
def modifier_contre_indication(ci: ContreIndicationUpdate, id_ci: IdRisque):
    if not _existe(id_ci):
        raise HTTPException(404, f"Contre-indication {id_ci} introuvable")
    champs = ci.model_dump(exclude_none=True)
    if not champs:
        raise HTTPException(400, "Aucun champ à modifier")

    operations = []
    if "libelle" in champs:
        operations.append(f"DELETE WHERE {{ :{id_ci} :libelle ?a }}")
        operations.append(f"INSERT DATA {{ :{id_ci} :libelle {fc.lit(champs['libelle'])} }}")
    if "absolue" in champs:
        nouvelle_classe = "ContreIndicationAbsolue" if champs["absolue"] else "ContreIndicationRelative"
        ancienne_classe = "ContreIndicationRelative" if champs["absolue"] else "ContreIndicationAbsolue"
        operations.append(f"DELETE DATA {{ :{id_ci} a :{ancienne_classe} }}")
        operations.append(f"INSERT DATA {{ :{id_ci} a :{nouvelle_classe} }}")

    requete = " ;\n".join(operations)
    fc.update(requete)
    return _reponse({"id": id_ci, **champs}, requete)


@router.delete("/contre-indications/{id_ci}")
def supprimer_contre_indication(id_ci: IdRisque):
    if not _existe(id_ci):
        raise HTTPException(404, f"Contre-indication {id_ci} introuvable")
    requete = (
        f"DELETE WHERE {{ :{id_ci} ?p ?o }} ;\n"
        f"DELETE WHERE {{ ?s ?p :{id_ci} }}"
    )
    fc.update(requete)
    return _reponse({"supprime": id_ci}, requete)


@router.post("/contre-indications/{id_ci}/medicaments/{id_medicament}", status_code=201)
def associer_medicament_ci(id_ci: IdRisque, id_medicament: IdEntite):
    if not _existe(id_ci):
        raise HTTPException(404, f"Contre-indication {id_ci} introuvable")
    if not _existe(id_medicament):
        raise HTTPException(404, f"Médicament {id_medicament} introuvable")
    requete = f"INSERT DATA {{\n  :{id_medicament} :aContreIndication :{id_ci} .\n}}"
    fc.update(requete)
    return _reponse({"contre_indication": id_ci, "medicament": id_medicament, "action": "associe"}, requete)


@router.delete("/contre-indications/{id_ci}/medicaments/{id_medicament}")
def retirer_medicament_ci(id_ci: IdRisque, id_medicament: IdEntite):
    if not _existe(id_ci):
        raise HTTPException(404, f"Contre-indication {id_ci} introuvable")
    requete = f"DELETE DATA {{\n  :{id_medicament} :aContreIndication :{id_ci} .\n}}"
    fc.update(requete)
    return _reponse({"contre_indication": id_ci, "medicament": id_medicament, "action": "retire"}, requete)


@router.post("/contre-indications/{id_ci}/pathologies/{id_pathologie}", status_code=201)
def associer_pathologie_ci(id_ci: IdRisque, id_pathologie: IdEntite):
    if not _existe(id_ci):
        raise HTTPException(404, f"Contre-indication {id_ci} introuvable")
    if not _existe(id_pathologie):
        raise HTTPException(404, f"Pathologie {id_pathologie} introuvable")
    requete = f"INSERT DATA {{\n  :{id_ci} :concernePathologie :{id_pathologie} .\n}}"
    fc.update(requete)
    return _reponse({"contre_indication": id_ci, "pathologie": id_pathologie, "action": "associe"}, requete)


@router.delete("/contre-indications/{id_ci}/pathologies/{id_pathologie}")
def retirer_pathologie_ci(id_ci: IdRisque, id_pathologie: IdEntite):
    if not _existe(id_ci):
        raise HTTPException(404, f"Contre-indication {id_ci} introuvable")
    liees = fc.select(f"SELECT ?p WHERE {{ :{id_ci} :concernePathologie ?p }}")
    if len(liees) <= 1:
        raise HTTPException(
            400,
            f"Suppression bloquée (Axiome OWL) : :{id_ci} doit rester liée à au moins 1 pathologie "
            f"(someValuesFrom :Pathologie sur :concernePathologie).",
        )
    requete = f"DELETE DATA {{\n  :{id_ci} :concernePathologie :{id_pathologie} .\n}}"
    fc.update(requete)
    return _reponse({"contre_indication": id_ci, "pathologie": id_pathologie, "action": "retire"}, requete)


# =====================================================================
# INTERACTIONS
# =====================================================================

@router.get("/interactions")
def lister_interactions(q: Optional[str] = Query(None, description="recherche dans le libellé")):
    filtre = f'FILTER(REGEX(?libelle, {fc.lit(re.escape(q))}, "i"))' if q else ""
    requete = f"""
SELECT ?id ?libelle (COUNT(DISTINCT ?m) AS ?nb_medicaments)
       (GROUP_CONCAT(DISTINCT STRAFTER(STR(?m), "#"); separator=", ") AS ?medicaments) WHERE {{
  ?i a :Interaction ; :libelle ?libelle ; :impliqueMedicament ?m .
  BIND(STRAFTER(STR(?i), "#") AS ?id)
  {filtre}
}}
GROUP BY ?id ?libelle
ORDER BY ?libelle"""
    return _reponse(fc.select(requete), requete)


@router.get("/interactions/{id_interaction}")
def fiche_interaction(id_interaction: IdRisque):
    info = fc.select(f"""
SELECT ?libelle WHERE {{ :{id_interaction} a :Interaction ; :libelle ?libelle }} LIMIT 1""")
    if not info:
        raise HTTPException(404, f"Interaction {id_interaction} introuvable")

    medicaments = fc.select(f"""
SELECT ?id ?nom WHERE {{
  :{id_interaction} :impliqueMedicament ?m .
  OPTIONAL {{ ?m :nomCommercial ?nom }}
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} ORDER BY ?nom""")

    fiche = {"id": id_interaction, **info[0], "medicaments": medicaments}
    return _reponse(fiche, "Requêtes SELECT combinées (infos + médicaments impliqués)")


@router.get("/interactions/{id_interaction}/describe")
def describe_interaction(id_interaction: IdRisque):
    requete = f"DESCRIBE :{id_interaction}"
    return _reponse({"id": id_interaction, "rdf_turtle": fc.describe(requete)}, requete)


@router.post("/interactions", status_code=201)
def creer_interaction(i: InteractionIn):
    if not _existe(i.id_medicament_a):
        raise HTTPException(404, f"Médicament {i.id_medicament_a} introuvable")
    if not _existe(i.id_medicament_b):
        raise HTTPException(404, f"Médicament {i.id_medicament_b} introuvable")

    id_interaction = _generer_id("Int", i.libelle)
    requete = f"""INSERT DATA {{
  :{id_interaction} a :Interaction ; :libelle {fc.lit(i.libelle)} ;
    :impliqueMedicament :{i.id_medicament_a} , :{i.id_medicament_b} .
  :{i.id_medicament_a} :interagitAvec :{i.id_medicament_b} .
}}"""
    fc.update(requete)
    return _reponse(
        {"id": id_interaction, "libelle": i.libelle,
         "medicaments": [i.id_medicament_a, i.id_medicament_b]},
        requete,
    )


@router.put("/interactions/{id_interaction}")
def modifier_interaction(i: InteractionUpdate, id_interaction: IdRisque):
    if not _existe(id_interaction):
        raise HTTPException(404, f"Interaction {id_interaction} introuvable")
    requete = (
        f"DELETE WHERE {{ :{id_interaction} :libelle ?a }} ;\n"
        f"INSERT DATA {{ :{id_interaction} :libelle {fc.lit(i.libelle)} }}"
    )
    fc.update(requete)
    return _reponse({"id": id_interaction, "libelle": i.libelle}, requete)


@router.delete("/interactions/{id_interaction}")
def supprimer_interaction(id_interaction: IdRisque):
    if not _existe(id_interaction):
        raise HTTPException(404, f"Interaction {id_interaction} introuvable")

    medicaments = fc.select(f"SELECT ?m WHERE {{ :{id_interaction} :impliqueMedicament ?m }}")

    requete_principale = (
        f"DELETE WHERE {{ :{id_interaction} ?p ?o }} ;\n"
        f"DELETE WHERE {{ ?s ?p :{id_interaction} }}"
    )
    fc.update(requete_principale)

    if len(medicaments) == 2:
        a, b = (m["m"] for m in medicaments)
        fc.update(f"DELETE WHERE {{ :{a} :interagitAvec :{b} }}")
        fc.update(f"DELETE WHERE {{ :{b} :interagitAvec :{a} }}")

    return _reponse({"supprime": id_interaction}, requete_principale)


@router.post("/interactions/{id_interaction}/medicaments/{id_medicament}", status_code=201)
def ajouter_medicament_interaction(id_interaction: IdRisque, id_medicament: IdEntite):
    if not _existe(id_interaction):
        raise HTTPException(404, f"Interaction {id_interaction} introuvable")
    if not _existe(id_medicament):
        raise HTTPException(404, f"Médicament {id_medicament} introuvable")
    requete = f"INSERT DATA {{\n  :{id_interaction} :impliqueMedicament :{id_medicament} .\n}}"
    fc.update(requete)
    return _reponse({"interaction": id_interaction, "medicament": id_medicament, "action": "ajoute"}, requete)


@router.delete("/interactions/{id_interaction}/medicaments/{id_medicament}")
def retirer_medicament_interaction(id_interaction: IdRisque, id_medicament: IdEntite):
    if not _existe(id_interaction):
        raise HTTPException(404, f"Interaction {id_interaction} introuvable")
    lies = fc.select(f"SELECT ?m WHERE {{ :{id_interaction} :impliqueMedicament ?m }}")
    if len(lies) <= 2:
        raise HTTPException(
            400,
            f"Suppression bloquée (Axiome OWL) : :{id_interaction} doit impliquer au moins 2 médicaments "
            f"(minCardinality 2 sur :impliqueMedicament). Supprimez l'interaction entière à la place.",
        )
    requete = f"DELETE DATA {{\n  :{id_interaction} :impliqueMedicament :{id_medicament} .\n}}"
    fc.update(requete)
    return _reponse({"interaction": id_interaction, "medicament": id_medicament, "action": "retire"}, requete)