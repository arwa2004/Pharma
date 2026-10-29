#!/usr/bin/env python
"""Script utilitaire pour lancer le serveur backend Pharma-Santé.

Permet de démarrer le serveur avec la commande classique :
    python manage.py runserver
ou avec un port spécifique :
    python manage.py runserver 8000
"""
import os
import subprocess
import sys

def main():
    args = sys.argv[1:]
    action = args[0] if args else "runserver"

    port = 8000
    host = "127.0.0.1"

    if action == "runserver":
        if len(args) > 1:
            try:
                if ":" in args[1]:
                    host, port_str = args[1].split(":")
                    port = int(port_str)
                else:
                    port = int(args[1])
            except ValueError:
                pass

        print(f"\n=======================================================")
        print(f"  API Pharma-Santé (FastAPI + SPARQL + spaCy NLP)")
        print(f"  Serveur actif sur   : http://{host}:{port}")
        print(f"  Documentation Docs : http://{host}:{port}/docs")
        print(f"=======================================================\n")

        # Vérifier si les dépendances complètes sont installées dans l'interpréteur actuel
        prerequis_ok = False
        try:
            import fastapi
            import uvicorn
            import spacy
            prerequis_ok = True
        except ImportError:
            prerequis_ok = False

        if not prerequis_ok:
            # Redirection automatique vers l'environnement Python 3.11 configuré
            py311 = r"C:\Users\user\AppData\Local\Programs\Python\Python311\python.exe"
            if os.path.exists(py311) and sys.executable.lower() != py311.lower():
                print(f"[INFO] Redirection automatique vers l'environnement Python 3.11 configuré...")
                script_dir = os.path.dirname(os.path.abspath(__file__))
                subprocess.run(
                    [py311, "-m", "uvicorn", "main:app", "--reload", "--host", host, "--port", str(port)],
                    cwd=script_dir
                )
                return
            else:
                print("[ERREUR] Les modules 'fastapi', 'uvicorn' et 'spacy' sont requis.")
                sys.exit(1)

        import uvicorn
        uvicorn.run("main:app", host=host, port=port, reload=True)

    else:
        print(f"Commande '{action}' non reconnue. Utilisez : python manage.py runserver [port]")

if __name__ == "__main__":
    main()
