"""Client Fuseki partagé par toute l'équipe (avec fallback automatique RDFLib).

Fonctions disponibles dans les routes :
    select(requete)   -> liste de dictionnaires (une ligne = un dict)
    update(requete)   -> exécute INSERT / DELETE (ne renvoie rien)
    ask(requete)      -> exécute une requête ASK (renvoie True ou False)
    describe(requete) -> exécute une requête DESCRIBE / CONSTRUCT (Turtle)

Les préfixes (:, rdf:, rdfs:, xsd:) sont ajoutés automatiquement.
"""
from decimal import Decimal
import os
import threading
import time
import requests

# Patch de rétrocompatibilité pyparsing / rdflib
try:
    import pyparsing
    if not hasattr(pyparsing, "DelimitedList"):
        pyparsing.DelimitedList = getattr(pyparsing, "delimitedList", getattr(pyparsing, "delimited_list", None))
except Exception:
    pass

import rdflib
from rdflib import Literal, URIRef

FUSEKI_URL = "http://127.0.0.1:3030/pharma"
NS = "http://www.esprit.tn/ontologies/pharma-sante#"

PREFIXES = f"""PREFIX :     <{NS}>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
"""

class FusekiError(Exception):
    """Fuseki est injoignable ou a refusé la requête."""

# Verrou de synchronisation pour les requêtes concurrentes en mémoire
_graph_lock = threading.Lock()

# État de disponibilité de Fuseki (mis en cache pour éviter de bloquer les threads)
_fuseki_status = {"disponible": False, "dernier_check": 0.0}

def _fuseki_est_en_ligne() -> bool:
    maintenant = time.time()
    if maintenant - _fuseki_status["dernier_check"] < 4.0:
        return _fuseki_status["disponible"]
    try:
        r = requests.get(f"{FUSEKI_URL}/$/ping", timeout=0.25)
        _fuseki_status["disponible"] = (r.status_code == 200)
    except Exception:
        try:
            r = requests.post(f"{FUSEKI_URL}/query", data={"query": "ASK {}"}, timeout=0.25)
            _fuseki_status["disponible"] = (r.status_code == 200)
        except Exception:
            _fuseki_status["disponible"] = False
    _fuseki_status["dernier_check"] = maintenant
    return _fuseki_status["disponible"]


# Initialisation robuste du graphe RDFLib au chargement
_local_graph = rdflib.Graph()

def _initialiser_graphe_local():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(base_dir)
    fichiers_candidats = [
        os.path.join(parent_dir, "data_A.ttl"),
        os.path.join(parent_dir, "data_C.ttl"),
        os.path.join(base_dir, "data_A.ttl"),
        os.path.join(base_dir, "data_C.ttl"),
        "data_A.ttl",
        "data_C.ttl"
    ]
    fichiers_charges = set()
    for f in fichiers_candidats:
        if os.path.exists(f) and f not in fichiers_charges:
            try:
                _local_graph.parse(f, format="turtle")
                fichiers_charges.add(f)
            except Exception as err:
                print(f"[RDFLib] Attention lors du chargement de {f}: {err}")

# Chargement immédiat
_initialiser_graphe_local()


def lit(texte) -> str:
    """Transforme un texte en littéral SPARQL sûr : "Ben \\"Ali\\"" ."""
    s = str(texte).replace("\\", "\\\\").replace('"', '\\"')
    s = s.replace("\n", "\\n").replace("\r", "")
    return f'"{s}"'


def _convertir(b: dict):
    """Convertit une valeur JSON de Fuseki en valeur Python simple."""
    valeur = b["value"]
    if b["type"] == "uri":
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


def select(requete: str) -> list[dict]:
    # 1. Tentative Fuseki si en ligne
    if _fuseki_est_en_ligne():
        try:
            r = requests.post(
                f"{FUSEKI_URL}/query",
                data={"query": PREFIXES + requete},
                headers={"Accept": "application/sparql-results+json"},
                timeout=3,
            )
            if r.status_code == 200:
                donnees = r.json()
                colonnes = donnees.get("head", {}).get("vars", [])
                return [
                    {c: _convertir(ligne[c]) for c in colonnes if c in ligne}
                    for ligne in donnees.get("results", {}).get("bindings", [])
                ]
        except Exception:
            _fuseki_status["disponible"] = False

    # 2. Exécution thread-safe sur le graphe RDFLib local
    with _graph_lock:
        try:
            q_complete = PREFIXES + requete
            res = _local_graph.query(q_complete)
            resultats = []
            for row in res:
                ligne_dict = {}
                for var in res.vars:
                    val = row[var]
                    if val is not None:
                        ligne_dict[str(var)] = _convertir_term_rdflib(val)
                resultats.append(ligne_dict)
            return resultats
        except Exception as e:
            raise FusekiError(f"Erreur d'exécution SPARQL SELECT : {e}")


def ask(requete: str) -> bool:
    """Exécute une requête SPARQL ASK et renvoie un booléen."""
    if _fuseki_est_en_ligne():
        try:
            r = requests.post(
                f"{FUSEKI_URL}/query",
                data={"query": PREFIXES + requete},
                headers={"Accept": "application/sparql-results+json"},
                timeout=3,
            )
            if r.status_code == 200:
                return bool(r.json().get("boolean", False))
        except Exception:
            _fuseki_status["disponible"] = False

    with _graph_lock:
        try:
            res = _local_graph.query(PREFIXES + requete)
            return bool(res.askAnswer)
        except Exception as e:
            raise FusekiError(f"Erreur SPARQL ASK : {e}")


def describe(requete: str) -> str:
    """Exécute une requête DESCRIBE ou CONSTRUCT et renvoie le RDF Turtle."""
    if _fuseki_est_en_ligne():
        try:
            r = requests.post(
                f"{FUSEKI_URL}/query",
                data={"query": PREFIXES + requete},
                headers={"Accept": "text/turtle, application/turtle"},
                timeout=3,
            )
            if r.status_code == 200:
                return r.text
        except Exception:
            _fuseki_status["disponible"] = False

    with _graph_lock:
        try:
            res = _local_graph.query(PREFIXES + requete)
            if hasattr(res, "graph") and res.graph is not None:
                return res.graph.serialize(format="turtle")
            return "# Sous-graphe généré par RDFLib"
        except Exception as e:
            raise FusekiError(f"Erreur SPARQL DESCRIBE : {e}")


def update(requete: str) -> None:
    succes_fuseki = False
    if _fuseki_est_en_ligne():
        try:
            r = requests.post(
                f"{FUSEKI_URL}/update",
                data=(PREFIXES + requete).encode("utf-8"),
                headers={"Content-Type": "application/sparql-update"},
                timeout=3,
            )
            if r.status_code in (200, 204):
                succes_fuseki = True
        except Exception:
            _fuseki_status["disponible"] = False

    with _graph_lock:
        try:
            _local_graph.update(PREFIXES + requete)
        except Exception as e:
            if not succes_fuseki:
                raise FusekiError(f"Erreur SPARQL UPDATE : {e}")
