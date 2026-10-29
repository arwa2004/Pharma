"""Enregistrement des intentions NLP pour le domaine Prescriptions et Professionnels (Membre D).

Même structure que nlp_medicaments.py : pour chaque intention, un générateur SPARQL
(_gen_*), un synthétiseur de réponse en français (_synth_*) et un enregistrement
(enregistrer_intention) avec exemples et mots-clés.

À importer dans routes/nlp.py APRÈS nlp_patients, nlp_medicaments et nlp_complements :
    import nlp_prescriptions
"""
import re
from typing import Any, Dict, List, Tuple

from nlp_engine import ENTITES_REQUISES, Intention, enregistrer_intention

# Entités obligatoires (sinon l'intention est pénalisée par le moteur de score)
ENTITES_REQUISES.update({
    "prescriptions_patient": [("nom",)],
    "prescriptions_medecin": [("nom",)],
    "prescriptions_pharmacien": [("nom",)],
    "prescriptions_par_medicament": [("medicament", "molecule")],
    "prescriptions_duree": [("duree",)],
})


# =================================================================
# Briques communes (SELECT d'une prescription + filtres)
# =================================================================

def _regex(variables: List[str], valeur: str) -> str:
    """FILTER(REGEX(var1) || REGEX(var2) ...) insensible à la casse."""
    morceaux = [f'REGEX(COALESCE({v}, ""), "{re.escape(valeur)}", "i")' for v in variables]
    return "FILTER(\n    " + " ||\n    ".join(morceaux) + "\n  )"


def _requete_prescriptions(filtre: str = "", ordre: str = "DESC(?datePresc) ?idPresc") -> str:
    """Une ligne par prescription, médicaments regroupés avec GROUP_CONCAT."""
    return f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?idPresc ?datePresc ?duree ?posologie ?nomPatient ?prenomPatient
       ?nomDoc ?prenomDoc ?nomPharmacien
       (GROUP_CONCAT(DISTINCT ?nomCommercial; separator=", ") AS ?medicaments) WHERE {{
  ?presc a/rdfs:subClassOf* :Prescription ;
         :emisePar ?d ;
         :pourPatient ?p ;
         :prescritMedicament ?m .
  ?p :nom ?nomPatient .
  OPTIONAL {{ ?p :prenom ?prenomPatient }}
  ?d :nom ?nomDoc .
  OPTIONAL {{ ?d :prenom ?prenomDoc }}
  OPTIONAL {{ ?m :nomCommercial ?nomCommercial }}
  OPTIONAL {{ ?presc :datePrescription ?datePresc }}
  OPTIONAL {{ ?presc :dureeTraitementJours ?duree }}
  OPTIONAL {{ ?presc :posologie ?posologie }}
  OPTIONAL {{ ?presc :delivreePar ?ph . ?ph :nom ?nomPharmacien }}
  BIND(STRAFTER(STR(?presc), "#") AS ?idPresc)
  {filtre}
}}
GROUP BY ?idPresc ?datePresc ?duree ?posologie ?nomPatient ?prenomPatient
         ?nomDoc ?prenomDoc ?nomPharmacien
ORDER BY {ordre}"""


def _nom_complet(prenom: Any, nom: Any) -> str:
    if prenom and nom and str(prenom).strip().lower() == str(nom).strip().lower():
        return str(nom).strip()  # évite "Karim Karim"
    return f"{prenom or ''} {nom or ''}".strip()


def _date(valeur: Any) -> str:
    return str(valeur)[:10] if valeur else "date inconnue"


def _resume(l: Dict[str, Any]) -> str:
    """Une prescription en une phrase."""
    patient = _nom_complet(l.get("prenomPatient"), l.get("nomPatient"))
    medecin = _nom_complet(l.get("prenomDoc"), l.get("nomDoc"))
    duree = f" pour {l['duree']} jour(s)" if l.get("duree") else ""
    return (f"{l.get('idPresc')} ({_date(l.get('datePresc'))}) : {l.get('medicaments', 'aucun médicament')} "
            f"pour {patient}, émise par le Dr {medecin}{duree}")


# =================================================================
# 1. Liste de toutes les prescriptions
# =================================================================

def _gen_toutes_prescriptions(entites: Dict[str, Any]) -> Tuple[str, str]:
    return "SELECT", _requete_prescriptions()


def _synth_toutes_prescriptions(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucune prescription n'est enregistrée dans l'ontologie."
    return f"Il y a {len(lignes)} prescription(s) : " + " ; ".join(_resume(l) for l in lignes) + "."


enregistrer_intention(
    Intention(
        id_intention="prescriptions_liste",
        domaine="Prescriptions (Membre D)",
        description="Afficher la liste complète des prescriptions",
        exemples=[
            "Quelles sont toutes les prescriptions ?",
            "Liste des prescriptions",
            "Afficher toutes les prescriptions",
            "Donne-moi les prescriptions enregistrées",
            "Montre-moi les prescriptions",
        ],
        mots_cles=["toutes les prescriptions", "liste des prescriptions", "prescriptions enregistrees"],
        generateur_sparql=_gen_toutes_prescriptions,
        synthetiseur_reponse=_synth_toutes_prescriptions,
    )
)


# =================================================================
# 2. Nombre de prescriptions
# =================================================================

def _gen_compter_prescriptions(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT (COUNT(DISTINCT ?presc) AS ?nb) WHERE {
  ?presc a/rdfs:subClassOf* :Prescription .
}"""
    return "SELECT", sparql


def _synth_compter_prescriptions(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    nb = lignes[0].get("nb", 0) if lignes else 0
    return f"{nb} prescription(s) sont enregistrées dans l'ontologie."


enregistrer_intention(
    Intention(
        id_intention="compter_prescriptions",
        domaine="Prescriptions (Membre D)",
        description="Compter le nombre de prescriptions enregistrées",
        exemples=[
            "Combien de prescriptions sont enregistrées ?",
            "Combien y a-t-il de prescriptions ?",
            "Nombre de prescriptions",
            "Quel est le nombre total de prescriptions ?",
        ],
        mots_cles=["combien de prescriptions", "nombre de prescriptions"],
        generateur_sparql=_gen_compter_prescriptions,
        synthetiseur_reponse=_synth_compter_prescriptions,
    )
)


# =================================================================
# 3. Prescriptions d'un patient
# =================================================================

def _gen_prescriptions_patient(entites: Dict[str, Any]) -> Tuple[str, str]:
    nom = entites.get("nom", "")
    filtre = _regex(["?nomPatient", "?prenomPatient", "STR(?p)"], nom) if nom else ""
    return "SELECT", _requete_prescriptions(filtre)


def _synth_prescriptions_patient(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("nom", "le patient")
    if not lignes:
        return f"Aucune prescription trouvée pour le patient '{cible}'."
    p_nom = _nom_complet(lignes[0].get("prenomPatient"), lignes[0].get("nomPatient")) or cible
    return f"{p_nom} a reçu {len(lignes)} prescription(s) : " + " ; ".join(_resume(l) for l in lignes) + "."


enregistrer_intention(
    Intention(
        id_intention="prescriptions_patient",
        domaine="Prescriptions (Membre D)",
        description="Lister les prescriptions reçues par un patient",
        exemples=[
            "Quelles prescriptions a reçues Sami ?",
            "Prescriptions du patient Leila",
            "Quelles sont les prescriptions de Hedi ?",
            "Quelle prescription a été établie pour Sami ?",
            "Donne-moi les prescriptions du patient Sami",
        ],
        mots_cles=["prescriptions du patient", "prescriptions de", "recu", "reçues"],
        generateur_sparql=_gen_prescriptions_patient,
        synthetiseur_reponse=_synth_prescriptions_patient,
    )
)


# =================================================================
# 4. Prescriptions émises par un médecin
# =================================================================

def _gen_prescriptions_medecin(entites: Dict[str, Any]) -> Tuple[str, str]:
    nom = entites.get("nom", "")
    filtre = _regex(["?nomDoc", "?prenomDoc", "STR(?d)"], nom) if nom else ""
    return "SELECT", _requete_prescriptions(filtre)


def _synth_prescriptions_medecin(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("nom", "le médecin")
    if not lignes:
        return f"Aucune prescription émise par '{cible}' n'a été trouvée."
    d_nom = _nom_complet(lignes[0].get("prenomDoc"), lignes[0].get("nomDoc")) or cible
    return f"Le Dr {d_nom} a émis {len(lignes)} prescription(s) : " + " ; ".join(_resume(l) for l in lignes) + "."


enregistrer_intention(
    Intention(
        id_intention="prescriptions_medecin",
        domaine="Prescriptions (Membre D)",
        description="Lister les prescriptions émises par un médecin",
        exemples=[
            "Quelles prescriptions a émises le Dr Ben Salah ?",
            "Prescriptions du docteur Trabelsi",
            "Quelles prescriptions a rédigées le médecin Sami ?",
            "Quelles prescriptions a établies le Dr Leila ?",
            "Prescriptions émises par le Dr Hedi",
        ],
        mots_cles=["emise par", "emises", "redigees", "prescriptions du docteur", "prescrit par"],
        generateur_sparql=_gen_prescriptions_medecin,
        synthetiseur_reponse=_synth_prescriptions_medecin,
    )
)


# =================================================================
# 5. Prescriptions délivrées par un pharmacien
# =================================================================

def _gen_prescriptions_pharmacien(entites: Dict[str, Any]) -> Tuple[str, str]:
    nom = entites.get("nom", "")
    filtre = "FILTER(BOUND(?nomPharmacien))"
    if nom:
        filtre = _regex(["?nomPharmacien", "STR(?ph)"], nom)
    return "SELECT", _requete_prescriptions(filtre)


def _synth_prescriptions_pharmacien(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("nom", "le pharmacien")
    if not lignes:
        return f"Aucune prescription délivrée par '{cible}' n'a été trouvée."
    return (f"Le pharmacien {lignes[0].get('nomPharmacien', cible)} a délivré {len(lignes)} prescription(s) : "
            + " ; ".join(_resume(l) for l in lignes) + ".")


enregistrer_intention(
    Intention(
        id_intention="prescriptions_pharmacien",
        domaine="Prescriptions (Membre D)",
        description="Lister les prescriptions délivrées par un pharmacien",
        exemples=[
            "Quelles prescriptions a délivrées le pharmacien Sami ?",
            "Prescriptions délivrées par le pharmacien Leila",
            "Quelles prescriptions a dispensées le pharmacien Hedi ?",
            "Qu'a délivré le pharmacien Sami ?",
        ],
        mots_cles=["delivrees par", "delivre", "pharmacien", "dispensees"],
        generateur_sparql=_gen_prescriptions_pharmacien,
        synthetiseur_reponse=_synth_prescriptions_pharmacien,
    )
)


# =================================================================
# 6. Prescriptions contenant un médicament ou une molécule
# =================================================================

def _gen_prescriptions_par_medicament(entites: Dict[str, Any]) -> Tuple[str, str]:
    cible = entites.get("medicament") or entites.get("molecule") or ""
    mol = entites.get("molecule") or cible
    filtre = ""
    if cible:
        filtre = f"""FILTER EXISTS {{
    ?presc :prescritMedicament ?mf .
    OPTIONAL {{ ?mf :nomCommercial ?nomMf }}
    OPTIONAL {{ ?mf (:contientMolecule|:contientPrincipeActif)/:nom ?nomMolMf }}
    FILTER(
      REGEX(COALESCE(?nomMf, ""), "{re.escape(cible)}", "i") ||
      REGEX(COALESCE(?nomMolMf, ""), "{re.escape(mol)}", "i") ||
      REGEX(STR(?mf), "{re.escape(cible)}", "i")
    )
  }}"""
    return "SELECT", _requete_prescriptions(filtre)


def _synth_prescriptions_par_medicament(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("medicament") or entites.get("molecule") or "ce médicament"
    if not lignes:
        return f"Aucune prescription ne contient '{cible}' dans l'ontologie."
    return (f"{len(lignes)} prescription(s) contiennent '{cible}' : "
            + " ; ".join(_resume(l) for l in lignes) + ".")


enregistrer_intention(
    Intention(
        id_intention="prescriptions_par_medicament",
        domaine="Prescriptions (Membre D)",
        description="Trouver les prescriptions qui contiennent un médicament ou une molécule donnée",
        exemples=[
            "Quelles prescriptions contiennent de la Warfarine ?",
            "Prescriptions avec de l'Ibuprofène",
            "Quelles prescriptions incluent la Metformine ?",
            "Dans quelles prescriptions trouve-t-on l'Amoxicilline ?",
            "Prescriptions du Doliprane",
        ],
        mots_cles=["prescriptions contiennent", "prescriptions avec", "prescriptions incluent", "dans quelles prescriptions"],
        generateur_sparql=_gen_prescriptions_par_medicament,
        synthetiseur_reponse=_synth_prescriptions_par_medicament,
    )
)


# =================================================================
# 7. Prescriptions à risque d'interaction (classe PrescriptionEnAlerte)
# =================================================================

def _gen_prescriptions_interactions(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?idPresc ?nomPatient ?prenomPatient ?nomDoc ?nomMedA ?nomMedB WHERE {
  ?presc a/rdfs:subClassOf* :Prescription ;
         :pourPatient ?p ;
         :emisePar ?d ;
         :prescritMedicament ?medA , ?medB .
  { ?medA :interagitAvec ?medB } UNION { ?medB :interagitAvec ?medA }
  FILTER(STR(?medA) < STR(?medB))
  ?p :nom ?nomPatient .
  OPTIONAL { ?p :prenom ?prenomPatient }
  ?d :nom ?nomDoc .
  OPTIONAL { ?medA :nomCommercial ?nomMedA }
  OPTIONAL { ?medB :nomCommercial ?nomMedB }
  BIND(STRAFTER(STR(?presc), "#") AS ?idPresc)
} ORDER BY ?idPresc"""
    return "SELECT", sparql


def _synth_prescriptions_interactions(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucune prescription ne combine des médicaments en interaction."
    details = [
        f"{l.get('idPresc')} ({_nom_complet(l.get('prenomPatient'), l.get('nomPatient'))}, Dr {l.get('nomDoc')}) : "
        f"{l.get('nomMedA')} + {l.get('nomMedB')}"
        for l in lignes
    ]
    return f"Alerte clinique : {len(lignes)} prescription(s) à risque d'interaction : " + " ; ".join(details) + "."


enregistrer_intention(
    Intention(
        id_intention="prescriptions_interactions",
        domaine="Prescriptions (Membre D)",
        description="Détecter les prescriptions qui associent deux médicaments en interaction",
        exemples=[
            "Quelles prescriptions présentent une interaction médicamenteuse ?",
            "Prescriptions à risque d'interaction",
            "Y a-t-il des prescriptions avec des interactions ?",
            "Quelles prescriptions sont en alerte ?",
            "Prescriptions dangereuses à cause d'une interaction",
        ],
        mots_cles=["prescriptions interaction", "prescriptions en alerte", "prescriptions a risque"],
        generateur_sparql=_gen_prescriptions_interactions,
        synthetiseur_reponse=_synth_prescriptions_interactions,
    )
)


# =================================================================
# 8. Prescriptions non délivrées
# =================================================================

def _gen_prescriptions_non_delivrees(entites: Dict[str, Any]) -> Tuple[str, str]:
    return "SELECT", _requete_prescriptions("FILTER NOT EXISTS { ?presc :delivreePar ?x }")


def _synth_prescriptions_non_delivrees(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Toutes les prescriptions ont été délivrées par un pharmacien."
    return (f"{len(lignes)} prescription(s) n'ont pas encore été délivrées : "
            + " ; ".join(_resume(l) for l in lignes) + ".")


enregistrer_intention(
    Intention(
        id_intention="prescriptions_non_delivrees",
        domaine="Prescriptions (Membre D)",
        description="Lister les prescriptions qui n'ont pas encore été délivrées par un pharmacien",
        exemples=[
            "Quelles prescriptions n'ont pas été délivrées ?",
            "Prescriptions non délivrées",
            "Quelles prescriptions sont en attente de délivrance ?",
            "Quelles prescriptions n'ont pas encore été dispensées ?",
            "Prescriptions sans pharmacien",
        ],
        mots_cles=["non delivrees", "pas ete delivrees", "en attente", "sans pharmacien"],
        generateur_sparql=_gen_prescriptions_non_delivrees,
        synthetiseur_reponse=_synth_prescriptions_non_delivrees,
    )
)


# =================================================================
# 9. Prescriptions de longue durée (filtre numérique)
# =================================================================

def _gen_prescriptions_duree(entites: Dict[str, Any]) -> Tuple[str, str]:
    seuil = int(entites.get("duree", 30))
    filtre = f"FILTER(?duree >= {seuil})"
    return "SELECT", _requete_prescriptions(filtre, ordre="DESC(?duree) ?idPresc")


def _synth_prescriptions_duree(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    seuil = entites.get("duree", 30)
    if not lignes:
        return f"Aucune prescription ne dure {seuil} jours ou plus."
    return (f"{len(lignes)} prescription(s) durent {seuil} jours ou plus : "
            + " ; ".join(_resume(l) for l in lignes) + ".")


enregistrer_intention(
    Intention(
        id_intention="prescriptions_duree",
        domaine="Prescriptions (Membre D)",
        description="Filtrer les prescriptions dont la durée de traitement dépasse un seuil en jours",
        exemples=[
            "Quelles prescriptions durent plus de 30 jours ?",
            "Prescriptions de plus de 10 jours",
            "Quelles prescriptions ont une durée supérieure à 14 jours ?",
            "Prescriptions de longue durée",
            "Traitements de plus de 60 jours",
        ],
        mots_cles=["jours", "duree", "longue duree", "durent"],
        generateur_sparql=_gen_prescriptions_duree,
        synthetiseur_reponse=_synth_prescriptions_duree,
    )
)


# =================================================================
# 10. Statistiques : prescriptions par médecin (COUNT + GROUP BY)
# =================================================================

def _gen_stats_medecins(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?nomDoc ?prenomDoc (COUNT(DISTINCT ?presc) AS ?nb) WHERE {
  ?presc a/rdfs:subClassOf* :Prescription ; :emisePar ?d .
  ?d :nom ?nomDoc .
  OPTIONAL { ?d :prenom ?prenomDoc }
}
GROUP BY ?nomDoc ?prenomDoc
ORDER BY DESC(?nb) ?nomDoc"""
    return "SELECT", sparql


def _synth_stats_medecins(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucune prescription enregistrée : pas de statistiques disponibles."
    details = [f"Dr {_nom_complet(l.get('prenomDoc'), l.get('nomDoc'))} : {l.get('nb')}" for l in lignes]
    return "Nombre de prescriptions par médecin : " + " ; ".join(details) + "."


enregistrer_intention(
    Intention(
        id_intention="prescriptions_stats_medecins",
        domaine="Prescriptions (Membre D)",
        description="Compter les prescriptions émises par chaque médecin",
        exemples=[
            "Combien de prescriptions par médecin ?",
            "Nombre de prescriptions par médecin",
            "Quel médecin prescrit le plus ?",
            "Statistiques des prescriptions par médecin",
            "Répartition des prescriptions par docteur",
        ],
        mots_cles=["par medecin", "par docteur", "prescrit le plus", "repartition"],
        generateur_sparql=_gen_stats_medecins,
        synthetiseur_reponse=_synth_stats_medecins,
    )
)


# =================================================================
# 11. Médicaments les plus prescrits (COUNT + GROUP BY + LIMIT)
# =================================================================

def _gen_medicaments_plus_prescrits(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?nomCommercial (COUNT(DISTINCT ?presc) AS ?nb) WHERE {
  ?presc a/rdfs:subClassOf* :Prescription ; :prescritMedicament ?m .
  ?m :nomCommercial ?nomCommercial .
}
GROUP BY ?nomCommercial
ORDER BY DESC(?nb) ?nomCommercial
LIMIT 5"""
    return "SELECT", sparql


def _synth_medicaments_plus_prescrits(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun médicament n'a été prescrit pour le moment."
    details = [f"{l.get('nomCommercial')} ({l.get('nb')} prescription(s))" for l in lignes]
    return "Médicaments les plus prescrits : " + ", ".join(details) + "."


enregistrer_intention(
    Intention(
        id_intention="prescriptions_medicaments_populaires",
        domaine="Prescriptions (Membre D)",
        description="Classer les médicaments les plus souvent prescrits",
        exemples=[
            "Quel est le médicament le plus prescrit ?",
            "Quels sont les médicaments les plus prescrits ?",
            "Top des médicaments prescrits",
            "Quel médicament est le plus souvent prescrit ?",
        ],
        mots_cles=["plus prescrit", "plus prescrits", "souvent prescrit", "top des medicaments"],
        generateur_sparql=_gen_medicaments_plus_prescrits,
        synthetiseur_reponse=_synth_medicaments_plus_prescrits,
    )
)