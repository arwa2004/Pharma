"""Routes du domaine Médicaments et Composition (Membre A).

Gestion complète des médicaments, substances, composition, laboratoires et classifications :
- Lecture & Filtrage :
    GET    /medicaments                              liste avec filtres (q, dosage_min, dosage_max, sur_ordonnance, molecule, forme, voie, classe, laboratoire)
    GET    /medicaments/contre-indication-absolue    classe définie MedicamentAContreIndicationAbsolue
    GET    /medicaments/recherche                    recherche ciblée avancée (nom, molécule, labo)
    GET    /medicaments/{id}                         fiche détaillée complète (infos, composition, excipients, risques, patients)
    GET    /medicaments/{id}/ask-ordonnance          requête ASK (vérifie si soumis à prescription)
    GET    /medicaments/{id}/describe                requête DESCRIBE (graphe RDF Turtle de la ressource)
    
- Référentiels pour l'UI :
    GET    /medicaments/referentiel/molecules        liste des molécules et principes actifs
    GET    /medicaments/referentiel/excipients       liste des excipients
    GET    /medicaments/referentiel/formes           liste des formes galéniques
    GET    /medicaments/referentiel/voies            liste des voies d'administration
    GET    /medicaments/referentiel/classes          liste des classes thérapeutiques
    GET    /medicaments/referentiel/laboratoires     liste des laboratoires

- CRUD Médicaments (Membre A) :
    POST   /medicaments                              création médicament complet
    PUT    /medicaments/{id}                         mise à jour attributs simples et relations principales
    DELETE /medicaments/{id}                         suppression sécurisée avec nettoyage des triplets

- CRUD Laboratoires (Membre A) :
    GET    /medicaments/laboratoires                 liste détaillée des laboratoires avec leurs médicaments
    POST   /medicaments/laboratoires                 création laboratoire
    PUT    /medicaments/laboratoires/{id}            mise à jour laboratoire
    DELETE /medicaments/laboratoires/{id}            suppression laboratoire

- Gestion de la composition (Relations) :
    POST   /medicaments/{id}/molecules/{id_mol}      ajoute une molécule/principe actif
    DELETE /medicaments/{id}/molecules/{id_mol}      retire une molécule
    POST   /medicaments/{id}/excipients/{id_exc}     ajoute un excipient
    DELETE /medicaments/{id}/excipients/{id_exc}     retire un excipient
"""
import re
import unicodedata
from typing import Annotated, Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

import fuseki_client as fc

router = APIRouter(prefix="/medicaments", tags=["Médicaments & Composition"])

IdMedicament = Annotated[str, Path(pattern=r"^[A-Za-z0-9_\-]+$", description="ex: Med_Amoxicilline")]
IdLaboratoire = Annotated[str, Path(pattern=r"^[A-Za-z0-9_\-]+$", description="ex: Lab_Sanofi")]
IdEntite = Annotated[str, Path(pattern=r"^[A-Za-z0-9_\-]+$", description="ex: Mol_Paracetamol")]


# ---------- Modèles Pydantic pour Validation des Données ----------

class MedicamentIn(BaseModel):
    nomCommercial: str = Field(..., min_length=2, description="Nom commercial du médicament")
    codeAMM: Optional[str] = Field(None, description="Code Autorisation de Mise sur le Marché")
    dosageMg: float = Field(..., gt=0, description="Dosage en milligrammes (mg)")
    surOrdonnance: bool = Field(True, description="True si sur ordonnance, False si libre")
    idLaboratoire: Optional[str] = Field(None, description="ID du laboratoire fabricant (ex: Lab_Sanofi)")
    idForme: Optional[str] = Field(None, description="ID de la forme pharmaceutique (ex: Forme_Comprime)")
    idVoie: Optional[str] = Field(None, description="ID de la voie d'administration (ex: Voie_Orale)")
    idClasse: Optional[str] = Field(None, description="ID de la classe thérapeutique (ex: Classe_Antibiotique)")
    molecules: Optional[List[str]] = Field(default_factory=list, description="Liste des IDs de molécules")
    excipients: Optional[List[str]] = Field(default_factory=list, description="Liste des IDs d'excipients")


class MedicamentUpdate(BaseModel):
    nomCommercial: Optional[str] = Field(None, min_length=2)
    codeAMM: Optional[str] = None
    dosageMg: Optional[float] = Field(None, gt=0)
    surOrdonnance: Optional[bool] = None
    idLaboratoire: Optional[str] = None
    idForme: Optional[str] = None
    idVoie: Optional[str] = None
    idClasse: Optional[str] = None


class LaboratoireIn(BaseModel):
    nom: str = Field(..., min_length=2, description="Nom du laboratoire")
    pays: Optional[str] = Field("Tunisie", description="Pays du laboratoire")
    adresse: Optional[str] = Field(None, description="Adresse ou siège")


# ---------- Fonctions Utilitaires ----------

def _reponse(data: Any, sparql: str) -> Dict[str, Any]:
    return {"data": data, "sparql": sparql.strip()}


def _existe_entite(id_entite: str) -> bool:
    lignes = fc.select(f"SELECT ?t WHERE {{ :{id_entite} a ?t }} LIMIT 1")
    return len(lignes) > 0


def _generer_id_medicament(nom: str) -> str:
    """Transforme 'Amoxicilline Clamoxyl' en 'Med_AmoxicillineClamoxyl' unique."""
    ascii_nom = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode()
    base = re.sub(r"[^A-Za-z0-9]", "", ascii_nom.title()) or "Medicament"
    candidat, n = f"Med_{base}", 1
    while _existe_entite(candidat):
        n += 1
        candidat = f"Med_{base}{n}"
    return candidat


def _generer_id_laboratoire(nom: str) -> str:
    ascii_nom = unicodedata.normalize("NFKD", nom).encode("ascii", "ignore").decode()
    base = re.sub(r"[^A-Za-z0-9]", "", ascii_nom.title()) or "Lab"
    candidat, n = f"Lab_{base}", 1
    while _existe_entite(candidat):
        n += 1
        candidat = f"Lab_{base}{n}"
    return candidat


# =================================================================
#            RÉFÉRENTIELS POUR MENUS DÉROULANTS UI
# =================================================================

@router.get("/referentiel/molecules")
def referentiel_molecules():
    """Liste toutes les molécules et principes actifs disponibles."""
    requete = """SELECT DISTINCT ?id ?nom ?formuleChimique WHERE {
  ?m a/rdfs:subClassOf* :Molecule .
  OPTIONAL { ?m :nom ?nom }
  OPTIONAL { ?m :formuleChimique ?formuleChimique }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
} ORDER BY ?nom ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/formes")
def referentiel_formes():
    """Liste toutes les formes pharmaceutiques (galéniques)."""
    requete = """SELECT DISTINCT ?id ?libelle WHERE {
  ?f a/rdfs:subClassOf* :FormePharmaceutique .
  OPTIONAL { ?f :libelle ?libelle }
  BIND(STRAFTER(STR(?f), "#") AS ?id)
} ORDER BY ?libelle ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/voies")
def referentiel_voies():
    """Liste toutes les voies d'administration."""
    requete = """SELECT DISTINCT ?id ?libelle WHERE {
  ?v a/rdfs:subClassOf* :VoieAdministration .
  OPTIONAL { ?v :libelle ?libelle }
  BIND(STRAFTER(STR(?v), "#") AS ?id)
} ORDER BY ?libelle ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/classes")
def referentiel_classes():
    """Liste toutes les classes thérapeutiques et leur éventuelle super-classe."""
    requete = """SELECT DISTINCT ?id ?libelle ?parentLibelle WHERE {
  ?c a/rdfs:subClassOf* :ClasseTherapeutique .
  OPTIONAL { ?c :libelle ?libelle }
  OPTIONAL { 
    ?c :sousClasseTherapeutiqueDe ?parent .
    OPTIONAL { ?parent :libelle ?parentLibelle }
  }
  BIND(STRAFTER(STR(?c), "#") AS ?id)
} ORDER BY ?libelle ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/laboratoires")
def referentiel_laboratoires():
    """Liste simplifiée des laboratoires pour listes de sélection."""
    requete = """SELECT DISTINCT ?id ?nom ?pays WHERE {
  ?lab a/rdfs:subClassOf* :Laboratoire .
  OPTIONAL { ?lab :nom ?nom }
  OPTIONAL { ?lab :pays ?pays }
  BIND(STRAFTER(STR(?lab), "#") AS ?id)
} ORDER BY ?nom ?id"""
    return _reponse(fc.select(requete), requete)


@router.get("/referentiel/excipients")
def referentiel_excipients():
    """Liste tous les excipients répertoriés."""
    requete = """SELECT DISTINCT ?id ?nom ?effetNotoire WHERE {
  ?e a/rdfs:subClassOf* :Excipient .
  OPTIONAL { ?e :nom ?nom }
  OPTIONAL { ?e :effetNotoire ?effetNotoire }
  BIND(STRAFTER(STR(?e), "#") AS ?id)
} ORDER BY ?nom ?id"""
    return _reponse(fc.select(requete), requete)


# =================================================================
#            LECTURE, FILTRAGE & RECHERCHE AVANCÉE
# =================================================================

@router.get("")
def lister_medicaments(
    q: Optional[str] = Query(None, description="Recherche par nom commercial (REGEX insensible à la casse)"),
    dosage_min: Optional[float] = Query(None, ge=0, description="Dosage minimal en mg"),
    dosage_max: Optional[float] = Query(None, ge=0, description="Dosage maximal en mg"),
    sur_ordonnance: Optional[bool] = Query(None, description="Filtrer selon prescription requise"),
    molecule: Optional[str] = Query(None, description="Filtrer par molécule (id)"),
    forme: Optional[str] = Query(None, description="Filtrer par forme pharmaceutique (id)"),
    voie: Optional[str] = Query(None, description="Filtrer par voie d'administration (id)"),
    classe: Optional[str] = Query(None, description="Filtrer par classe thérapeutique (id)"),
    laboratoire: Optional[str] = Query(None, description="Filtrer par laboratoire fabricant (id)"),
):
    """Liste des médicaments avec critères de filtrage combinables."""
    filtres = []

    if q and q.strip():
        # Sécurisation regex SPARQL
        motif = re.escape(q.strip())
        filtres.append(f'REGEX(?nomCommercial, "{motif}", "i")')

    if dosage_min is not None:
        filtres.append(f"?dosageMg >= {float(dosage_min)}")

    if dosage_max is not None:
        filtres.append(f"?dosageMg <= {float(dosage_max)}")

    if sur_ordonnance is not None:
        if sur_ordonnance:
            filtres.append("EXISTS { ?m a/rdfs:subClassOf* :MedicamentSurOrdonnance }")
        else:
            filtres.append("EXISTS { ?m a/rdfs:subClassOf* :MedicamentSansOrdonnance }")

    if molecule and molecule.strip():
        filtres.append(f"EXISTS {{ ?m (:contientMolecule|:contientPrincipeActif) :{molecule.strip()} }}")

    if forme and forme.strip():
        filtres.append(f"EXISTS {{ ?m :aForme :{forme.strip()} }}")

    if voie and voie.strip():
        filtres.append(f"EXISTS {{ ?m :administreParVoie :{voie.strip()} }}")

    if classe and classe.strip():
        # Inclut les sous-classes thérapeutiques par rdfs:subClassOf* ou lien hiérarchique
        filtres.append(f"""EXISTS {{ 
            ?m :appartientAClasse ?cl . 
            ?cl (:sousClasseTherapeutiqueDe|^rdfs:subClassOf)* :{classe.strip()} 
        }}""")

    if laboratoire and laboratoire.strip():
        filtres.append(f"EXISTS {{ ?m :estFabriquePar :{laboratoire.strip()} }}")

    clause_filter = f"\n  FILTER({' && '.join(filtres)})" if filtres else ""

    requete = f"""SELECT DISTINCT ?id ?nomCommercial ?codeAMM ?dosageMg ?typeLibelle ?surOrdonnance
       ?estContreIndicationAbsolue ?nomLabo ?formeLibelle ?voieLibelle ?classeLibelle
WHERE {{
  ?m a/rdfs:subClassOf* :Medicament .
  OPTIONAL {{ ?m :nomCommercial ?nomCommercial }}
  OPTIONAL {{ ?m :codeAMM ?codeAMM }}
  OPTIONAL {{ ?m :dosageMg ?dosageMg }}

  # Distinction type ordonnance
  OPTIONAL {{
    BIND(EXISTS {{ ?m a/rdfs:subClassOf* :MedicamentSurOrdonnance }} AS ?surOrdonnance)
  }}
  BIND(IF(?surOrdonnance, "Sur ordonnance", "Sans ordonnance") AS ?typeLibelle)

  # Détection classe définie / contre-indication absolue
  BIND(
    EXISTS {{ ?m a/rdfs:subClassOf* :MedicamentAContreIndicationAbsolue }} ||
    EXISTS {{ 
      ?m :aContreIndication ?ci . 
      ?ci a/rdfs:subClassOf* :ContreIndicationAbsolue 
    }}
    AS ?estContreIndicationAbsolue
  )

  # Relations
  OPTIONAL {{ ?m :estFabriquePar ?lab . ?lab :nom ?nomLabo }}
  OPTIONAL {{ ?m :aForme ?f . ?f :libelle ?formeLibelle }}
  OPTIONAL {{ ?m :administreParVoie ?v . ?v :libelle ?voieLibelle }}
  OPTIONAL {{ ?m :appartientAClasse ?cl . ?cl :libelle ?classeLibelle }}

  BIND(STRAFTER(STR(?m), "#") AS ?id)
  {clause_filter}
}} ORDER BY ?nomCommercial ?id"""

    lignes = fc.select(requete)
    return _reponse(lignes, requete)


@router.get("/contre-indication-absolue")
def lister_medicaments_contre_indication_absolue():
    """Requête dédiée à la classe définie : Médicaments avec contre-indication absolue.
    
    Conforme à la spécification de la classe définie déduite par le raisonneur HermiT.
    """
    requete = """SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?nomLabo ?contreIndicationLibelle WHERE {
  {
    ?m a/rdfs:subClassOf* :MedicamentAContreIndicationAbsolue .
    OPTIONAL { ?m :nomCommercial ?nomCommercial }
    OPTIONAL { ?m :dosageMg ?dosageMg }
    OPTIONAL { ?m :estFabriquePar ?lab . ?lab :nom ?nomLabo }
    OPTIONAL { ?m :aContreIndication ?ci . ?ci :libelle ?contreIndicationLibelle }
  } UNION {
    ?m a/rdfs:subClassOf* :Medicament ;
       :aContreIndication ?ci .
    ?ci a/rdfs:subClassOf* :ContreIndicationAbsolue .
    OPTIONAL { ?m :nomCommercial ?nomCommercial }
    OPTIONAL { ?m :dosageMg ?dosageMg }
    OPTIONAL { ?m :estFabriquePar ?lab . ?lab :nom ?nomLabo }
    OPTIONAL { ?ci :libelle ?contreIndicationLibelle }
  }
  BIND(STRAFTER(STR(?m), "#") AS ?id)
} ORDER BY ?nomCommercial ?id"""

    lignes = fc.select(requete)
    return _reponse(lignes, requete)


@router.get("/recherche")
def recherche_rapide(q: str = Query(..., min_length=1, description="Terme de recherche")):
    """Recherche plein-texte ciblée (nom commercial, molécule, excipient ou laboratoire)."""
    motif = re.escape(q.strip())
    requete = f"""SELECT DISTINCT ?id ?nomCommercial ?dosageMg ?forme ?laboratoire ?molecule WHERE {{
  ?m a/rdfs:subClassOf* :Medicament .
  OPTIONAL {{ ?m :nomCommercial ?nomCommercial }}
  OPTIONAL {{ ?m :dosageMg ?dosageMg }}
  OPTIONAL {{ ?m :aForme ?f . ?f :libelle ?forme }}
  OPTIONAL {{ ?m :estFabriquePar ?lab . ?lab :nom ?laboratoire }}
  OPTIONAL {{ ?m (:contientMolecule|:contientPrincipeActif) ?mol . ?mol :nom ?molecule }}
  
  FILTER(
    REGEX(?nomCommercial, "{motif}", "i") ||
    REGEX(?laboratoire, "{motif}", "i") ||
    REGEX(?molecule, "{motif}", "i")
  )
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} ORDER BY ?nomCommercial LIMIT 30"""

    lignes = fc.select(requete)
    return _reponse(lignes, requete)


# =================================================================
#            FICHE DÉTAILLÉE DU MÉDICAMENT
# =================================================================

@router.get("/{id}")
def fiche_medicament(id: IdMedicament):
    """Renvoie la fiche complète du médicament avec sa composition et ses relations."""
    requete_base = f"""SELECT ?nomCommercial ?codeAMM ?dosageMg ?surOrdonnance ?estContreIndicationAbsolue
       ?idLabo ?nomLabo ?paysLabo
       ?idForme ?formeLibelle
       ?idVoie ?voieLibelle
       ?idClasse ?classeLibelle ?parentClasseLibelle
WHERE {{
  :{id} a/rdfs:subClassOf* :Medicament .
  OPTIONAL {{ :{id} :nomCommercial ?nomCommercial }}
  OPTIONAL {{ :{id} :codeAMM ?codeAMM }}
  OPTIONAL {{ :{id} :dosageMg ?dosageMg }}

  OPTIONAL {{
    BIND(EXISTS {{ :{id} a/rdfs:subClassOf* :MedicamentSurOrdonnance }} AS ?surOrdonnance)
  }}

  BIND(
    EXISTS {{ :{id} a/rdfs:subClassOf* :MedicamentAContreIndicationAbsolue }} ||
    EXISTS {{ :{id} :aContreIndication ?ci . ?ci a/rdfs:subClassOf* :ContreIndicationAbsolue }}
    AS ?estContreIndicationAbsolue
  )

  OPTIONAL {{
    :{id} :estFabriquePar ?lab .
    OPTIONAL {{ ?lab :nom ?nomLabo }}
    OPTIONAL {{ ?lab :pays ?paysLabo }}
    BIND(STRAFTER(STR(?lab), "#") AS ?idLabo)
  }}

  OPTIONAL {{
    :{id} :aForme ?f .
    OPTIONAL {{ ?f :libelle ?formeLibelle }}
    BIND(STRAFTER(STR(?f), "#") AS ?idForme)
  }}

  OPTIONAL {{
    :{id} :administreParVoie ?v .
    OPTIONAL {{ ?v :libelle ?voieLibelle }}
    BIND(STRAFTER(STR(?v), "#") AS ?idVoie)
  }}

  OPTIONAL {{
    :{id} :appartientAClasse ?cl .
    OPTIONAL {{ ?cl :libelle ?classeLibelle }}
    OPTIONAL {{ 
      ?cl :sousClasseTherapeutiqueDe ?parent .
      OPTIONAL {{ ?parent :libelle ?parentClasseLibelle }}
    }}
    BIND(STRAFTER(STR(?cl), "#") AS ?idClasse)
  }}
}} LIMIT 1"""

    res_base = fc.select(requete_base)
    if not res_base:
        raise HTTPException(status_code=404, detail=f"Médicament '{id}' introuvable.")

    info = res_base[0]

    # Molécules et Principes Actifs
    requete_molecules = f"""SELECT DISTINCT ?id ?nom ?formuleChimique ?estPrincipeActif WHERE {{
  :{id} (:contientMolecule|:contientPrincipeActif) ?m .
  OPTIONAL {{ ?m :nom ?nom }}
  OPTIONAL {{ ?m :formuleChimique ?formuleChimique }}
  BIND(EXISTS {{ ?m a/rdfs:subClassOf* :PrincipeActif }} || EXISTS {{ :{id} :contientPrincipeActif ?m }} AS ?estPrincipeActif)
  BIND(STRAFTER(STR(?m), "#") AS ?id)
}} ORDER BY ?nom"""
    molecules = fc.select(requete_molecules)

    # Excipients
    requete_excipients = f"""SELECT DISTINCT ?id ?nom ?effetNotoire WHERE {{
  :{id} :contientExcipient ?e .
  OPTIONAL {{ ?e :nom ?nom }}
  OPTIONAL {{ ?e :effetNotoire ?effetNotoire }}
  BIND(STRAFTER(STR(?e), "#") AS ?id)
}} ORDER BY ?nom"""
    excipients = fc.select(requete_excipients)

    # Contre-indications rattachées
    requete_ci = f"""SELECT DISTINCT ?id ?libelle ?estAbsolue WHERE {{
  :{id} :aContreIndication ?ci .
  OPTIONAL {{ ?ci :libelle ?libelle }}
  BIND(EXISTS {{ ?ci a/rdfs:subClassOf* :ContreIndicationAbsolue }} AS ?estAbsolue)
  BIND(STRAFTER(STR(?ci), "#") AS ?id)
}} ORDER BY ?libelle"""
    contre_indications = fc.select(requete_ci)

    # Patients qui prennent ce médicament (croisement Domaine C)
    requete_patients = f"""SELECT DISTINCT ?id ?nom ?prenom ?age WHERE {{
  ?p a/rdfs:subClassOf* :Patient ;
     :prendMedicament :{id} ;
     :nom ?nom .
  OPTIONAL {{ ?p :prenom ?prenom }}
  OPTIONAL {{ ?p :age ?age }}
  BIND(STRAFTER(STR(?p), "#") AS ?id)
}} ORDER BY ?nom"""
    patients = fc.select(requete_patients)

    donnees_completes = {
        "id": id,
        "nomCommercial": info.get("nomCommercial") or id,
        "codeAMM": info.get("codeAMM"),
        "dosageMg": info.get("dosageMg"),
        "surOrdonnance": bool(info.get("surOrdonnance", False)),
        "typeLibelle": "Sur ordonnance" if info.get("surOrdonnance") else "Sans ordonnance",
        "estContreIndicationAbsolue": bool(info.get("estContreIndicationAbsolue", False)),
        "laboratoire": {
            "id": info.get("idLabo"),
            "nom": info.get("nomLabo"),
            "pays": info.get("paysLabo"),
        } if info.get("idLabo") else None,
        "forme": {
            "id": info.get("idForme"),
            "libelle": info.get("formeLibelle"),
        } if info.get("idForme") else None,
        "voie": {
            "id": info.get("idVoie"),
            "libelle": info.get("voieLibelle"),
        } if info.get("idVoie") else None,
        "classe": {
            "id": info.get("idClasse"),
            "libelle": info.get("classeLibelle"),
            "parent": info.get("parentClasseLibelle"),
        } if info.get("idClasse") else None,
        "molecules": molecules,
        "excipients": excipients,
        "contreIndications": contre_indications,
        "patients": patients,
    }

    sparql_combine = f"""# 1. Infos générales :
{requete_base}

# 2. Molécules & Principes Actifs :
{requete_molecules}

# 3. Excipients :
{requete_excipients}

# 4. Contre-indications :
{requete_ci}

# 5. Patients prenant ce médicament :
{requete_patients}"""

    return _reponse(donnees_completes, sparql_combine)


# =================================================================
#            REQUÊTES SPARQL AVANCÉES (ASK & DESCRIBE)
# =================================================================

@router.get("/{id}/ask-ordonnance")
def verifier_necessite_ordonnance(id: IdMedicament):
    """Requête SPARQL ASK : Vérifie si ce médicament requiert obligatoirement une ordonnance."""
    requete = f"ASK {{ :{id} a/rdfs:subClassOf* :MedicamentSurOrdonnance }}"
    reponse_bool = fc.ask(requete)
    return _reponse(
        {
            "id": id,
            "necessite_ordonnance": reponse_bool,
            "message": "Ce médicament est soumis à prescription médicale obligatoire." if reponse_bool else "Ce médicament est délivrable sans ordonnance."
        },
        requete
    )


@router.get("/{id}/describe")
def graphe_rdf_medicament(id: IdMedicament):
    """Requête SPARQL DESCRIBE : Renvoie le sous-graphe RDF Turtle centré sur ce médicament."""
    requete = f"DESCRIBE :{id}"
    turtle_rdf = fc.describe(requete)
    return _reponse({"turtle": turtle_rdf}, requete)


# =================================================================
#            CRUD MÉDICAMENTS (MEMBRE A)
# =================================================================

@router.post("", status_code=201)
def creer_medicament(data: MedicamentIn):
    """Crée un nouvel individu médicament complet avec ses classifications et composants."""
    nouvel_id = _generer_id_medicament(data.nomCommercial)
    type_classe = ":MedicamentSurOrdonnance" if data.surOrdonnance else ":MedicamentSansOrdonnance"

    triplets = [
        f":{nouvel_id} a :Medicament .",
        f":{nouvel_id} a {type_classe} .",
        f":{nouvel_id} :nomCommercial {fc.lit(data.nomCommercial)} .",
        f":{nouvel_id} :dosageMg {float(data.dosageMg)} .",
    ]

    if data.codeAMM and data.codeAMM.strip():
        triplets.append(f":{nouvel_id} :codeAMM {fc.lit(data.codeAMM.strip())} .")

    if data.idLaboratoire and data.idLaboratoire.strip():
        triplets.append(f":{nouvel_id} :estFabriquePar :{data.idLaboratoire.strip()} .")

    if data.idForme and data.idForme.strip():
        triplets.append(f":{nouvel_id} :aForme :{data.idForme.strip()} .")

    if data.idVoie and data.idVoie.strip():
        triplets.append(f":{nouvel_id} :administreParVoie :{data.idVoie.strip()} .")

    if data.idClasse and data.idClasse.strip():
        triplets.append(f":{nouvel_id} :appartientAClasse :{data.idClasse.strip()} .")

    for mol_id in data.molecules or []:
        if mol_id.strip():
            triplets.append(f":{nouvel_id} :contientMolecule :{mol_id.strip()} .")
            triplets.append(f":{nouvel_id} :contientPrincipeActif :{mol_id.strip()} .")

    for exc_id in data.excipients or []:
        if exc_id.strip():
            triplets.append(f":{nouvel_id} :contientExcipient :{exc_id.strip()} .")

    sparql_update = "INSERT DATA {\n  " + "\n  ".join(triplets) + "\n}"
    fc.update(sparql_update)

    return _reponse(
        {"id": nouvel_id, "message": f"Médicament '{data.nomCommercial}' créé avec succès ({nouvel_id})."},
        sparql_update
    )


@router.put("/{id}")
def modifier_medicament(id: IdMedicament, data: MedicamentUpdate):
    """Met à jour les attributs et relations principales d'un médicament existant."""
    if not _existe_entite(id):
        raise HTTPException(status_code=404, detail=f"Médicament '{id}' introuvable.")

    updates_delete = []
    updates_insert = []

    if data.nomCommercial is not None:
        updates_delete.append(f":{id} :nomCommercial ?oldNom .")
        updates_insert.append(f":{id} :nomCommercial {fc.lit(data.nomCommercial)} .")

    if data.codeAMM is not None:
        updates_delete.append(f":{id} :codeAMM ?oldAMM .")
        if data.codeAMM.strip():
            updates_insert.append(f":{id} :codeAMM {fc.lit(data.codeAMM.strip())} .")

    if data.dosageMg is not None:
        updates_delete.append(f":{id} :dosageMg ?oldDosage .")
        updates_insert.append(f":{id} :dosageMg {float(data.dosageMg)} .")

    if data.surOrdonnance is not None:
        updates_delete.append(f":{id} a :MedicamentSurOrdonnance .")
        updates_delete.append(f":{id} a :MedicamentSansOrdonnance .")
        type_nouveau = ":MedicamentSurOrdonnance" if data.surOrdonnance else ":MedicamentSansOrdonnance"
        updates_insert.append(f":{id} a {type_nouveau} .")

    if data.idLaboratoire is not None:
        updates_delete.append(f":{id} :estFabriquePar ?oldLab .")
        if data.idLaboratoire.strip():
            updates_insert.append(f":{id} :estFabriquePar :{data.idLaboratoire.strip()} .")

    if data.idForme is not None:
        updates_delete.append(f":{id} :aForme ?oldForme .")
        if data.idForme.strip():
            updates_insert.append(f":{id} :aForme :{data.idForme.strip()} .")

    if data.idVoie is not None:
        updates_delete.append(f":{id} :administreParVoie ?oldVoie .")
        if data.idVoie.strip():
            updates_insert.append(f":{id} :administreParVoie :{data.idVoie.strip()} .")

    if data.idClasse is not None:
        updates_delete.append(f":{id} :appartientAClasse ?oldClasse .")
        if data.idClasse.strip():
            updates_insert.append(f":{id} :appartientAClasse :{data.idClasse.strip()} .")

    if not updates_insert and not updates_delete:
        return _reponse({"message": "Aucune modification demandée."}, "")

    corps_delete = "\n    ".join(updates_delete)
    corps_insert = "\n    ".join(updates_insert)

    sparql = f"""DELETE {{
    {corps_delete}
}}
INSERT {{
    {corps_insert}
}}
WHERE {{
    OPTIONAL {{ :{id} :nomCommercial ?oldNom }}
    OPTIONAL {{ :{id} :codeAMM ?oldAMM }}
    OPTIONAL {{ :{id} :dosageMg ?oldDosage }}
    OPTIONAL {{ :{id} :estFabriquePar ?oldLab }}
    OPTIONAL {{ :{id} :aForme ?oldForme }}
    OPTIONAL {{ :{id} :administreParVoie ?oldVoie }}
    OPTIONAL {{ :{id} :appartientAClasse ?oldClasse }}
}}"""

    fc.update(sparql)
    return _reponse({"message": f"Médicament '{id}' mis à jour avec succès."}, sparql)


@router.delete("/{id}")
def supprimer_medicament(id: IdMedicament):
    """Supprime un médicament et tous ses triplets rattachés après vérification de sécurité."""
    if not _existe_entite(id):
        raise HTTPException(status_code=404, detail=f"Médicament '{id}' introuvable.")

    # Vérification : médicament pris par un patient ?
    nb_patients = fc.select(f"SELECT (COUNT(?p) AS ?nb) WHERE {{ ?p :prendMedicament :{id} }}")
    if nb_patients and int(nb_patients[0].get("nb", 0)) > 0:
        c = nb_patients[0]["nb"]
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de supprimer : ce médicament est actuellement pris par {c} patient(s). Veuillez d'abord retirer la prescription du dossier patient."
        )

    sparql = f"""DELETE WHERE {{ :{id} ?p ?o }} ;
DELETE WHERE {{ ?s ?p :{id} }}"""

    fc.update(sparql)
    return _reponse({"message": f"Médicament '{id}' supprimé de l'ontologie."}, sparql)


# =================================================================
#            GESTION DE LA COMPOSITION (RELATIONS ONTOLOGIQUES)
# =================================================================

@router.post("/{id}/molecules/{id_mol}")
def associer_molecule(id: IdMedicament, id_mol: IdEntite):
    """Associe une molécule / principe actif à un médicament."""
    if not _existe_entite(id):
        raise HTTPException(status_code=404, detail="Médicament introuvable")
    sparql = f"""INSERT DATA {{ 
  :{id} :contientMolecule :{id_mol} . 
  :{id} :contientPrincipeActif :{id_mol} . 
}}"""
    fc.update(sparql)
    return _reponse({"message": f"Molécule {id_mol} rattachée à {id}."}, sparql)


@router.delete("/{id}/molecules/{id_mol}")
def dissocier_molecule(id: IdMedicament, id_mol: IdEntite):
    """Retire une molécule d'un médicament."""
    sparql = f"""DELETE DATA {{ 
  :{id} :contientMolecule :{id_mol} . 
  :{id} :contientPrincipeActif :{id_mol} . 
}}"""
    fc.update(sparql)
    return _reponse({"message": f"Molécule {id_mol} retirée de {id}."}, sparql)


@router.post("/{id}/excipients/{id_exc}")
def associer_excipient(id: IdMedicament, id_exc: IdEntite):
    """Associe un excipient à un médicament."""
    if not _existe_entite(id):
        raise HTTPException(status_code=404, detail="Médicament introuvable")
    sparql = f"INSERT DATA {{ :{id} :contientExcipient :{id_exc} . }}"
    fc.update(sparql)
    return _reponse({"message": f"Excipient {id_exc} associé à {id}."}, sparql)


@router.delete("/{id}/excipients/{id_exc}")
def dissocier_excipient(id: IdMedicament, id_exc: IdEntite):
    """Retire un excipient d'un médicament."""
    sparql = f"DELETE DATA {{ :{id} :contientExcipient :{id_exc} . }}"
    fc.update(sparql)
    return _reponse({"message": f"Excipient {id_exc} retiré de {id}."}, sparql)


# =================================================================
#            CRUD LABORATOIRES (MEMBRE A)
# =================================================================

@router.get("/laboratoires/liste")
def lister_laboratoires_complets():
    """Liste détaillée de tous les laboratoires avec le nombre de médicaments fabriqués."""
    requete = """SELECT ?id ?nom ?pays ?adresse (COUNT(DISTINCT ?m) AS ?nb_medicaments) WHERE {
  ?lab a/rdfs:subClassOf* :Laboratoire ; :nom ?nom .
  OPTIONAL { ?lab :pays ?pays }
  OPTIONAL { ?lab :adresse ?adresse }
  OPTIONAL { ?m :estFabriquePar ?lab }
  BIND(STRAFTER(STR(?lab), "#") AS ?id)
} GROUP BY ?id ?nom ?pays ?adresse
ORDER BY ?nom"""
    lignes = fc.select(requete)
    return _reponse(lignes, requete)


@router.post("/laboratoires", status_code=201)
def creer_laboratoire(data: LaboratoireIn):
    """Crée un nouveau laboratoire pharmaceutique."""
    nouvel_id = _generer_id_laboratoire(data.nom)
    triplets = [
        f":{nouvel_id} a :Laboratoire .",
        f":{nouvel_id} :nom {fc.lit(data.nom)} .",
    ]
    if data.pays and data.pays.strip():
        triplets.append(f":{nouvel_id} :pays {fc.lit(data.pays.strip())} .")
    if data.adresse and data.adresse.strip():
        triplets.append(f":{nouvel_id} :adresse {fc.lit(data.adresse.strip())} .")

    sparql = "INSERT DATA {\n  " + "\n  ".join(triplets) + "\n}"
    fc.update(sparql)
    return _reponse({"id": nouvel_id, "message": f"Laboratoire '{data.nom}' créé ({nouvel_id})."}, sparql)


@router.put("/laboratoires/{id}")
def modifier_laboratoire(id: IdLaboratoire, data: LaboratoireIn):
    """Modifie les informations d'un laboratoire."""
    if not _existe_entite(id):
        raise HTTPException(status_code=404, detail="Laboratoire introuvable")

    sparql = f"""DELETE {{
  :{id} :nom ?oldNom .
  :{id} :pays ?oldPays .
  :{id} :adresse ?oldAdresse .
}}
INSERT {{
  :{id} :nom {fc.lit(data.nom)} .
  :{id} :pays {fc.lit(data.pays or "")} .
  :{id} :adresse {fc.lit(data.adresse or "")} .
}}
WHERE {{
  OPTIONAL {{ :{id} :nom ?oldNom }}
  OPTIONAL {{ :{id} :pays ?oldPays }}
  OPTIONAL {{ :{id} :adresse ?oldAdresse }}
}}"""
    fc.update(sparql)
    return _reponse({"message": f"Laboratoire '{id}' mis à jour."}, sparql)


@router.delete("/laboratoires/{id}")
def supprimer_laboratoire(id: IdLaboratoire):
    """Supprime un laboratoire si aucun médicament ne lui est rattaché."""
    if not _existe_entite(id):
        raise HTTPException(status_code=404, detail="Laboratoire introuvable")

    nb_meds = fc.select(f"SELECT (COUNT(?m) AS ?nb) WHERE {{ ?m :estFabriquePar :{id} }}")
    if nb_meds and int(nb_meds[0].get("nb", 0)) > 0:
        c = nb_meds[0]["nb"]
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de supprimer : {c} médicament(s) sont fabriqués par ce laboratoire."
        )

    sparql = f"DELETE WHERE {{ :{id} ?p ?o }} ; DELETE WHERE {{ ?s ?p :{id} }}"
    fc.update(sparql)
    return _reponse({"message": f"Laboratoire '{id}' supprimé."}, sparql)
