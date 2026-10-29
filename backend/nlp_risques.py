import re
import unicodedata

import fuseki_client as fc

# ---------------------------------------------------------------------------
# Modèle spaCy (optionnel : sert uniquement à lemmatiser)
# ---------------------------------------------------------------------------
try:
    import spacy
    try:
        nlp = spacy.load("fr_core_news_sm")
    except OSError:
        nlp = spacy.blank("fr")
except ImportError:
    nlp = None

PREFIXES = """
PREFIX :     <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

# ---------------------------------------------------------------------------
# Synonymes du langage courant -> libellé canonique de l'ontologie
# (clé = libellé du TTL, normalisé et sans parenthèse)
# Les alias ne servent que si le libellé existe réellement dans la base.
# ---------------------------------------------------------------------------
ALIAS_PAR_LIBELLE = {
    "nausees": ["nausee", "envie de vomir", "vomissement", "vomir", "mal au coeur"],
    "vertiges": ["vertige", "etourdissement", "tete qui tourne", "tourne la tete"],
    "troubles digestifs": [
        "trouble de la digestion", "mal au ventre", "mal a l estomac",
        "douleur abdominale", "douleurs abdominales", "brulure d estomac",
        "brulures d estomac", "diarrhee", "constipation", "ballonnement",
    ],
    "hemorragie": ["saignement", "saigne", "saigner", "sang dans les selles",
                   "sang dans les urines", "saignement de nez"],
    "atteinte hepatique": ["probleme de foie", "douleur au foie", "jaunisse",
                           "peau jaune", "yeux jaunes"],
    "reaction allergique": ["allergie", "allergique", "urticaire", "eruption cutanee",
                            "demangeaison", "boutons", "plaques rouges"],
    "acidose lactique": ["acidose"],
}

# Urgences : toujours détectées, indépendamment de l'ontologie
URGENCES = [
    "difficulte a respirer", "mal a respirer", "respiratoire", "respirer",
    "gonflement du visage", "gonflement de la gorge", "gonflement des levres",
    "etouffement", "choc anaphylactique", "perte de connaissance",
    "saignement abondant", "hemorragie abondante",
]

NEGATIONS = {"pas", "aucun", "aucune", "sans", "ni", "jamais", "plus"}
FENETRE_NEGATION = 4  # nb de mots avant le symptôme où l'on cherche une négation


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------
def normaliser_texte(texte: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texte)
    sans_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return sans_accents.lower().strip()


def _racine(mot: str) -> str:
    """Stemming minimal : pluriels (nausees -> nausee, vertiges -> vertige)."""
    if len(mot) > 3 and mot[-1] in "sx":
        return mot[:-1]
    return mot


def _tokens(texte: str, lemma: bool = False) -> list:
    """
    Texte -> tokens normalisés (minuscules, sans accents, sans pluriel).
    lemma=False : formes de surface (déterministe, ne dépend pas de spaCy)
    lemma=True  : lemmes spaCy si le lemmatiseur est disponible
    """
    texte = texte.lower()
    if lemma and nlp is not None and nlp.has_pipe("lemmatizer"):
        brut = [(t.lemma_ or t.text) for t in nlp(texte) if t.is_alpha]
    else:
        brut = re.findall(r"[^\W\d_]+", texte, flags=re.UNICODE)
    return [_racine(normaliser_texte(m)) for m in brut if m]


def _phrase_tokens(phrase: str, lemma: bool = False) -> tuple:
    """Même pipeline que le texte utilisateur -> comparaison cohérente."""
    return tuple(_tokens(phrase.replace("'", " "), lemma))


def _libelle_canonique(libelle: str) -> str:
    """'Atteinte hepatique (surdosage)' -> 'atteinte hepatique'."""
    sans_parenthese = re.sub(r"\(.*?\)", " ", libelle)
    return re.sub(r"\s+", " ", normaliser_texte(sans_parenthese)).strip()


def _vers_bool(v) -> bool:
    return str(v).strip().lower() in ("true", "1")


def _val(v):
    """Tolère un retour fuseki sous forme de valeur brute ou {'value': ...}."""
    return v.get("value") if isinstance(v, dict) else v


def _trouver(tokens: list, phrase: tuple) -> list:
    """Positions de début où `phrase` apparaît de façon contiguë dans `tokens`."""
    n = len(phrase)
    if n == 0:
        return []
    return [i for i in range(len(tokens) - n + 1) if tuple(tokens[i:i + n]) == phrase]


def _est_nie(tokens: list, debut: int) -> bool:
    fenetre = tokens[max(0, debut - FENETRE_NEGATION):debut]
    return any(t in NEGATIONS for t in fenetre)


# ---------------------------------------------------------------------------
# Accès ontologie : UNE seule requête (effets + médicaments + gravité)
# ---------------------------------------------------------------------------
QUERY_EFFETS_MEDS = PREFIXES + """
SELECT DISTINCT ?libelle ?nomMed ?codeAMM ?freq ?estGrave WHERE {
  ?e a/rdfs:subClassOf* :EffetSecondaire ;
     :libelle ?libelle .
  OPTIONAL { ?e :frequenceEffet ?freq }
  OPTIONAL {
    ?m :aEffetSecondaire ?e ;
       :nomCommercial ?nomMed .
    OPTIONAL { ?m :codeAMM ?codeAMM }
  }
  BIND(EXISTS { ?e a/rdfs:subClassOf* :EffetSecondaireGrave } AS ?estGrave)
}
"""


def _charger_effets() -> dict:
    """
    Retourne {libelle_canonique: {"libelle": str, "grave": bool,
                                  "frequence": float|None, "medicaments": [..]}}
    """
    effets = {}
    for r in fc.select(QUERY_EFFETS_MEDS):
        libelle = _val(r.get("libelle"))
        if not libelle:
            continue
        cle = _libelle_canonique(libelle)
        fiche = effets.setdefault(cle, {
            "libelle": libelle,
            "grave": _vers_bool(_val(r.get("estGrave"))),
            "frequence": None,
            "medicaments": {},
        })
        freq = _val(r.get("freq"))
        if freq not in (None, ""):
            try:
                fiche["frequence"] = float(freq)
            except ValueError:
                pass
        nom = _val(r.get("nomMed"))
        if nom:
            fiche["medicaments"][nom] = _val(r.get("codeAMM"))
    return effets


# ---------------------------------------------------------------------------
# Analyse principale
# ---------------------------------------------------------------------------
def analyser_symptomes(texte_utilisateur: str) -> dict:
    """
    Analyse le texte pour trouver des effets secondaires connus dans l'ontologie
    et les médicaments qui les provoquent.
    """
    texte_norm = normaliser_texte(texte_utilisateur).replace("'", " ")

    # 1. Urgence
    alerte_urgence = any(u in texte_norm for u in URGENCES)

    # 2. Effets secondaires + médicaments depuis Fuseki
    try:
        effets = _charger_effets()
    except Exception as e:
        return {"erreur": f"Erreur de connexion à la base de données: {e}"}

    # 3. Détection (par clause, pour borner la portée de la négation).
    #    On essaie les formes de surface ET les lemmes : un symptôme est
    #    retenu si l'un des deux modes le trouve (robuste au lemmatiseur).
    clauses = re.split(r"[.,;:!?\n]|\bmais\b|\bet pourtant\b", texte_utilisateur)
    clauses = [c.replace("'", " ") for c in clauses]

    positifs, negatifs = set(), set()
    for lemma in (False, True):
        clauses_tokens = [t for t in (_tokens(c, lemma) for c in clauses) if t]
        for cle in effets:
            variantes = {_phrase_tokens(cle, lemma)}
            for alias in ALIAS_PAR_LIBELLE.get(cle, []):
                variantes.add(_phrase_tokens(alias, lemma))
            variantes.discard(())
            for tokens in clauses_tokens:
                for var in variantes:
                    for pos in _trouver(tokens, var):
                        (negatifs if _est_nie(tokens, pos) else positifs).add(cle)

    detectes = [c for c in effets if c in positifs]
    nies = [effets[c]["libelle"] for c in effets if c in negatifs and c not in positifs]

    if not detectes:
        return {
            "symptomes_detectes": [],
            "symptomes_nies": nies,
            "medicaments_risque": [],
            "alerte_urgence": alerte_urgence,
            "alerte_grave": False,
            "message": "Aucun effet secondaire connu n'a été détecté dans votre description.",
        }

    # 4. Médicaments associés
    medicaments_risque = []
    for cle in detectes:
        fiche = effets[cle]
        for nom, amm in sorted(fiche["medicaments"].items()):
            medicaments_risque.append({
                "medicament": nom,
                "code_amm": amm,
                "symptome": fiche["libelle"],
                "est_grave": fiche["grave"],
                "frequence_pct": fiche["frequence"],
            })

    # graves d'abord, puis par fréquence décroissante
    medicaments_risque.sort(key=lambda x: (not x["est_grave"], -(x["frequence_pct"] or 0)))

    alerte_grave = any(effets[c]["grave"] for c in detectes)

    return {
        "symptomes_detectes": [effets[c]["libelle"] for c in detectes],
        "symptomes_nies": nies,
        "medicaments_risque": medicaments_risque,
        "alerte_urgence": alerte_urgence,
        "alerte_grave": alerte_grave,
        "message": "Analyse terminée.",
    }