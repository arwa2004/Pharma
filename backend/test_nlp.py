"""Test hors-ligne de l'assistant NLP (sans Fuseki) : `python test_nlp.py` dans le dossier backend.

Vérifie que chaque question recommandée est reconnue avec la bonne intention et les bonnes entités,
puis que quelques reformulations sont comprises, et que le SPARQL généré est syntaxiquement valide.
"""
import sys
import nlp_engine
import nlp_patients, nlp_medicaments, nlp_complements  # noqa: F401  (enregistrent les intentions)

# (question, intention attendue, entités attendues : clé -> sous-chaîne)
RECOMMANDEES = [
    ("Quels médicaments contiennent du paracétamol ?", "medicaments_par_molecule", {"molecule": "paracetamol"}),
    ("Qui fabrique la Metformine ?", "medicaments_fabricant", {"medicament": "metformine"}),
    ("Quelle est la forme de l'Aspirine ?", "medicaments_forme_voie", {"medicament": "aspirine"}),
    ("Quels médicaments ont une contre-indication absolue ?", "medicaments_contre_indication_absolue", {}),
    ("Quels médicaments nécessitent une ordonnance ?", "medicaments_sur_ordonnance", {}),
    ("Quels médicaments sont fabriqués par Sanofi ?", "medicaments_par_laboratoire", {"laboratoire": "sanofi"}),
    ("Quels médicaments ont un dosage supérieur à 500 mg ?", "medicaments_dosage_eleve", {"dosage": 500.0}),
    ("Quelle est la composition de l'Amoxicilline ?", "medicaments_fiche_composition", {"medicament": "amoxicilline"}),
    ("Quels patients sont polymédiqués ?", "patients_polymediques", {}),
    ("Quels patients ont des pathologies multiples ?", "patients_pathologie_multiple", {}),
    ("Est-ce que Sami est polymédiqué ?", "verifier_polymedique_ask", {"nom": "sami"}),
    ("Quels médicaments prend Sami ?", "medicaments_patient", {"nom": "sami"}),
    ("De quoi souffre Sami ?", "pathologies_patient", {"nom": "sami"}),
    ("Qui est le médecin de Sami ?", "medecin_patient", {"nom": "sami"}),
    ("Quels patients prennent de l'Aspirine ?", "patients_par_medicament", {"medicament": "aspirine"}),
    ("Y a-t-il des interactions médicamenteuses ?", "interactions_patients", {}),
    ("Combien de patients sont enregistrés ?", "compter_patients", {}),
    ("Quels patients ont plus de 60 ans ?", "patients_par_age", {"age": 60}),
    ("Donne-moi la liste de tous les patients", "liste_tous_patients", {}),
]
REFORMULATIONS = [
    ("quels medicaments sont sans ordonnance", "medicaments_sans_ordonnance", {}),
    ("Médicaments produits par Pfizer", "medicaments_par_laboratoire", {"laboratoire": "pfizer"}),
    ("Quel est le laboratoire du Doliprane ?", "medicaments_fabricant", {"medicament": "doliprane"}),
    ("Qui prend du Doliprane ?", "patients_par_medicament", {"medicament": "paracetamol"}),
    ("Quels sont les médicaments de Karim ?", "medicaments_patient", {"nom": "karim"}),
    ("De quelle maladie souffre Amina ?", "pathologies_patient", {"nom": "amina"}),
    ("Quels patients ont plus de 45 ans ?", "patients_par_age", {"age": 45}),
    ("Les patients polymédiqués s'il vous plaît", "patients_polymediques", {}),
    ("Le patient Ben Salah est-il polymédiqué ?", "verifier_polymedique_ask", {"nom": "ben salah"}),
    ("Médicaments dosés à plus de 250 mg", "medicaments_dosage_eleve", {"dosage": 250.0}),
]

echecs = 0
def verifier(titre, cas):
    global echecs
    print(f"\n== {titre} ==")
    for q, attendu, ents in cas:
        r = nlp_engine.classer(q)
        i = r["intention"].id if r["intention"] else None
        ok = i == attendu and all(
            (str(v) in str(r["entites"].get(k, ""))) for k, v in ents.items())
        if not ok:
            echecs += 1
        print(("OK  " if ok else "ECHEC"), f"{r['confiance']:.2f}", q, "->", i,
              "" if ok else f"(attendu {attendu}, entités {r['entites']})")

verifier("Questions recommandées", RECOMMANDEES)
verifier("Reformulations", REFORMULATIONS)

print("\n== SPARQL ==")
try:
    from rdflib.plugins.sparql import prepareQuery
    from rdflib import RDFS
    for q in ["Quels médicaments contiennent du paracétamol ?", "Qui fabrique la Metformine ?",
              "Quels médicaments prend Ben Salah ?", "Quels patients prennent de l'Aspirine ?",
              "Combien de patients sont enregistrés ?"]:
        r = nlp_engine.classer(q)
        _, sp = r["intention"].generateur_sparql(nlp_engine._vers_sparql(r["entites"]))
        sp = nlp_engine.assainir_sparql(sp)
        try:
            prepareQuery(sp, initNs={"rdfs": RDFS})
            print("OK   ", q)
        except Exception as e:
            echecs += 1
            print("ECHEC", q, "->", str(e)[:150])
except ImportError:
    print("(rdflib absent : vérification SPARQL ignorée — pip install rdflib)")

print("\n", "TOUT EST OK" if not echecs else f"{echecs} échec(s)")
sys.exit(1 if echecs else 0)