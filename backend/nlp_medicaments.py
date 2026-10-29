"""Enregistrement des intentions NLP pour le domaine Médicaments et Composition (Membre A).

Comprend les modèles spaCy, extraction de molécules, formes, laboratoires et dosages,
génération dynamique de requêtes SPARQL et synthèse en langage naturel.
"""
import re
from typing import Any, Dict, List, Tuple

from nlp_engine import Intention, enregistrer_intention


# =================================================================
# 1. Médicaments contenant une molécule spécifique
# =================================================================

def _gen_meds_par_molecule(entites: Dict[str, Any]) -> Tuple[str, str]:
    mol = entites.get("molecule", "")
    filtre = ""
    if mol:
        filtre = f"""FILTER(
    REGEX(?nomMolecule, "{re.escape(mol)}", "i") ||
    REGEX(STR(?mol), "{re.escape(mol)}", "i")
  )"""
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?nomMolecule ?nomLabo WHERE {{
  ?m a/rdfs:subClassOf* :Medicament ;
     :nomCommercial ?nomCommercial ;
     (:contientMolecule|:contientPrincipeActif) ?mol .
  OPTIONAL {{ ?mol :nom ?nomMolecule }}
  OPTIONAL {{ ?m :dosageMg ?dosageMg }}
  OPTIONAL {{ ?m :estFabriquePar ?lab . ?lab :nom ?nomLabo }}
  BIND(STRAFTER(STR(?m), "#") AS ?id)
  {filtre}
}} ORDER BY ?nomCommercial"""
    return "SELECT", sparql


def _synth_meds_par_molecule(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    mol = entites.get("molecule", "la molécule demandée")
    if not lignes:
        return f"Aucun médicament contenant '{mol}' n'a été trouvé dans l'ontologie."
    meds = [f"{l.get('nomCommercial', l.get('id', ''))} ({l.get('dosageMg', '?')} mg)" for l in lignes]
    return f"Il y a {len(lignes)} médicament(s) à base de '{mol}' : " + ", ".join(meds) + "."


enregistrer_intention(
    Intention(
        id_intention="medicaments_par_molecule",
        domaine="Médicaments (Membre A)",
        description="Trouver les médicaments contenant une molécule ou principe actif donné",
        exemples=[
            "Quels médicaments contiennent du paracétamol ?",
            "Quels médicaments contiennent de l'amoxicilline ?",
            "Médicaments à base d'ibuprofène",
            "Qui contient de l'aspirine ?",
            "Quels médicaments contiennent de la metformine ?",
            "Médicaments contenant de la warfarine",
            "Médicament avec oméprazole",
        ],
        mots_cles=["contient", "base de", "molecule", "principe actif", "substance"],
        generateur_sparql=_gen_meds_par_molecule,
        synthetiseur_reponse=_synth_meds_par_molecule,
    )
)


# =================================================================
# 2. Fabricant / Laboratoire d'un médicament
# =================================================================

def _gen_fabricant_medicament(entites: Dict[str, Any]) -> Tuple[str, str]:
    med = entites.get("medicament", "")
    filtre = ""
    if med:
        filtre = f"""FILTER(
    REGEX(?nomCommercial, "{re.escape(med)}", "i") ||
    REGEX(STR(?m), "{re.escape(med)}", "i")
  )"""
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?nomCommercial ?nomLabo ?paysLabo ?idLabo WHERE {{
  ?m a/rdfs:subClassOf* :Medicament ;
     :nomCommercial ?nomCommercial ;
     :estFabriquePar ?lab .
  ?lab :nom ?nomLabo .
  OPTIONAL {{ ?lab :pays ?paysLabo }}
  BIND(STRAFTER(STR(?lab), "#") AS ?idLabo)
  {filtre}
}}"""
    return "SELECT", sparql


def _synth_fabricant_medicament(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("medicament", "le médicament")
    if not lignes:
        return f"Aucun fabricant trouvé pour '{cible}' dans l'ontologie."
    reponses = []
    for l in lignes:
        pays = f" ({l.get('paysLabo')})" if l.get("paysLabo") else ""
        reponses.append(f"{l.get('nomCommercial')} est fabriqué par {l.get('nomLabo')}{pays}")
    return ". ".join(reponses) + "."


enregistrer_intention(
    Intention(
        id_intention="medicaments_fabricant",
        domaine="Médicaments (Membre A)",
        description="Identifier le laboratoire pharmaceutique fabricant d'un médicament",
        exemples=[
            "Qui fabrique la Metformine ?",
            "Quel laboratoire fabrique l'Aspirine ?",
            "Qui produit le Clamoxyl ?",
            "Quel est le fabricant du Doliprane ?",
            "Qui a fabriqué l'Ibuprofène ?",
            "Quel laboratoire produit la Warfarine ?",
            "Qui commercialise le Mopral ?",
        ],
        mots_cles=["fabrique", "fabricant", "laboratoire", "produit", "commercialise"],
        generateur_sparql=_gen_fabricant_medicament,
        synthetiseur_reponse=_synth_fabricant_medicament,
    )
)


# =================================================================
# 3. Forme galénique et Voie d'administration
# =================================================================

def _gen_forme_voie(entites: Dict[str, Any]) -> Tuple[str, str]:
    med = entites.get("medicament", "")
    filtre = ""
    if med:
        filtre = f"""FILTER(
    REGEX(?nomCommercial, "{re.escape(med)}", "i") ||
    REGEX(STR(?m), "{re.escape(med)}", "i")
  )"""
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?nomCommercial ?formeLibelle ?voieLibelle WHERE {{
  ?m a/rdfs:subClassOf* :Medicament ;
     :nomCommercial ?nomCommercial .
  OPTIONAL {{ ?m :aForme ?f . ?f :libelle ?formeLibelle }}
  OPTIONAL {{ ?m :administreParVoie ?v . ?v :libelle ?voieLibelle }}
  {filtre}
}}"""
    return "SELECT", sparql


def _synth_forme_voie(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("medicament", "le médicament")
    if not lignes:
        return f"Aucune information de forme/voie trouvée pour '{cible}'."
    res = []
    for l in lignes:
        forme = l.get("formeLibelle", "Forme non précisée")
        voie = l.get("voieLibelle", "Voie non précisée")
        res.append(f"{l.get('nomCommercial')} se présente sous forme de '{forme}' et s'administre par '{voie}'")
    return ". ".join(res) + "."


enregistrer_intention(
    Intention(
        id_intention="medicaments_forme_voie",
        domaine="Médicaments (Membre A)",
        description="Connaitre la forme galénique et la voie d'administration d'un médicament",
        exemples=[
            "Quelle est la forme de l'Aspirine ?",
            "Comment est administrée l'Amoxicilline ?",
            "Quelle est la forme et la voie du Doliprane ?",
            "Forme galénique de la Metformine",
            "Quelle est la forme galénique de l'Ibuprofène ?",
            "Comment prendre le Glucophage ?",
        ],
        mots_cles=["forme", "galenique", "voie", "administration", "administre", "prendre"],
        generateur_sparql=_gen_forme_voie,
        synthetiseur_reponse=_synth_forme_voie,
    )
)


# =================================================================
# 4. Classe définie : Médicaments à contre-indication absolue
# =================================================================

def _gen_contre_indication_absolue(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?ciLibelle WHERE {
  {
    ?m a/rdfs:subClassOf* :MedicamentAContreIndicationAbsolue ;
       :nomCommercial ?nomCommercial .
    OPTIONAL { ?m :dosageMg ?dosageMg }
    OPTIONAL { ?m :aContreIndication ?ci . ?ci :libelle ?ciLibelle }
  } UNION {
    ?m a/rdfs:subClassOf* :Medicament ;
       :nomCommercial ?nomCommercial ;
       :aContreIndication ?ci .
    ?ci a/rdfs:subClassOf* :ContreIndicationAbsolue ;
        :libelle ?ciLibelle .
    OPTIONAL { ?m :dosageMg ?dosageMg }
  }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
} ORDER BY ?nomCommercial"""
    return "SELECT", sparql


def _synth_contre_indication_absolue(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun médicament avec contre-indication absolue détecté dans l'ontologie."
    meds_vus = {}
    for l in lignes:
        nom = l.get("nomCommercial", l.get("id", ""))
        ci = l.get("ciLibelle")
        if nom not in meds_vus:
            meds_vus[nom] = []
        if ci:
            meds_vus[nom].append(ci)
    details = [f"{nom} (CI: {', '.join(cis) if cis else 'Absolue'})" for nom, cis in meds_vus.items()]
    return (
        f"Alerte clinique : {len(meds_vus)} médicament(s) relèvent de la classe définie "
        f"'MedicamentAContreIndicationAbsolue' : " + "; ".join(details) + "."
    )


enregistrer_intention(
    Intention(
        id_intention="medicaments_contre_indication_absolue",
        domaine="Médicaments (Membre A)",
        description="Lister les médicaments relevant de la classe définie MedicamentAContreIndicationAbsolue",
        exemples=[
            "Quels médicaments ont une contre-indication absolue ?",
            "Médicaments avec contre-indication absolue",
            "Quels sont les médicaments à contre-indication absolue ?",
            "Quels médicaments présentent une interdiction absolue ?",
            "Médicaments interdits de manière absolue",
            "Affiche les médicaments avec contre-indication grave ou absolue",
        ],
        mots_cles=["contre-indication absolue", "contre indication absolue", "interdiction absolue", "ci absolue"],
        generateur_sparql=_gen_contre_indication_absolue,
        synthetiseur_reponse=_synth_contre_indication_absolue,
    )
)


# =================================================================
# 5. Médicaments d'un laboratoire spécifique
# =================================================================

def _gen_meds_par_laboratoire(entites: Dict[str, Any]) -> Tuple[str, str]:
    lab = entites.get("laboratoire", "")
    filtre = ""
    if lab:
        filtre = f"""FILTER(
    REGEX(?nomLabo, "{re.escape(lab)}", "i") ||
    REGEX(STR(?lab), "{re.escape(lab)}", "i")
  )"""
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?nomLabo ?paysLabo WHERE {{
  ?m a/rdfs:subClassOf* :Medicament ;
     :nomCommercial ?nomCommercial ;
     :estFabriquePar ?lab .
  ?lab :nom ?nomLabo .
  OPTIONAL {{ ?lab :pays ?paysLabo }}
  OPTIONAL {{ ?m :dosageMg ?dosageMg }}
  BIND(STRAFTER(STR(?m), "#") AS ?id)
  {filtre}
}} ORDER BY ?nomCommercial"""
    return "SELECT", sparql


def _synth_meds_par_laboratoire(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    lab = entites.get("laboratoire", "ce laboratoire")
    if not lignes:
        return f"Aucun médicament fabriqué par '{lab}' n'a été trouvé."
    nom_lab = lignes[0].get("nomLabo", lab)
    meds = [f"{l.get('nomCommercial')} ({l.get('dosageMg', '?')} mg)" for l in lignes]
    return f"Le laboratoire {nom_lab} produit {len(lignes)} médicament(s) : " + ", ".join(meds) + "."


enregistrer_intention(
    Intention(
        id_intention="medicaments_par_laboratoire",
        domaine="Médicaments (Membre A)",
        description="Lister les médicaments produits par un laboratoire pharmaceutique spécifique",
        exemples=[
            "Quels médicaments sont fabriqués par Sanofi ?",
            "Liste des médicaments de Pfizer",
            "Quels produits fabrique Bayer ?",
            "Quels médicaments sont faits par Saiph ?",
            "Médicaments du laboratoire GSK",
            "Médicaments fabriqués par Unimed",
        ],
        mots_cles=["fabrique par", "produits par", "laboratoire sanofi", "laboratoire pfizer", "laboratoire bayer"],
        generateur_sparql=_gen_meds_par_laboratoire,
        synthetiseur_reponse=_synth_meds_par_laboratoire,
    )
)


# =================================================================
# 6. Médicaments soumis à ordonnance
# =================================================================

def _gen_meds_sur_ordonnance(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?nomLabo WHERE {
  ?m a/rdfs:subClassOf* :MedicamentSurOrdonnance ;
     :nomCommercial ?nomCommercial .
  OPTIONAL { ?m :dosageMg ?dosageMg }
  OPTIONAL { ?m :estFabriquePar ?lab . ?lab :nom ?nomLabo }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
} ORDER BY ?nomCommercial"""
    return "SELECT", sparql


def _synth_meds_sur_ordonnance(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun médicament sur ordonnance répertorié."
    meds = [l.get("nomCommercial", l.get("id", "")) for l in lignes]
    return f"Il y a {len(lignes)} médicament(s) soumis à prescription obligatoire : " + ", ".join(meds) + "."


enregistrer_intention(
    Intention(
        id_intention="medicaments_sur_ordonnance",
        domaine="Médicaments (Membre A)",
        description="Lister tous les médicaments soumis à ordonnance médicale obligatoire",
        exemples=[
            "Quels médicaments nécessitent une ordonnance ?",
            "Quels médicaments sont sur ordonnance ?",
            "Liste des médicaments avec prescription",
            "Quels sont les médicaments délivrés sous ordonnance ?",
            "Médicaments soumis à prescription médicale",
        ],
        mots_cles=["sur ordonnance", "necessitent une ordonnance", "sous prescription", "avec ordonnance"],
        generateur_sparql=_gen_meds_sur_ordonnance,
        synthetiseur_reponse=_synth_meds_sur_ordonnance,
    )
)


# =================================================================
# 7. Médicaments en vente libre (sans ordonnance)
# =================================================================

def _gen_meds_sans_ordonnance(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?nomLabo WHERE {
  ?m a/rdfs:subClassOf* :MedicamentSansOrdonnance ;
     :nomCommercial ?nomCommercial .
  OPTIONAL { ?m :dosageMg ?dosageMg }
  OPTIONAL { ?m :estFabriquePar ?lab . ?lab :nom ?nomLabo }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
} ORDER BY ?nomCommercial"""
    return "SELECT", sparql


def _synth_meds_sans_ordonnance(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun médicament sans ordonnance trouvé."
    meds = [l.get("nomCommercial", l.get("id", "")) for l in lignes]
    return f"Il y a {len(lignes)} médicament(s) en vente libre (sans ordonnance) : " + ", ".join(meds) + "."


enregistrer_intention(
    Intention(
        id_intention="medicaments_sans_ordonnance",
        domaine="Médicaments (Membre A)",
        description="Lister les médicaments accessibles sans ordonnance (vente libre)",
        exemples=[
            "Quels médicaments sont sans ordonnance ?",
            "Quels médicaments peut-on acheter sans ordonnance ?",
            "Médicaments en vente libre",
            "Liste des médicaments sans prescription",
            "Médicaments disponibles sans ordonnance",
        ],
        mots_cles=["sans ordonnance", "vente libre", "sans prescription"],
        generateur_sparql=_gen_meds_sans_ordonnance,
        synthetiseur_reponse=_synth_meds_sans_ordonnance,
    )
)


# =================================================================
# 8. Filtrage par dosage numérique (>= seuil)
# =================================================================

def _gen_meds_dosage(entites: Dict[str, Any]) -> Tuple[str, str]:
    seuil = entites.get("dosage", 500.0)
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?nomLabo WHERE {{
  ?m a/rdfs:subClassOf* :Medicament ;
     :nomCommercial ?nomCommercial ;
     :dosageMg ?dosageMg .
  OPTIONAL {{ ?m :estFabriquePar ?lab . ?lab :nom ?nomLabo }}
  FILTER(?dosageMg >= {float(seuil)})
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} ORDER BY DESC(?dosageMg)"""
    return "SELECT", sparql


def _synth_meds_dosage(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    seuil = entites.get("dosage", 500.0)
    if not lignes:
        return f"Aucun médicament ayant un dosage ≥ {seuil} mg n'a été trouvé."
    meds = [f"{l.get('nomCommercial')} ({l.get('dosageMg')} mg)" for l in lignes]
    return f"Il y a {len(lignes)} médicament(s) avec un dosage ≥ {seuil} mg : " + ", ".join(meds) + "."


enregistrer_intention(
    Intention(
        id_intention="medicaments_dosage_eleve",
        domaine="Médicaments (Membre A)",
        description="Filtrer les médicaments ayant un dosage supérieur ou égal à un seuil donné",
        exemples=[
            "Quels médicaments ont un dosage supérieur à 500 mg ?",
            "Médicaments dosés à plus de 400 mg",
            "Quels médicaments ont une dose supérieure à 100 mg ?",
            "Quels médicaments dépassent 500 mg ?",
            "Médicaments avec fort dosage",
        ],
        mots_cles=["dosage superieur", "dose superieure", "plus de 500", "plus de 400", "dose a"],
        generateur_sparql=_gen_meds_dosage,
        synthetiseur_reponse=_synth_meds_dosage,
    )
)


# =================================================================
# 9. Fiche et Composition détaillée d'un médicament
# =================================================================

def _gen_composition_medicament(entites: Dict[str, Any]) -> Tuple[str, str]:
    med = entites.get("medicament", "")
    filtre = ""
    if med:
        filtre = f"""FILTER(
    REGEX(?nomCommercial, "{re.escape(med)}", "i") ||
    REGEX(STR(?m), "{re.escape(med)}", "i")
  )"""
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?nomCommercial ?dosageMg ?nomMolecule ?formuleChimique ?nomExcipient ?effetNotoire WHERE {{
  ?m a/rdfs:subClassOf* :Medicament ;
     :nomCommercial ?nomCommercial .
  OPTIONAL {{ ?m :dosageMg ?dosageMg }}
  OPTIONAL {{ 
    ?m (:contientMolecule|:contientPrincipeActif) ?mol . 
    ?mol :nom ?nomMolecule .
    OPTIONAL {{ ?mol :formuleChimique ?formuleChimique }}
  }}
  OPTIONAL {{ 
    ?m :contientExcipient ?exc . 
    ?exc :nom ?nomExcipient .
    OPTIONAL {{ ?exc :effetNotoire ?effetNotoire }}
  }}
  {filtre}
}}"""
    return "SELECT", sparql


def _synth_composition_medicament(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("medicament", "le médicament")
    if not lignes:
        return f"Aucune composition trouvée pour '{cible}' dans l'ontologie."
    nom = lignes[0].get("nomCommercial", cible)
    dosage = lignes[0].get("dosageMg", "?")
    mols = list({l.get("nomMolecule") for l in lignes if l.get("nomMolecule")})
    excs = list({l.get("nomExcipient") for l in lignes if l.get("nomExcipient")})
    mols_str = ", ".join(mols) if mols else "Non renseigné"
    excs_str = ", ".join(excs) if excs else "Aucun excipient noté"
    return f"Composition de {nom} ({dosage} mg) : Principes actifs : [{mols_str}]. Excipients : [{excs_str}]."


enregistrer_intention(
    Intention(
        id_intention="medicaments_fiche_composition",
        domaine="Médicaments (Membre A)",
        description="Détailler la composition complète (principes actifs, molécules, excipients) d'un médicament",
        exemples=[
            "Quelle est la composition de l'Amoxicilline ?",
            "De quoi est composé le Clamoxyl ?",
            "Composition du Doliprane",
            "Quels sont les composants de l'Advil ?",
            "Quels sont les principes actifs de la Metformine ?",
            "Composition de l'Aspirine",
        ],
        mots_cles=["composition", "compose de", "composants", "principes actifs", "excipients"],
        generateur_sparql=_gen_composition_medicament,
        synthetiseur_reponse=_synth_composition_medicament,
    )
)
