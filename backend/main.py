"""Point d'entrée de l'API.

Lancer :  uvicorn main:app --reload
Tester :  http://127.0.0.1:8000/docs

Tous les fichiers du dossier routes/ qui contiennent une variable `router`
sont ajoutés automatiquement : chaque membre ajoute son fichier sans toucher
à celui des autres.
"""
import importlib
import pkgutil

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import fuseki_client
import routes

app = FastAPI(title="API Pharma-Santé", version="1.0")

# Autorise le front-end (autre port, ou fichier HTML ouvert directement)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for module_info in pkgutil.iter_modules(routes.__path__):
    module = importlib.import_module(f"routes.{module_info.name}")
    if hasattr(module, "router"):
        app.include_router(module.router)


@app.exception_handler(fuseki_client.FusekiError)
async def erreur_fuseki(request: Request, exc: fuseki_client.FusekiError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/", tags=["Santé"])
def accueil():
    """Vérifie que l'API et Fuseki répondent."""
    lignes = fuseki_client.select("SELECT (COUNT(*) AS ?nb) WHERE { ?s ?p ?o }")
    return {"api": "ok", "fuseki": "ok", "triplets": lignes[0]["nb"]}