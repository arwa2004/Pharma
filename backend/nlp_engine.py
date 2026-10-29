"""Moteur NLP commun : question en français -> SPARQL -> Fuseki (100 % local, sans API LLM).

Chaîne de traitement :
 1. Lexique : les noms de patients, médicaments, molécules et laboratoires sont lus dans
    l'ontologie (Fuseki), avec un repli sur des listes statiques.
 2. Masquage : les entités de la question sont remplacées par "ENT" (et les nombres par "NUM"),
    pour comparer la *forme* de la question et non les noms propres.
 3. spaCy : lemmatisation des mots restants.
 4. Score : similarité de Dice avec les exemples de chaque intention, plus un petit bonus pour les
    mots-clés, plus des contraintes d'entités (une intention "médicaments de Sami" exige un nom).
 5. Une question identique à un exemple est reconnue directement (confiance 100 %).
"""
import logging
import re
import time
import unicodedata
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

import spacy
from spacy.language import Language

import fuseki_client as fc

log = logging.getLogger("nlp_engine")

# =====================================================================
# spaCy
# =====================================================================
_nlp: Optional[Language] = None
MODELE_COMPLET = False


def get_nlp() -> Language:
    global _nlp, MODELE_COMPLET
    if _nlp is None:
        for nom in ("fr_core_news_md", "fr_core_news_sm"):
            try:
                _nlp = spacy.load(nom)
                MODELE_COMPLET = True
                log.info("Modèle spaCy chargé : %s", nom)
                break
            except Exception:
                continue
        if _nlp is None:
            log.warning(
                "AUCUN modèle spaCy français installé : lancez "
                "`python -m spacy download fr_core_news_md`. Mode dégradé (sans lemmes)."
            )
            _nlp = spacy.blank("fr")
    return _nlp


# =====================================================================
# Normalisation
# =====================================================================
def _sans_accents(texte: str) -> str:
    """Minuscules + suppression des accents, un caractère pour un caractère (positions conservées)."""
    sortie = []
    for ch in texte:
        d = unicodedata.normalize("NFD", ch.lower())
        base = "".join(c for c in d if not unicodedata.combining(c))
        sortie.append(base[:1] if base else " ")
    return "".join(sortie)


def _norm_aligne(texte: str) -> str:
    """Même longueur que `texte` : minuscules, sans accents, ponctuation remplacée par des espaces."""
    return re.sub(r"[^a-z0-9]", " ", _sans_accents(texte))


def normaliser_texte(texte: str) -> str:
    """Minuscules, sans accents, sans ponctuation (apostrophes et tirets deviennent des espaces)."""
    return re.sub(r"\s+", " ", _norm_aligne(texte)).strip()


def _racine(mot: str) -> str:
    return mot[:-1] if len(mot) > 3 and mot[-1] in "sx" else mot


# Mots purement grammaticaux. "sur", "sans", "avec", "par", "plus"... restent volontairement
# des mots utiles : ils distinguent "sur ordonnance" de "sans ordonnance".
STOP = {
    "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "et", "ou", "en",
    "qui", "que", "qu", "quoi", "quel", "quels", "quelle", "quelles", "est", "sont", "etre", "avoir",
    "ce", "c", "ca", "cela", "il", "elle", "ils", "elles", "y", "a", "t", "on", "se", "s", "me", "moi",
    "te", "toi", "vous", "nous", "je", "tu", "ne", "n", "mon", "ma", "mes", "son", "sa", "ses",
    "donner", "donne", "afficher", "affiche", "montrer", "montre", "lister", "liste", "voir", "dire",
    "peut", "pouvoir", "faire", "fait",
}


# =====================================================================
# Intentions
# =====================================================================
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


REGISTRE_INTENTIONS: Dict[str, Intention] = {}


def enregistrer_intention(intention: Intention):
    REGISTRE_INTENTIONS[intention.id] = intention


# Entités obligatoires par intention. Chaque tuple = "au moins une de ces entités".
# Sans l'entité, l'intention est pénalisée : "Médicaments produits par Pfizer" ne peut plus
# être pris pour "Médicaments de <patient>".
ENTITES_REQUISES: Dict[str, List[Tuple[str, ...]]] = {
    "medicaments_par_molecule": [("molecule",)],
    "medicaments_fabricant": [("medicament", "molecule")],
    "medicaments_forme_voie": [("medicament", "molecule")],
    "medicaments_fiche_composition": [("medicament", "molecule")],
    "medicaments_par_laboratoire": [("laboratoire",)],
    "medicaments_patient": [("nom",)],
    "pathologies_patient": [("nom",)],
    "medecin_patient": [("nom",)],
    "verifier_polymedique_ask": [("nom",)],
    "patients_par_medicament": [("medicament", "molecule")],
}


# =====================================================================
# Lexique (noms réels lus dans l'ontologie)
# =====================================================================
MOLECULES_CONNUES = [
    "paracetamol", "amoxicilline", "ibuprofene", "metformine",
    "warfarine", "aspirine", "omeprazole", "ciprofloxacine",
    "acide acetylsalicylique", "penicilline",
]
LABORATOIRES_CONNUS = [
    "sanofi", "pfizer", "saiph", "unimed", "bayer", "gsk",
    "glaxosmithkline", "opalia", "recordati",
]
# marque commerciale -> molécule
MARQUES = {
    "clamoxyl": "amoxicilline", "advil": "ibuprofene", "glucophage": "metformine",
    "coumadine": "warfarine", "doliprane": "paracetamol", "mopral": "omeprazole",
    "ciflox": "ciprofloxacine",
}
# prénoms utilisés dans les exemples des intentions (pour que le masquage fonctionne même sans Fuseki)
NOMS_EXEMPLES = ["sami", "leila", "hedi", "ben salah"]
FORMES_CONNUES = [
    "comprime", "gelule", "sirop", "injectable", "solution injectable",
    "pommade", "sachet", "suspension",
]

_UNITES = {"mg", "g", "ml", "mcg", "ui", "l"}
_GENERIQUES = {"comprime", "gelule", "sirop", "forte", "adulte", "enfant", "pediatrique",
               "injectable", "solution", "pommade", "sachet", "suspension", "generique"}

REQ_LEXIQUE = """PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?type ?val ?mol WHERE {
  { ?x a/rdfs:subClassOf* :Patient ; :nom ?val . BIND("patient" AS ?type) }
  UNION { ?x a/rdfs:subClassOf* :Patient ; :prenom ?val . BIND("patient" AS ?type) }
  UNION { ?x a/rdfs:subClassOf* :Medicament ; :nomCommercial ?val . BIND("medicament" AS ?type)
          OPTIONAL { ?x (:contientMolecule|:contientPrincipeActif)/:nom ?mol } }
  UNION { ?x (:contientMolecule|:contientPrincipeActif)/:nom ?val . BIND("molecule" AS ?type) }
  UNION { ?x :estFabriquePar ?l . ?l :nom ?val . BIND("laboratoire" AS ?type) }
}"""


def _mots_medicament(nom: str) -> Tuple[str, Set[str]]:
    """'Ibuprofene 400' -> ('ibuprofene', {'ibuprofene'}) ; retire les dosages et mots génériques."""
    mots = [m for m in normaliser_texte(nom).split() if not m.isdigit() and m not in _UNITES]
    cle = " ".join(mots)
    simples = {m for m in mots if len(m) >= 5 and m not in _GENERIQUES}
    return cle, simples


class Lexique:
    def __init__(self) -> None:
        self.patients: Set[str] = set(NOMS_EXEMPLES)
        self.medicaments: Set[str] = set(MARQUES)
        self.molecules: Set[str] = set(MOLECULES_CONNUES)
        self.laboratoires: Set[str] = set(LABORATOIRES_CONNUS)
        self.mol_vers_meds: Dict[str, Set[str]] = {}
        self.source = "statique"
        self.version = 0
        self.prochain_essai = 0.0
        self._re_masque: Optional[re.Pattern] = None

    def charger_depuis_fuseki(self) -> None:
        lignes = fc.select(REQ_LEXIQUE)
        for r in lignes:
            t, val = r.get("type"), str(r.get("val") or "").strip()
            if not t or not val:
                continue
            if t == "patient":
                n = normaliser_texte(val)
                if len(n) >= 3:
                    self.patients.add(n)
            elif t == "medicament":
                cle, simples = _mots_medicament(val)
                for k in ({cle} | simples):
                    if len(k) >= 3:
                        self.medicaments.add(k)
                mol = normaliser_texte(str(r.get("mol") or ""))
                if mol:
                    self.mol_vers_meds.setdefault(mol, set()).update({cle} | simples)
            elif t == "molecule":
                n = normaliser_texte(val)
                if len(n) >= 3:
                    self.molecules.add(n)
            elif t == "laboratoire":
                n = normaliser_texte(val)
                if len(n) >= 3:
                    self.laboratoires.add(n)
        self.source = "ontologie"
        self.version += 1
        self._re_masque = None

    def tous_les_termes(self) -> Set[str]:
        return (self.patients | self.medicaments | self.molecules | self.laboratoires) - {""}

    def regex_masque(self) -> Optional[re.Pattern]:
        if self._re_masque is None:
            termes = sorted((t for t in self.tous_les_termes() if len(t) >= 3), key=len, reverse=True)
            if termes:
                alt = "|".join(re.escape(t).replace(r"\ ", r"\s+") for t in termes)
                self._re_masque = re.compile(r"(?<![a-z0-9])(?:%s)(?:s|x)?(?![a-z0-9])" % alt)
        return self._re_masque


_lexique: Optional[Lexique] = None
_TTL_LEXIQUE = 300.0


def get_lexique(forcer: bool = False) -> Lexique:
    """Lexique mis en cache 5 minutes ; si Fuseki est injoignable, on garde les listes statiques."""
    global _lexique
    if _lexique is None:
        _lexique = Lexique()
    maintenant = time.time()
    if forcer or maintenant >= _lexique.prochain_essai:
        try:
            _lexique.charger_depuis_fuseki()
            _lexique.prochain_essai = maintenant + _TTL_LEXIQUE
        except Exception as e:  # Fuseki arrêté, requête refusée...
            log.warning("Lexique : lecture de l'ontologie impossible (%s) ; listes statiques utilisées.", e)
            _lexique.prochain_essai = maintenant + 30.0
    return _lexique


def recharger_lexique() -> Lexique:
    return get_lexique(forcer=True)


# =====================================================================
# Masquage des entités
# =====================================================================
_RE_MAJ = re.compile(r"\b[A-ZÀ-Ý][a-zà-ÿ]{2,}(?:\s+[A-ZÀ-Ý][a-zà-ÿ]{2,})*\b")


def _majuscules_milieu(texte: str) -> List[Tuple[int, int, str]]:
    """Mots capitalisés qui ne sont pas en début de phrase (noms propres)."""
    trouves = []
    for m in _RE_MAJ.finditer(texte):
        avant = texte[:m.start()].rstrip()
        if not avant or avant[-1] in ".?!":
            # début de phrase : on ignore le premier mot, on garde les suivants
            premier = m.group(0).split()
            if len(premier) == 1:
                continue
            suite = m.group(0).split(None, 1)[1]
            trouves.append((m.end() - len(suite), m.end(), suite))
            continue
        trouves.append((m.start(), m.end(), m.group(0)))
    return trouves


def masquer(texte: str, lex: Lexique) -> str:
    norm = _norm_aligne(texte)
    spans: List[Tuple[int, int]] = []
    rx = lex.regex_masque()
    if rx:
        spans += [(m.start(), m.end()) for m in rx.finditer(norm)]
    spans += [(a, b) for a, b, _ in _majuscules_milieu(texte)]
    spans.sort()
    fusion: List[List[int]] = []
    for a, b in spans:
        if fusion and a <= fusion[-1][1]:
            fusion[-1][1] = max(fusion[-1][1], b)
        else:
            fusion.append([a, b])
    sortie, curseur = [], 0
    for a, b in fusion:
        sortie.append(texte[curseur:a])
        sortie.append("ENT")
        curseur = b
    sortie.append(texte[curseur:])
    masque = "".join(sortie)
    masque = re.sub(r"\bENT(?:\s+ENT\b)+", "ENT", masque)
    return re.sub(r"\d+(?:[.,]\d+)?", "NUM", masque)


def _tokens(doc) -> Set[str]:
    sortie: Set[str] = set()
    for t in doc:
        if t.is_punct or t.is_space:
            continue
        for mot in normaliser_texte(t.lemma_ or t.text).split():
            mot = _racine(mot)
            if mot and mot not in STOP:
                sortie.add(mot)
    return sortie


def _dice(a: Set[str], b: Set[str]) -> float:
    return 2 * len(a & b) / (len(a) + len(b)) if a and b else 0.0


# =====================================================================
# Extraction d'entités
# =====================================================================
MOTS_BANNIS = {
    "patient", "patients", "medicament", "medicaments", "docteur", "medecin", "dr", "pathologie",
    "maladie", "forme", "voie", "ordonnance", "quels", "quel", "quelle", "quelles", "combien",
    "comment", "est", "qui", "que", "donne", "liste", "afficher",
}
_CLES_TEXTE = ("molecule", "medicament", "laboratoire", "nom")


def _trouver(termes: Set[str], qn: str) -> List[str]:
    """Termes du lexique présents dans la question normalisée (mots entiers, pluriel toléré)."""
    out = []
    for t in sorted(termes, key=len, reverse=True):
        if len(t) >= 3 and t in qn and re.search(r"(?<![a-z0-9])%s(?:s|x)?(?![a-z0-9])" % re.escape(t), qn):
            out.append(t)
    return out


def extraire_entites(doc, question: str) -> Dict[str, Any]:
    """Entités "canoniques" (valeurs sans accent ; plusieurs alternatives séparées par '|')."""
    lex = get_lexique()
    qn = normaliser_texte(question)
    qlow = question.lower()
    ent: Dict[str, Any] = {}

    # Âge : seulement un nombre suivi de "an(s)" ou introduit par "âge"
    m = re.search(r"\b(\d{1,3})\s*ans?\b", qn) or re.search(r"\bage\b\D{0,20}?(\d{1,3})\b", qn)
    if m:
        ent["age"] = int(m.group(1))

    # Dosage : "500 mg" ou "dosage/dose ... 500"
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:mg|milligrammes?)\b", qlow) or \
        re.search(r"\b(?:dosage|dose|doses|dosee?s?)\b\D{0,25}?(\d+(?:[.,]\d+)?)", qlow)
    if m:
        ent["dosage"] = float(m.group(1).replace(",", "."))

    # Molécules, marques, médicaments, laboratoires
    mols = set(_trouver(lex.molecules, qn))
    marques = [k for k in _trouver(set(MARQUES), qn)]
    for marque in marques:
        mols.add(MARQUES[marque])
    meds = set(_trouver(lex.medicaments, qn)) | set(marques)
    for mol in list(mols):
        meds.add(mol)
        meds |= lex.mol_vers_meds.get(mol, set())
    labs = _trouver(lex.laboratoires, qn)
    formes = _trouver(set(FORMES_CONNUES), qn)
    if mols:
        ent["molecule"] = "|".join(sorted(mols))
    if meds:
        ent["medicament"] = "|".join(sorted(meds))
    if labs:
        ent["laboratoire"] = labs[0]
    if formes:
        ent["forme"] = formes[0]

    # Patient : lexique d'abord, puis nom propre inconnu en majuscule, puis NER spaCy (PER)
    connus_autres = lex.molecules | lex.medicaments | lex.laboratoires | set(MARQUES)
    pats = [p for p in _trouver(lex.patients, qn) if p not in connus_autres]
    if pats:
        ent["nom"] = pats[0]
    else:
        for _, _, texte in _majuscules_milieu(question):
            n = normaliser_texte(texte)
            if n and n not in MOTS_BANNIS and not _trouver(connus_autres, n):
                ent["nom"] = n
                break
        if "nom" not in ent and doc is not None and getattr(doc, "ents", None):
            for e in doc.ents:
                n = normaliser_texte(e.text)
                if e.label_ == "PER" and n and n not in MOTS_BANNIS and not _trouver(connus_autres, n):
                    ent["nom"] = n
                    break
    return ent


# Accents : "paracetamol" doit aussi trouver "Paracétamol" dans l'ontologie
_CLASSES = {
    "a": "[aàâäÀÂÄ]", "e": "[eéèêëÉÈÊË]", "i": "[iîïÎÏ]",
    "o": "[oôöÔÖ]", "u": "[uùûüÙÛÜ]", "c": "[cçÇ]",
}


def _regex_accents(valeur: str) -> str:
    return "|".join("".join(_CLASSES.get(c, c) for c in alt) for alt in valeur.split("|"))


def _vers_sparql(ent: Dict[str, Any]) -> Dict[str, Any]:
    return {k: (_regex_accents(v) if k in _CLES_TEXTE and isinstance(v, str) else v) for k, v in ent.items()}


def _vers_affichage(ent: Dict[str, Any]) -> Dict[str, Any]:
    return {k: (v.replace("|", " ou ") if isinstance(v, str) else v) for k, v in ent.items()}


def assainir_sparql(sparql: str) -> str:
    """re.escape() produit "\\ " ou "\\-", invalides dans une chaîne SPARQL : on retire ces antislashs."""
    return re.sub(r"\\(?![tbnrf\\\"'])(.)", r"\1", sparql)


# =====================================================================
# Détection d'intention
# =====================================================================
_cache_exemples: Dict[str, Any] = {"cle": None, "donnees": {}}


def _exemples_tokens(lex: Lexique) -> Dict[str, List[Tuple[str, Set[str]]]]:
    cle = (lex.version, sum(len(i.exemples) for i in REGISTRE_INTENTIONS.values()), len(REGISTRE_INTENTIONS))
    if _cache_exemples["cle"] != cle:
        nlp = get_nlp()
        donnees: Dict[str, List[Tuple[str, Set[str]]]] = {}
        for i in REGISTRE_INTENTIONS.values():
            docs = list(nlp.pipe([masquer(e, lex) for e in i.exemples]))
            donnees[i.id] = [(normaliser_texte(e), _tokens(d)) for e, d in zip(i.exemples, docs)]
        _cache_exemples["cle"], _cache_exemples["donnees"] = cle, donnees
    return _cache_exemples["donnees"]


def _mots_cles_trouves(intention: Intention, qn: str) -> int:
    trouves = set()
    for kw in intention.mots_cles:
        motifs = [re.escape(w) + (r"\w{0,2}" if len(w) >= 4 else "") for w in kw.split()]
        if re.search(r"(?<![a-z0-9])" + r"\s+".join(motifs) + r"(?![a-z0-9])", qn):
            trouves.add(" ".join(_racine(w) for w in kw.split()))
    return len(trouves)


def classer(question: str) -> Dict[str, Any]:
    """Classe la question : meilleure intention, confiance, entités et interprétations alternatives."""
    lex = get_lexique()
    nlp = get_nlp()
    doc_brut = nlp(question)
    canon = extraire_entites(doc_brut, question)
    tokens_q = _tokens(nlp(masquer(question, lex)))
    qn = normaliser_texte(question)
    exemples = _exemples_tokens(lex)

    scores: List[Tuple[float, Intention]] = []
    for i in REGISTRE_INTENTIONS.values():
        lignes = exemples.get(i.id, [])
        if any(qn == texte for texte, _ in lignes):
            scores.append((1.0, i))
            continue
        dice = max((_dice(tokens_q, toks) for _, toks in lignes), default=0.0)
        score = 0.85 * dice + 0.05 * min(2, _mots_cles_trouves(i, qn))
        for groupe in ENTITES_REQUISES.get(i.id, []):
            score += 0.05 if any(k in canon for k in groupe) else -0.25
        scores.append((max(0.0, min(1.0, score)), i))
    scores.sort(key=lambda x: (-x[0], x[1].id))

    meilleur_score, meilleure = scores[0] if scores else (0.0, None)
    alternatives = [
        {"intention": i.id, "description": i.description, "confiance": round(s, 3)}
        for s, i in scores[1:4] if s >= 0.35 and meilleur_score - s <= 0.15
    ]
    return {
        "intention": meilleure,
        "confiance": round(meilleur_score, 3),
        "entites": canon,
        "alternatives": alternatives,
        "ambigu": bool(alternatives) and meilleur_score - scores[1][0] < 0.05 and meilleur_score < 1.0,
    }


def detecter_intention(question: str) -> Tuple[Optional[Intention], float, Dict[str, Any]]:
    r = classer(question)
    return r["intention"], r["confiance"], _vers_affichage(r["entites"])


# =====================================================================
# Pipeline complet
# =====================================================================
SUGGESTIONS = [
    "Quels médicaments contiennent du paracétamol ?",
    "Qui fabrique la Metformine ?",
    "Quelle est la forme de l'Aspirine ?",
    "Quels médicaments ont une contre-indication absolue ?",
    "Quels médicaments sont sur ordonnance ?",
    "Quels patients sont polymédiqués ?",
    "De quoi souffre Sami ?",
    "Quels médicaments prend Sami ?",
]


def executer_nlp(question: str) -> Dict[str, Any]:
    """Chaîne complète : NLP -> SPARQL -> Fuseki -> synthèse de réponse."""
    if not question or not question.strip():
        return {"question": "", "succes": False, "erreur": "Veuillez poser une question en français."}

    r = classer(question)
    intention, confiance, canon = r["intention"], r["confiance"], r["entites"]
    entites = _vers_affichage(canon)

    if not intention or confiance < 0.35:
        return {
            "question": question,
            "succes": False,
            "confiance": confiance,
            "entites": entites,
            "erreur": (
                "Je n'ai pas pu identifier l'intention de votre question avec une certitude suffisante. "
                "Essayez par exemple : 'Quels médicaments contiennent du paracétamol ?', "
                "'Qui fabrique la Metformine ?' ou 'Quels médicaments ont une contre-indication absolue ?'."
            ),
            "suggestions": SUGGESTIONS,
        }

    type_requete, sparql = intention.generateur_sparql(_vers_sparql(canon))
    sparql = assainir_sparql(sparql)

    base = {
        "question": question,
        "intention": intention.id,
        "domaine": intention.domaine,
        "description_intention": intention.description,
        "confiance": confiance,
        "entites": entites,
        "alternatives": r["alternatives"],
        "ambigu": r["ambigu"],
        "sparql": sparql,
    }
    try:
        if type_requete == "ASK":
            res_bool = fc.ask(sparql)
            resultat: Any = {"reponse_booleenne": res_bool}
            if intention.synthetiseur_reponse:
                texte = intention.synthetiseur_reponse([resultat], entites)
            else:
                texte = "Oui (Vrai)" if res_bool else "Non (Faux)"
        else:
            lignes = fc.select(sparql)
            resultat = lignes
            if intention.synthetiseur_reponse:
                texte = intention.synthetiseur_reponse(lignes, entites)
            else:
                texte = f"{len(lignes)} résultat(s) trouvé(s) dans l'ontologie."
    except Exception as e:
        return {**base, "succes": False, "erreur": f"Erreur lors de l'exécution SPARQL sur Fuseki : {e}"}

    return {**base, "succes": True, "type_requete": type_requete, "reponse_texte": texte, "donnees": resultat}