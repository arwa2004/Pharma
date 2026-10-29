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
            # Fallback si modèle sm ou standard
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

def extraire_entites(doc, question: str) -> Dict[str, Any]:
    """Extrait le nom de personne, les valeurs numériques (âge), etc."""
    entites: Dict[str, Any] = {}

    # 1. Extraction d'âge ou nombre
    # Recherche regex d'âge : ex "60 ans", "plus de 50", ">= 40"
    m_age = re.search(r"(?:plus de|de plus de|>|>=|superieur a|age de|age|ans)\s*(\d{1,3})", question, re.IGNORECASE)
    if not m_age:
        m_age = re.search(r"(\d{1,3})\s*(?:ans|an)", question, re.IGNORECASE)
    if m_age:
        try:
            entites["age"] = int(m_age.group(1))
        except ValueError:
            pass

    # 2. Entités nommées spaCy (Personnes)
    noms_personnes = []
    for ent in doc.ents:
        if ent.label_ in ("PER", "MISC", "LOC"):
            # Nettoyer l'entité
            texte_ent = ent.text.strip()
            # Éviter de capturer des mots-clés du domaine
            mots_bannis = {"patient", "patients", "medicament", "medicaments", "docteur", "medecin", "pathologie", "maladie"}
            if texte_ent.lower() not in mots_bannis:
                noms_personnes.append(texte_ent)

    # 3. Fallback d'extraction de nom si spaCy n'a pas détecté l'entité
    # Recherche de motifs "de [Nom]", "pour [Nom]", "chez [Nom]"
    if not noms_personnes:
        m_nom = re.search(r"(?:de|chez|pour|concerne|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", question)
        if m_nom:
            noms_personnes.append(m_nom.group(1))

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
            # Similarité vectorielle spaCy (si disponible)
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
                "Essayez par exemple : 'Quels patients sont polymédiqués ?', 'De quoi souffre Sami ?', "
                "ou 'Quels médicaments prend Sami ?'."
            ),
            "suggestions": [
                "Quels patients sont polymédiqués ?",
                "Quels patients ont des pathologies multiples ?",
                "De quoi souffre Sami ?",
                "Quels médicaments prend Sami ?",
                "Qui est le médecin de Sami ?",
                "Y a-t-il des patients avec des interactions médicamenteuses ?",
                "Quels patients ont plus de 60 ans ?",
                "Donne-moi la liste de tous les patients",
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
