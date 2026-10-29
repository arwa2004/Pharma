
import re
from typing import Any, Dict, List, Tuple

from nlp_engine import Intention, enregistrer_intention


# 1. Patients Polymédiqués (Classe définie ontologique >= 3 médicaments)
def _gen_polymediques(entites: Dict[str, Any]) -> Tuple[str, str]:
    # FIX: Use :Prescription to find medications instead of direct :prendMedicament
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?id ?nom ?prenom (COUNT(DISTINCT ?m) AS ?nb_medicaments) WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom .
  OPTIONAL { ?p :prenom ?prenom }
  
  ?presc a :Prescription ; :pourPatient ?p ; :prescritMedicament ?m .
  
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}
GROUP BY ?id ?nom ?prenom
HAVING (COUNT(DISTINCT ?m) >= 3)
ORDER BY ?nom"""
    return "SELECT", sparql


def _synth_polymediques(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun patient polymédiqué (prenant ≥ 3 médicaments) n'a été trouvé dans l'ontologie."
    noms = [f"{l.get('prenom', '')} {l.get('nom', '')} ({l.get('nb_medicaments', 0)} médicaments)".strip() for l in lignes]
    return f"Il y a {len(lignes)} patient(s) polymédiqué(s) (seuil ≥ 3 médicaments) : " + ", ".join(noms) + "."


enregistrer_intention(
    Intention(
        id_intention="patients_polymediques",
        domaine="Patients (Membre C)",
        description="Trouver les patients polymédiqués (prenant au moins 3 médicaments)",
        exemples=[
            "Quels patients sont polymédiqués ?",
            "Qui est polymédiqué ?",
            "Liste des patients polymédiqués",
            "Donne-moi les patients en polymédication",
            "Quels sont les patients qui prennent beaucoup de médicaments ?",
            "Afficher les patients polymédiques",
        ],
        mots_cles=["polymedique", "polymediques", "polymedication"],
        generateur_sparql=_gen_polymediques,
        synthetiseur_reponse=_synth_polymediques,
    )
)


# 2. Patients à Pathologie Multiple (Comorbidités >= 2 pathologies)
def _gen_patho_multiple(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?id ?nom ?prenom (COUNT(DISTINCT ?x) AS ?nb_pathologies) WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom .
  OPTIONAL { ?p :prenom ?prenom }
  ?p :souffreDe ?x .
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}
GROUP BY ?id ?nom ?prenom
HAVING (COUNT(DISTINCT ?x) >= 2)
ORDER BY ?nom"""
    return "SELECT", sparql


def _synth_patho_multiple(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun patient avec des pathologies multiples (≥ 2 pathologies) trouvé."
    noms = [f"{l.get('prenom', '')} {l.get('nom', '')} ({l.get('nb_pathologies', 0)} pathologies)".strip() for l in lignes]
    return f"Il y a {len(lignes)} patient(s) ayant des pathologies multiples (≥ 2 pathologies) : " + ", ".join(noms) + "."


enregistrer_intention(
    Intention(
        id_intention="patients_pathologie_multiple",
        domaine="Patients (Membre C)",
        description="Trouver les patients atteints de plusieurs pathologies (comorbidités)",
        exemples=[
            "Quels patients ont des pathologies multiples ?",
            "Qui a plusieurs maladies ?",
            "Liste des patients avec comorbidités",
            "Quels patients souffrent de plusieurs pathologies ?",
            "Patients avec comorbidité",
            "Qui a plus d'une pathologie ?",
        ],
        mots_cles=["pathologie multiple", "pathologies multiples", "plusieurs maladies", "comorbidite", "comorbidites"],
        generateur_sparql=_gen_patho_multiple,
        synthetiseur_reponse=_synth_patho_multiple,
    )
)


# 3. Médicaments pris par un patient spécifique (via Prescription)
def _gen_medicaments_patient(entites: Dict[str, Any]) -> Tuple[str, str]:
    nom = entites.get("nom", "")
    filtre = ""
    if nom:
        filtre = f"""FILTER(
    REGEX(COALESCE(?nomPatient, ""), "{re.escape(nom)}", "i") ||
    REGEX(COALESCE(?prenomPatient, ""), "{re.escape(nom)}", "i") ||
    REGEX(STR(?p), "{re.escape(nom)}", "i")
  )"""
    
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?nomPatient ?prenomPatient ?idMed ?nomCommercial WHERE {{
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nomPatient .
  OPTIONAL {{ ?p :prenom ?prenomPatient }}
  
  ?presc a :Prescription ;
         :pourPatient ?p ;
         :prescritMedicament ?m .
         
  OPTIONAL {{ ?m :nomCommercial ?nomCommercial }}
  BIND(STRAFTER(STR(?m), "#") AS ?idMed)
  
  {filtre}
}} ORDER BY ?nomPatient ?nomCommercial"""
    return "SELECT", sparql


def _synth_medicaments_patient(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("nom", "le patient")
    if not lignes:
        return f"Aucun médicament enregistré pour '{cible}' dans l'ontologie."
    p_nom = f"{lignes[0].get('prenomPatient', '')} {lignes[0].get('nomPatient', '')}".strip() or cible
    meds = [l.get("nomCommercial") or l.get("idMed", "") for l in lignes]
    meds_str = ", ".join(meds)
    return f"{p_nom} prend {len(meds)} médicament(s) : {meds_str}."


enregistrer_intention(
    Intention(
        id_intention="medicaments_patient",
        domaine="Patients (Membre C)",
        description="Lister les médicaments prescrits/pris par un patient",
        exemples=[
            "Quels médicaments prend Sami ?",
            "Quel médicament prend Leila ?",
            "Que prend Sami Ben Salah ?",
            "Médicaments de Ben Salah",
            "Quels sont les traitements de Hedi ?",
            "Traitement de Sami",
            "Que prend le patient ?",
        ],
        mots_cles=["medicament", "medicaments", "traitement", "traitements", "prend"],
        generateur_sparql=_gen_medicaments_patient,
        synthetiseur_reponse=_synth_medicaments_patient,
    )
)


# 4. Pathologies d'un patient spécifique (:souffreDe)
def _gen_pathologies_patient(entites: Dict[str, Any]) -> Tuple[str, str]:
    nom = entites.get("nom", "")
    filtre = ""
    if nom:
        filtre = f"""FILTER(
    REGEX(COALESCE(?nomPatient, ""), "{re.escape(nom)}", "i") ||
    REGEX(COALESCE(?prenomPatient, ""), "{re.escape(nom)}", "i") ||
    REGEX(STR(?p), "{re.escape(nom)}", "i")
  )"""
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?nomPatient ?prenomPatient ?idPatho ?libellePatho WHERE {{
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nomPatient ; :souffreDe ?x .
  OPTIONAL {{ ?p :prenom ?prenomPatient }}
  OPTIONAL {{ ?x :libelle ?libellePatho }}
  BIND(STRAFTER(STR(?x), "#") AS ?idPatho)
  {filtre}
}} ORDER BY ?nomPatient ?libellePatho"""
    return "SELECT", sparql


def _synth_pathologies_patient(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("nom", "le patient")
    if not lignes:
        return f"Aucune pathologie enregistrée pour '{cible}' dans l'ontologie."
    p_nom = f"{lignes[0].get('prenomPatient', '')} {lignes[0].get('nomPatient', '')}".strip() or cible
    pathos = [l.get("libellePatho") or l.get("idPatho", "") for l in lignes]
    pathos_str = ", ".join(pathos)
    return f"{p_nom} souffre de {len(pathos)} pathologie(s) : {pathos_str}."


enregistrer_intention(
    Intention(
        id_intention="pathologies_patient",
        domaine="Patients (Membre C)",
        description="Lister les pathologies dont souffre un patient",
        exemples=[
            "De quoi souffre Sami ?",
            "Quelles sont les maladies de Sami ?",
            "De quelle maladie souffre Leila ?",
            "Pathologies de Ben Salah",
            "Quelles pathologies a Hedi ?",
            "De quoi souffre le patient ?",
        ],
        mots_cles=["souffre", "maladie", "maladies", "pathologie", "pathologies"],
        generateur_sparql=_gen_pathologies_patient,
        synthetiseur_reponse=_synth_pathologies_patient,
    )
)


# 5. Médecin référent d'un patient (Direct ou via Prescription)
def _gen_medecin_patient(entites: Dict[str, Any]) -> Tuple[str, str]:
    nom = entites.get("nom", "")
    filtre = ""
    if nom:
        filtre = f"""FILTER(
    REGEX(COALESCE(?nomPatient, ""), "{re.escape(nom)}", "i") ||
    REGEX(COALESCE(?prenomPatient, ""), "{re.escape(nom)}", "i") ||
    REGEX(STR(?p), "{re.escape(nom)}", "i")
  )"""
    
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT DISTINCT ?nomPatient ?prenomPatient ?nomDoc ?prenomDoc ?idDoc WHERE {{
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nomPatient .
  OPTIONAL {{ ?p :prenom ?prenomPatient }}
  
  {{
    ?p :estSuiviPar ?d .
  }} UNION {{
    ?presc a :Prescription ;
           :pourPatient ?p ;
           :emisePar ?d .
  }}
  
  OPTIONAL {{ ?d :nom ?nomDoc }}
  OPTIONAL {{ ?d :prenom ?prenomDoc }}
  BIND(STRAFTER(STR(?d), "#") AS ?idDoc)
  {filtre}
}}"""
    return "SELECT", sparql


def _synth_medecin_patient(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("nom", "Le patient")
    if not lignes:
        return f"'{cible}' n'a pas de médecin référent assigné dans le graphe RDF."
    d = lignes[0]
    p_nom = f"{d.get('prenomPatient', '')} {d.get('nomPatient', '')}".strip() or cible
    nom_doc = f"Dr. {d.get('prenomDoc', '')} {d.get('nomDoc', '')}".strip()
    return f"{p_nom} est suivi(e) par le {nom_doc} (:{d.get('idDoc', '')})."


enregistrer_intention(
    Intention(
        id_intention="medecin_patient",
        domaine="Patients (Membre C)",
        description="Trouver le médecin référent qui suit un patient",
        exemples=[
            "Qui est le médecin de Sami ?",
            "Quel médecin suit Sami ?",
            "Médecin traitant de Leila",
            "Par qui est suivi Hedi ?",
            "Quel docteur suit Ben Salah ?",
        ],
        mots_cles=["medecin", "docteur", "suivi", "suit", "referent"],
        generateur_sparql=_gen_medecin_patient,
        synthetiseur_reponse=_synth_medecin_patient,
    )
)


# 6. Interactions médicamenteuses chez les patients (Requête croisée via Prescription)
def _gen_interactions(entites: Dict[str, Any]) -> Tuple[str, str]:
    # FIX: Using the direct :interagitAvec property found in your dataset
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
<<<<<<< HEAD
SELECT DISTINCT ?nomPatient ?medA ?nomMedA ?medB ?nomMedB ?interaction ?libelle WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nomPatient ;
     :prendMedicament ?a , ?b .
  ?i :impliqueMedicament ?a , ?b .
  FILTER(STR(?a) < STR(?b))
  OPTIONAL { ?a :nomCommercial ?nomMedA }
  OPTIONAL { ?b :nomCommercial ?nomMedB }
  OPTIONAL { ?i :libelle ?libelle }
  BIND(STRAFTER(STR(?a), "#") AS ?medA)
  BIND(STRAFTER(STR(?b), "#") AS ?medB)
  BIND(STRAFTER(STR(?i), "#") AS ?interaction)
=======
SELECT DISTINCT ?nomPatient ?medA ?nomMedA ?medB ?nomMedB WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nomPatient .
  
  ?presc a :Prescription ; :pourPatient ?p ; :prescritMedicament ?medA, ?medB .
  
  # Check for the direct interaction property (either direction)
  { ?medA :interagitAvec ?medB } UNION { ?medB :interagitAvec ?medA }
  
  # Avoid duplicate pairs (A-B and B-A)
  FILTER(STR(?medA) < STR(?medB))
  
  OPTIONAL { ?medA :nomCommercial ?nomMedA }
  OPTIONAL { ?medB :nomCommercial ?nomMedB }
  
  BIND(STRAFTER(STR(?medA), "#") AS ?medA_id)
  BIND(STRAFTER(STR(?medB), "#") AS ?medB_id)
>>>>>>> b2b08b177218a69e4aba41aae1c14727fdb3dd19
} ORDER BY ?nomPatient"""
    return "SELECT", sparql


def _synth_interactions(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun patient n'est actuellement exposé à une interaction médicamenteuse connue dans le dataset."
    
    details = []
    for l in lignes:
        mA = l.get("nomMedA") or l.get("medA", "Médicament A")
        mB = l.get("nomMedB") or l.get("medB", "Médicament B")
        details.append(f"{l.get('nomPatient')} (Interaction entre {mA} et {mB})")
        
    return f"Alerte clinique : {len(lignes)} patient(s) à risque d'interaction : " + "; ".join(details) + "."



enregistrer_intention(
    Intention(
        id_intention="interactions_patients",
        domaine="Patients (Membre C)",
        description="Détecter les patients exposés à une interaction médicamenteuse croisée",
        exemples=[
            "Y a-t-il des patients avec des interactions médicamenteuses ?",
            "Quels patients risquent une interaction ?",
            "Y a-t-il un risque d'interaction chez un patient ?",
            "Patients avec interaction de médicaments",
            "Quels patients prennent des médicaments qui interagissent ?",
        ],
        mots_cles=["interaction", "interactions", "risque d'interaction", "interagissent"],
        generateur_sparql=_gen_interactions,
        synthetiseur_reponse=_synth_interactions,
    )
)


# 7. Patients par seuil d'âge
def _gen_patients_age(entites: Dict[str, Any]) -> Tuple[str, str]:
    age = entites.get("age", 60)
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?id ?nom ?prenom ?age WHERE {{
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom ; :age ?age .
  OPTIONAL {{ ?p :prenom ?prenom }}
  FILTER(?age >= {age})
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}} ORDER BY ?age ?nom"""
    return "SELECT", sparql


def _synth_patients_age(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    age = entites.get("age", 60)
    if not lignes:
        return f"Aucun patient âgé de {age} ans ou plus n'a été trouvé."
    noms = [f"{l.get('prenom', '')} {l.get('nom', '')} ({l.get('age')} ans)".strip() for l in lignes]
    return f"Il y a {len(lignes)} patient(s) de {age} ans ou plus : " + ", ".join(noms) + "."


enregistrer_intention(
    Intention(
        id_intention="patients_par_age",
        domaine="Patients (Membre C)",
        description="Filtrer les patients par âge minimum (ex : plus de 60 ans)",
        exemples=[
            "Quels patients ont plus de 60 ans ?",
            "Patients âgés de plus de 50 ans",
            "Liste des patients seniors",
            "Qui a plus de 70 ans ?",
            "Patients de plus de 40 ans",
        ],
        mots_cles=["ans", "age", "seniors", "plus de"],
        generateur_sparql=_gen_patients_age,
        synthetiseur_reponse=_synth_patients_age,
    )
)


# 8. Liste globale de tous les patients
def _gen_tous_patients(entites: Dict[str, Any]) -> Tuple[str, str]:
    sparql = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
SELECT ?id ?nom ?prenom ?age WHERE {
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom ; :age ?age .
  OPTIONAL { ?p :prenom ?prenom }
  BIND(STRAFTER(STR(?p), "#") AS ?id)
} ORDER BY ?nom"""
    return "SELECT", sparql


def _synth_tous_patients(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    if not lignes:
        return "Aucun patient n'est actuellement enregistré dans le dataset."
    return f"Le dataset contient {len(lignes)} patient(s) enregistré(s) dans l'ontologie."


enregistrer_intention(
    Intention(
        id_intention="liste_tous_patients",
        domaine="Patients (Membre C)",
        description="Afficher la liste complète des patients",
        exemples=[
            "Donne-moi la liste de tous les patients",
            "Afficher tous les patients",
            "Quels sont les patients enregistrés ?",
            "Liste de tous les dossiers patients",
            "Montre-moi les patients",
        ],
        mots_cles=["tous les patients", "liste des patients", "liste de tous les patients"],
        generateur_sparql=_gen_tous_patients,
        synthetiseur_reponse=_synth_tous_patients,
    )
)


# 9. Test booléen de polymédication (Requête SPARQL ASK !)
def _gen_ask_polymedique(entites: Dict[str, Any]) -> Tuple[str, str]:
    nom = entites.get("nom", "")
    filtre = ""
    if nom:
        filtre = f"""FILTER(
    REGEX(COALESCE(?nom, ""), "{re.escape(nom)}", "i") ||
    REGEX(COALESCE(?prenom, ""), "{re.escape(nom)}", "i") ||
    REGEX(STR(?p), "{re.escape(nom)}", "i")
  )"""
    
    # FIX: Use :Prescription instead of direct :prendMedicament
    sparql = f"""PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
ASK {{
  ?p a/rdfs:subClassOf* :Patient ; :nom ?nom .
  
  ?presc a :Prescription ; :pourPatient ?p ; :prescritMedicament ?m1, ?m2, ?m3 .
  
  OPTIONAL {{ ?p :prenom ?prenom }}
  FILTER(?m1 != ?m2 && ?m1 != ?m3 && ?m2 != ?m3)
  {filtre}
}}"""
    return "ASK", sparql


def _synth_ask_polymedique(lignes: List[Dict[str, Any]], entites: Dict[str, Any]) -> str:
    cible = entites.get("nom", "Le patient")
    est_poly = lignes[0].get("reponse_booleenne", False) if lignes else False
    if est_poly:
        return f"OUI (VRAI) : {cible} est bien polymédiqué(e) d'après l'ontologie (prend au moins 3 médicaments distincts)."
    else:
        return f"NON (FAUX) : {cible} n'est pas polymédiqué(e) (prend moins de 3 médicaments)."


enregistrer_intention(
    Intention(
        id_intention="verifier_polymedique_ask",
        domaine="Patients (Membre C)",
        description="Vérifier si un patient est polymédiqué via une requête SPARQL ASK (booléen)",
        exemples=[
            "Est-ce que Sami est polymédiqué ?",
            "Sami est-il polymédiqué ?",
            "Est-ce que Leila est polymédiquée ?",
            "Leila est-elle polymédiquée ?",
            "Est-ce que Ben Salah est polymédiqué ?",
        ],
        mots_cles=["est-ce que", "est-il", "est-elle", "polymedique", "polymedique ?"],
        generateur_sparql=_gen_ask_polymedique,
        synthetiseur_reponse=_synth_ask_polymedique,
    )
)