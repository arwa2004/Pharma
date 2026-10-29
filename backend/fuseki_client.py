"""Client Fuseki partagé par toute l'équipe.

Fonctions disponibles dans les routes :
    select(requete)   -> liste de dictionnaires (une ligne = un dict)
    update(requete)   -> exécute INSERT / DELETE (ne renvoie rien)
    ask(requete)      -> exécute une requête ASK (renvoie True ou False)
    describe(requete) -> exécute une requête DESCRIBE / CONSTRUCT (Turtle)

Les préfixes (:, rdf:, rdfs:, xsd:) sont ajoutés automatiquement.
"""
import requests

FUSEKI_URL = "http://127.0.0.1:3030/pharma"
NS = "http://www.esprit.tn/ontologies/pharma-sante#"

PREFIXES = f"""PREFIX :     <{NS}>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
"""


class FusekiError(Exception):
    """Fuseki est injoignable ou a refusé la requête."""


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


def select(requete: str) -> list[dict]:
    try:
        r = requests.post(
            f"{FUSEKI_URL}/query",
            data={"query": PREFIXES + requete},
            headers={"Accept": "application/sparql-results+json"},
            timeout=10,
        )
    except requests.RequestException as e:
        raise FusekiError(f"Fuseki injoignable ({FUSEKI_URL}) : {e}")
    if r.status_code != 200:
        raise FusekiError(f"Erreur Fuseki {r.status_code} : {r.text[:300]}")
    donnees = r.json()
    colonnes = donnees.get("head", {}).get("vars", [])
    return [
        {c: _convertir(ligne[c]) for c in colonnes if c in ligne}
        for ligne in donnees.get("results", {}).get("bindings", [])
    ]


def ask(requete: str) -> bool:
    """Exécute une requête SPARQL ASK et renvoie un booléen."""
    try:
        r = requests.post(
            f"{FUSEKI_URL}/query",
            data={"query": PREFIXES + requete},
            headers={"Accept": "application/sparql-results+json"},
            timeout=10,
        )
    except requests.RequestException as e:
        raise FusekiError(f"Fuseki injoignable ({FUSEKI_URL}) : {e}")
    if r.status_code != 200:
        raise FusekiError(f"Erreur Fuseki {r.status_code} : {r.text[:300]}")
    return bool(r.json().get("boolean", False))


def describe(requete: str) -> str:
    """Exécute une requête DESCRIBE ou CONSTRUCT et renvoie le RDF Turtle."""
    try:
        r = requests.post(
            f"{FUSEKI_URL}/query",
            data={"query": PREFIXES + requete},
            headers={"Accept": "text/turtle, application/turtle"},
            timeout=10,
        )
    except requests.RequestException as e:
        raise FusekiError(f"Fuseki injoignable ({FUSEKI_URL}) : {e}")
    if r.status_code != 200:
        raise FusekiError(f"Erreur Fuseki {r.status_code} : {r.text[:300]}")
    return r.text


def update(requete: str) -> None:
    try:
        r = requests.post(
            f"{FUSEKI_URL}/update",
            data=(PREFIXES + requete).encode("utf-8"),
            headers={"Content-Type": "application/sparql-update"},
            timeout=10,
        )
    except requests.RequestException as e:
        raise FusekiError(f"Fuseki injoignable ({FUSEKI_URL}) : {e}")
    if r.status_code not in (200, 204):
        raise FusekiError(f"Erreur Fuseki {r.status_code} : {r.text[:300]}")
