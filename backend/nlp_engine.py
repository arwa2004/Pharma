"""Moteur NLP commun pour la transformation Question en Langage Naturel -> SPARQL.

Architecture modulaire :
- spaCy fr_core_news_md pour l'analyse morpho-syntaxique, la lemmatisation et l'extraction d'entités (NER).
- Registre d'intentions extensible : chaque membre peut enregistrer ses modèles de questions et générateurs SPARQL.
- Aucun appel à une API LLM externe : 100% local, déterministe et conforme aux exigences pédagogiques.
"""
import re
import unicodedata
from typing import Any, Callable, Dict, List, Optional, Tuple

import spacy
from spacy.language import Language

import fuseki_client as fc

# Chargement unique du modèle spaCy français
_nlp: Optional[Language] = None


def get_nlp() -> Language:
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("fr_core_news_md")
        except Exception:
            _nlp = spacy.blank("fr")
    return _nlp


def normaliser_texte(texte: str) -> str:
    """Retire les accents, passe en minuscules et nettoie la ponctuation."""
    nfkd = unicodedata.normalize("NFKD", texte)
    sans_accents = "".join([c for c in nfkd if not unicodedata.combining(c)])
    return sans_accents.lower().strip()


class Intention:
    def __init__(
        self,
        id_intention: str,
        domaine: str,
        description: str,
        exemples: List[str],
        generateur_sparql: Callable[[Dict[str, Any]], Tuple[str, str]],
        synthetiseur_reponse: Optional[Callable[[List[Dict[str, Any]], Dict[str, Any]], str]] = None,
        mots_cles: Optional[List[str]] = None,
    ):
        self.id = id_intention
        self.domaine = domaine
        self.description = description
        self.exemples = exemples
        self.generateur_sparql = generateur_sparql
        self.synthetiseur_reponse = synthetiseur_reponse
        self.mots_cles = [normaliser_texte(m) for m in (mots_cles or [])]


# Registre global des intentions
REGISTRE_INTENTIONS: Dict[str, Intention] = {}


def enregistrer_intention(intention: Intention):
    REGISTRE_INTENTIONS[intention.id] = intention


# ---------- Extracteur d'entités avec spaCy ----------

MOLECULES_CONNUES = [
    "paracetamol", "amoxicilline", "ibuprofene", "metformine",
    "warfarine", "aspirine", "omeprazole", "ciprofloxacine",
    "acide acetylsalicylique", "penicilline"
]

LABORATOIRES_CONNUS = [
    "sanofi", "pfizer", "saiph", "unimed", "bayer", "gsk",
    "glaxosmithkline", "opalia", "recordati"
]

MEDICAMENTS_CONNUS = [
    "amoxicilline clamoxyl", "clamoxyl", "ibuprofene advil", "advil",
    "metformine glucophage", "glucophage", "warfarine coumadine", "coumadine",
    "aspirine protect", "aspirine", "paracetamol doliprane", "doliprane",
    "omeprazole mopral", "mopral", "ciprofloxacine ciflox", "ciflox"
]

FORMES_CONNUES = [
    "comprime", "gelule", "sirop", "injectable", "solution injectable",
    "pommade", "sachet", "suspension"
]


def extraire_entites(doc, question: str) -> Dict[str, Any]:
    """Extrait le nom de personne, les valeurs numériques (âge, dosage), molécules, médicaments, labos, etc."""
    entites: Dict[str, Any] = {}
    q_norm = normaliser_texte(question)

    # 1. Extraction d'âge ou nombre
    m_age = re.search(r"(?:plus de|de plus de|>|>=|superieur a|age de|age|ans)\s*(\d{1,3})", question, re.IGNORECASE)
    if not m_age:
        m_age = re.search(r"(\d{1,3})\s*(?:ans|an)", question, re.IGNORECASE)
    if m_age:
        try:
            entites["age"] = int(m_age.group(1))
        except ValueError:
            pass

    # Extraction de seuil de dosage
    m_dose = re.search(r"(?:dosage|dose|superieur a|>|>=|plus de|dose a)\s*(\d+(?:\.\d+)?)\s*(?:mg)?", q_norm)
    if not m_dose:
        m_dose = re.search(r"(\d+(?:\.\d+)?)\s*(?:mg|milligramme)", q_norm)
    if m_dose:
        try:
            entites["dosage"] = float(m_dose.group(1))
        except ValueError:
            pass

    # 2. Détection Molécules
    for mol in sorted(MOLECULES_CONNUES, key=len, reverse=True):
        if mol in q_norm:
            entites["molecule"] = mol
            break

    # 3. Détection Laboratoires
    for lab in sorted(LABORATOIRES_CONNUS, key=len, reverse=True):
        if lab in q_norm:
            entites["laboratoire"] = lab
            break

    # 4. Détection Médicaments
    for med in sorted(MEDICAMENTS_CONNUS, key=len, reverse=True):
        if med in q_norm:
            entites["medicament"] = med
            break

    # 5. Détection Formes Galéniques
    for frm in sorted(FORMES_CONNUES, key=len, reverse=True):
        if frm in q_norm:
            entites["forme"] = frm
            break

    # 6. Entités nommées spaCy (Personnes)
    noms_personnes = []
    mots_bannis = {
        "patient", "patients", "medicament", "medicaments", "docteur", "medecin",
        "pathologie", "maladie", "doliprane", "aspirine", "advil", "clamoxyl",
        "glucophage", "coumadine", "mopral", "sanofi", "pfizer", "bayer", "gsk",
        "saiph", "unimed", "forme", "voie", "ordonnance"
    }

    for ent in doc.ents:
        if ent.label_ in ("PER", "MISC", "LOC"):
            texte_ent = ent.text.strip()
            if normaliser_texte(texte_ent) not in mots_bannis:
                noms_personnes.append(texte_ent)

    # Fallback pour le nom du patient (ex: "de Sami", "pour Leila")
    if not noms_personnes:
        m_nom = re.search(r"(?:de|chez|pour|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", question)
        if m_nom:
            candidat_nom = m_nom.group(1)
            if normaliser_texte(candidat_nom) not in mots_bannis:
                noms_personnes.append(candidat_nom)

    if noms_personnes:
        entites["nom"] = noms_personnes[0]

    return entites


# ---------- Algorithme d'appariement d'intention ----------

def detecter_intention(question: str) -> Tuple[Optional[Intention], float, Dict[str, Any]]:
    """Détecte l'intention avec le plus haut score de pertinence via spaCy & lemmes."""
    nlp = get_nlp()
    doc_q = nlp(question)
    q_norm = normaliser_texte(question)
    lemmes_q = set([t.lemma_.lower() for t in doc_q if not t.is_stop and not t.is_punct])

    entites = extraire_entites(doc_q, question)

    meilleure_intention: Optional[Intention] = None
    meilleur_score = 0.0

    for intention in REGISTRE_INTENTIONS.values():
        score_max_exemples = 0.0

        # Score basé sur les mots-clés obligatoires / discriminants
        score_mots_cles = 0.0
        if intention.mots_cles:
            nb_matches = sum(1 for m in intention.mots_cles if m in q_norm)
            score_mots_cles = nb_matches / len(intention.mots_cles)

        # Score sémantique comparé à chaque phrase d'exemple de l'intention
        for exemple in intention.exemples:
            doc_ex = nlp(exemple)
            sim_vectorielle = 0.0
            if doc_q.has_vector and doc_ex.has_vector and doc_q.vector_norm and doc_ex.vector_norm:
                sim_vectorielle = float(doc_q.similarity(doc_ex))

            # Similarité lexicale par recouvrement de lemmes (Jaccard)
            lemmes_ex = set([t.lemma_.lower() for t in doc_ex if not t.is_stop and not t.is_punct])
            intersection = lemmes_q.intersection(lemmes_ex)
            union = lemmes_q.union(lemmes_ex)
            sim_lemmes = len(intersection) / len(union) if union else 0.0

            # Score combiné pour cet exemple
            score_ex = 0.6 * sim_lemmes + 0.4 * sim_vectorielle
            if score_ex > score_max_exemples:
                score_max_exemples = score_ex

        score_total = max(score_max_exemples, score_mots_cles * 0.9)
        # Bonus si les mots-clés correspondent fortement
        if score_mots_cles >= 0.5:
            score_total = max(score_total, 0.7 + (score_mots_cles * 0.25))

        if score_total > meilleur_score:
            meilleur_score = score_total
            meilleure_intention = intention

    return meilleure_intention, round(min(meilleur_score, 1.0), 3), entites


# ---------- Pipeline de traitement d'une question ----------

def executer_nlp(question: str) -> Dict[str, Any]:
    """Exécute la chaîne complète : NLP -> SPARQL -> Fuseki -> Synthèse de réponse."""
    if not question or not question.strip():
        return {
            "question": "",
            "succes": False,
            "erreur": "Veuillez poser une question en français.",
        }

    intention, confiance, entites = detecter_intention(question)

    if not intention or confiance < 0.35:
        return {
            "question": question,
            "succes": False,
            "confiance": confiance,
            "erreur": (
                "Je n'ai pas pu identifier l'intention de votre question avec une certitude suffisante. "
                "Essayez par exemple : 'Quels médicaments contiennent du paracétamol ?', 'Qui fabrique la Metformine ?', "
                "ou 'Quels médicaments ont une contre-indication absolue ?'."
            ),
            "suggestions": [
                "Quels médicaments contiennent du paracétamol ?",
                "Qui fabrique la Metformine ?",
                "Quelle est la forme de l'Aspirine ?",
                "Quels médicaments ont une contre-indication absolue ?",
                "Quels médicaments sont sur ordonnance ?",
                "Quels patients sont polymédiqués ?",
                "De quoi souffre Sami ?",
                "Quels médicaments prend Sami ?",
            ],
        }

    # Génération du code SPARQL
    type_requete, sparql = intention.generateur_sparql(entites)

    # Exécution sur Fuseki
    resultat: Any = None
    reponse_texte = ""

    try:
        if type_requete == "ASK":
            res_bool = fc.ask(sparql)
            resultat = {"reponse_booleenne": res_bool}
            if intention.synthetiseur_reponse:
                reponse_texte = intention.synthetiseur_reponse([resultat], entites)
            else:
                reponse_texte = "Oui (Vrai)" if res_bool else "Non (Faux)"
        else:
            lignes = fc.select(sparql)
            resultat = lignes
            if intention.synthetiseur_reponse:
                reponse_texte = intention.synthetiseur_reponse(lignes, entites)
            else:
                nb = len(lignes)
                reponse_texte = f"{nb} résultat(s) trouvé(s) dans l'ontologie."
    except Exception as e:
        return {
            "question": question,
            "succes": False,
            "intention": intention.id,
            "description_intention": intention.description,
            "confiance": confiance,
            "entites": entites,
            "sparql": sparql,
            "erreur": f"Erreur lors de l'exécution SPARQL sur Fuseki : {str(e)}",
        }

    return {
        "question": question,
        "succes": True,
        "intention": intention.id,
        "domaine": intention.domaine,
        "description_intention": intention.description,
        "confiance": confiance,
        "entites": entites,
        "type_requete": type_requete,
        "sparql": sparql,
        "reponse_texte": reponse_texte,
        "donnees": resultat,
    }
