from decimal import Decimal
import glob
import os
import threading
import time
import requests

try:
    import pyparsing
    if not hasattr(pyparsing, "DelimitedList"):
        pyparsing.DelimitedList = getattr(
            pyparsing, "delimitedList", getattr(pyparsing, "delimited_list", None)
        )
except Exception:
    pass

import rdflib
from rdflib import Literal, URIRef

FUSEKI_URL = os.environ.get("FUSEKI_URL", "http://127.0.0.1:3030/pharma")
NS = "http://www.esprit.tn/ontologies/pharma-sante#"
TIMEOUT = 10  # secondes (requêtes réelles)

PREFIXES = f"""PREFIX :     <{NS}>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
"""


class FusekiError(Exception):
    """Fuseki est injoignable ou a refusé la requête."""


# ---------------------------------------------------------------------------
# Disponibilité de Fuseki (mise en cache quelques secondes)
# ---------------------------------------------------------------------------
_fuseki_status = {"disponible": False, "dernier_check": 0.0}


def _fuseki_est_en_ligne() -> bool:
    maintenant = time.time()
    if maintenant - _fuseki_status["dernier_check"] < 4.0:
        return _fuseki_status["disponible"]
    try:
        r = requests.post(
            f"{FUSEKI_URL}/query",
            data={"query": "ASK {}"},
            headers={"Accept": "application/sparql-results+json"},
            timeout=2,  # assez large pour éviter les faux "hors ligne"
        )
        _fuseki_status["disponible"] = (r.status_code == 200)
    except requests.RequestException:
        _fuseki_status["disponible"] = False
    _fuseki_status["dernier_check"] = maintenant
    return _fuseki_status["disponible"]


def _marquer_hors_ligne():
    _fuseki_status["disponible"] = False
    _fuseki_status["dernier_check"] = time.time()


# ---------------------------------------------------------------------------
# Graphe local RDFLib (fallback uniquement)
# ---------------------------------------------------------------------------
_graph_lock = threading.Lock()
_local_graph = rdflib.Graph()


def _initialiser_graphe_local():
    # FIX: Added double underscores to __file__
    # FIX: Corrected the indentation on the first line
    base_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(base_dir)
    fichiers = set()
    for dossier in (parent_dir, base_dir, os.getcwd()):
        fichiers.update(glob.glob(os.path.join(dossier, "*.ttl")))
    for f in sorted(fichiers):
        try:
            _local_graph.parse(f, format="turtle")
        except Exception as err:
            print(f"[RDFLib] Attention lors du chargement de {f}: {err}")


_initialiser_graphe_local()


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------
def lit(texte) -> str:
    """Transforme un texte en littéral SPARQL sûr : "Ben \\"Ali\\"" ."""
    s = str(texte).replace("\\", "\\\\").replace('"', '\\"')
    s = s.replace("\n", "\\n").replace("\r", "")
    return f'"{s}"'


def _convertir(b: dict):
    """Convertit une valeur JSON de Fuseki en valeur Python simple."""
    valeur = b["value"]
    if b["type"] == "uri":
        # <http://...pharma-sante#Pat_Sami>  ->  "Pat_Sami"
        return valeur.split("#", 1)[1] if valeur.startswith(NS) else valeur
    datatype = b.get("datatype", "")
    if datatype.endswith(("#integer", "#int", "#long")):
        return int(valeur)
    if datatype.endswith(("#decimal", "#double", "#float")):
        return float(valeur)
    if datatype.endswith("#boolean"):
        return valeur == "true"
    return valeur


def _convertir_term_rdflib(term):
    if term is None:
        return None
    if isinstance(term, URIRef):
        s = str(term)
        return s.split("#", 1)[1] if s.startswith(NS) else s
    if isinstance(term, Literal):
        v = term.value
        if isinstance(v, Decimal):
            return float(v)
        return v
    return str(term)


def _post_fuseki(endpoint: str, **kwargs):
    """POST vers Fuseki.
    - Fuseki injoignable  -> renvoie None (=> on bascule sur RDFLib)
    - Fuseki répond != 2xx -> lève FusekiError (l'erreur n'est PAS masquée)
    """
    try:
        r = requests.post(f"{FUSEKI_URL}/{endpoint}", timeout=TIMEOUT, **kwargs)
    except requests.RequestException:
        _marquer_hors_ligne()
        return None
    if r.status_code not in (200, 204):
        raise FusekiError(f"Erreur Fuseki {r.status_code} : {r.text[:300]}")
    return r


# ---------------------------------------------------------------------------
# API publique
# ---------------------------------------------------------------------------
def select(requete: str) -> list[dict]:
    if _fuseki_est_en_ligne():
        r = _post_fuseki(
            "query",
            data={"query": PREFIXES + requete},
            headers={"Accept": "application/sparql-results+json"},
        )
        if r is not None:
            donnees = r.json()
            colonnes = donnees.get("head", {}).get("vars", [])
            return [
                {c: _convertir(ligne[c]) for c in colonnes if c in ligne}
                for ligne in donnees.get("results", {}).get("bindings", [])
            ]

    # Fallback : Fuseki injoignable
    with _graph_lock:
        try:
            res = _local_graph.query(PREFIXES + requete)
            resultats = []
            for row in res:
                ligne = {}
                for var in res.vars:
                    val = row[var]
                    if val is not None:
                        ligne[str(var)] = _convertir_term_rdflib(val)
                resultats.append(ligne)
            return resultats
        except Exception as e:
            raise FusekiError(f"Fuseki injoignable et erreur RDFLib SELECT : {e}")


def ask(requete: str) -> bool:
    """Exécute une requête SPARQL ASK et renvoie un booléen."""
    if _fuseki_est_en_ligne():
        r = _post_fuseki(
            "query",
            data={"query": PREFIXES + requete},
            headers={"Accept": "application/sparql-results+json"},
        )
        if r is not None:
            return bool(r.json().get("boolean", False))

    with _graph_lock:
        try:
            return bool(_local_graph.query(PREFIXES + requete).askAnswer)
        except Exception as e:
            raise FusekiError(f"Fuseki injoignable et erreur RDFLib ASK : {e}")


def describe(requete: str) -> str:
    """Exécute une requête DESCRIBE ou CONSTRUCT et renvoie le RDF Turtle."""
    if _fuseki_est_en_ligne():
        r = _post_fuseki(
            "query",
            data={"query": PREFIXES + requete},
            headers={"Accept": "text/turtle, application/turtle"},
        )
        if r is not None:
            return r.text

    with _graph_lock:
        try:
            res = _local_graph.query(PREFIXES + requete)
            if getattr(res, "graph", None) is not None:
                return res.graph.serialize(format="turtle")
            return ""
        except Exception as e:
            raise FusekiError(f"Fuseki injoignable et erreur RDFLib DESCRIBE : {e}")


def update(requete: str) -> None:
    if _fuseki_est_en_ligne():
        r = _post_fuseki(
            "update",
            data=(PREFIXES + requete).encode("utf-8"),
            headers={"Content-Type": "application/sparql-update"},
        )
        if r is not None:
            return  # écrit dans Fuseki : on ne touche pas au graphe local

    # Fallback : Fuseki injoignable, on écrit uniquement en local
    with _graph_lock:
        try:
            _local_graph.update(PREFIXES + requete)
        except Exception as e:
            raise FusekiError(f"Fuseki injoignable et erreur RDFLib UPDATE : {e}")