"""Routes NLP / IA pour la conversion Question en Langage Naturel -> SPARQL.

Accessible à tous les utilisateurs (User et Admin).
Exécute la chaîne spaCy -> Générateur SPARQL -> Fuseki.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

import nlp_engine
import nlp_patients     # Enregistre automatiquement les intentions du domaine Patients (C)
import nlp_medicaments  # Enregistre automatiquement les intentions du domaine Médicaments (A)

import nlp_complements      # voir la remarque plus bas
import nlp_prescriptions    # Membre D
router = APIRouter(prefix="/ask", tags=["Assistant NLP"])


class QuestionIn(BaseModel):
    question: str = Field(..., min_length=2, description="Question en langage naturel en français")


@router.post("")
def poser_question_nlp(q: QuestionIn) -> Dict[str, Any]:
    """Transforme une question en français en requête SPARQL et l'exécute sur Fuseki."""
    return nlp_engine.executer_nlp(q.question)


@router.get("/exemples")
def exemples_questions() -> Dict[str, Any]:
    """Retourne la liste des questions types recommandées pour tester l'assistant."""
    return {
        "categories": [
            {
                "titre": "Médicaments & Composition (Membre A)",
                "questions": [
                    "Quels médicaments contiennent du paracétamol ?",
                    "Qui fabrique la Metformine ?",
                    "Quelle est la forme de l'Aspirine ?",
                    "Quels médicaments ont une contre-indication absolue ?",
                    "Quels médicaments nécessitent une ordonnance ?",
                    "Quels médicaments sont fabriqués par Sanofi ?",
                    "Quels médicaments ont un dosage supérieur à 500 mg ?",
                    "Quelle est la composition de l'Amoxicilline ?",
                ],
            },
            {
                "titre": "Classes Définies (Raisonnement Ontologique)",
                "questions": [
                    "Quels médicaments ont une contre-indication absolue ?",
                    "Quels patients sont polymédiqués ?",
                    "Quels patients ont des pathologies multiples ?",
                    "Est-ce que Sami est polymédiqué ?",
                ],
            },
            {
                "titre": "Patients & Antécédents Médicaux (Membre C)",
                "questions": [
                    "Quels médicaments prend Sami ?",
                    "De quoi souffre Sami ?",
                    "Qui est le médecin de Sami ?",
                    "Quels patients ont plus de 60 ans ?",
                    "Donne-moi la liste de tous les patients",
                ],
            },
                        {
                "titre": "Prescriptions & Professionnels (Membre D)",
                "questions": [
                    "Affiche toutes les prescriptions",
                    "Quelles prescriptions a reçues Karim ?",
                    "Prescriptions du docteur Trabelsi",
                    "Quelles prescriptions contiennent de la Warfarine ?",
                    "Quelles prescriptions ont une interaction médicamenteuse ?",
                    "Quelles prescriptions n'ont pas été délivrées ?",
                    "Quelles prescriptions durent plus de 20 jours ?",
                    "Nombre de prescriptions par docteur",
                    "Quel médicament est le plus prescrit ?",
                ],
            },
        ]
    }


@router.get("/intentions")
def lister_intentions() -> List[Dict[str, Any]]:
    """Retourne l'ensemble des intentions enregistrées dans le moteur NLP."""
    return [
        {
            "id": i.id,
            "domaine": i.domaine,
            "description": i.description,
            "exemples": i.exemples,
            "mots_cles": i.mots_cles,
        }
        for i in nlp_engine.REGISTRE_INTENTIONS.values()
    ]
