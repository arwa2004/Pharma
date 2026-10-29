"""Routes NLP / IA pour la conversion Question en Langage Naturel -> SPARQL.

Accessible à tous les utilisateurs (User et Admin).
Exécute la chaîne spaCy -> Générateur SPARQL -> Fuseki.
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

import nlp_engine
import nlp_patients  # Enregistre automatiquement les intentions du domaine Patients

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
                "titre": "Classes Définies (Règles Ontologiques)",
                "questions": [
                    "Quels patients sont polymédiqués ?",
                    "Quels patients ont des pathologies multiples ?",
                    "Est-ce que Sami est polymédiqué ?",
                ],
            },
            {
                "titre": "Relations & Antécédents Médicaux",
                "questions": [
                    "Quels médicaments prend Sami ?",
                    "De quoi souffre Sami ?",
                    "Qui est le médecin de Sami ?",
                ],
            },
            {
                "titre": "Alertes & Raisonnement Clinique",
                "questions": [
                    "Y a-t-il des patients avec des interactions médicamenteuses ?",
                    "Quels patients ont plus de 60 ans ?",
                    "Donne-moi la liste de tous les patients",
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
