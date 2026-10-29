import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import CodeIcon from "@mui/icons-material/Code";
import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import SchoolIcon from "@mui/icons-material/School";
import StorageIcon from "@mui/icons-material/Storage";
import { api } from "../api";

export const REQUETES_SOUTENANCE = [
  {
    id: "interactions",
    titre: "1. Association Médicamenteuse Dangereuse (Requête Croisée)",
    badge: "Croisement Multi-Propriétés",
    couleurBadge: "error",
    explication:
      "Croise deux médicaments distincts pris par un même patient (?p :prendMedicament ?a, ?b) et vérifie s'ils participent à une même interaction (:participeInteraction ?inter). Démontre la valeur ajoutée clinique sur Pat_Amina (Aspirine + Warfarine).",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?nomPatient ?nomMedA ?nomMedB ?risque
WHERE {
  ?patient a/rdfs:subClassOf* :Patient ;
           :nom ?nomPatient ;
           :prendMedicament ?medA , ?medB .

  { ?medA :participeInteraction ?inter . ?medB :participeInteraction ?inter . }
  UNION
  { ?inter :impliqueMedicament ?medA , ?medB . }

  FILTER(STR(?medA) < STR(?medB))
  OPTIONAL { ?medA :nomCommercial ?nomMedA }
  OPTIONAL { ?medB :nomCommercial ?nomMedB }
  OPTIONAL { ?inter :libelle ?risque }
}
ORDER BY ?nomPatient`,
  },
  {
    id: "contre_indications",
    titre: "2. Contre-Indication Médicament / Pathologie (Raisonnement Croisé)",
    badge: "Raisonnement Sémantique",
    couleurBadge: "warning",
    explication:
      "Relie ce que prend le patient (?p :prendMedicament ?m) et ce dont il souffre (?p :souffreDe ?path) à travers la contre-indication du médicament (?m :aContreIndication ?ci . ?ci :concernePathologie ?path). Détecte immédiatement Hedi Gharbi (Ibuprofène + Ulcère gastrique).",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>

SELECT DISTINCT ?nomPatient ?nomMed ?pathologie
WHERE {
  ?p :prendMedicament ?m ;
     :souffreDe ?path ;
     :nom ?nomPatient .
  ?m :aContreIndication ?ci ;
     :nomCommercial ?nomMed .
  ?ci :concernePathologie ?path .
  ?path :libelle ?pathologie .
}
ORDER BY ?nomPatient`,
  },
  {
    id: "polymedication",
    titre: "3. Détection de :PatientPolymedique (HAVING ≥ 3 médicaments)",
    badge: "Équivalent HermiT",
    couleurBadge: "success",
    explication:
      "Équivalent SPARQL de la classe définie OWL :PatientPolymedique (règle de cardinalité minimale prendMedicament min 3). Filtre les patients polymédiqués pour prioriser la revue clinique.",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?nomPatient ?age (COUNT(DISTINCT ?m) AS ?nbMedicaments)
WHERE {
  ?p a/rdfs:subClassOf* :Patient ;
     :nom ?nomPatient ;
     :age ?age ;
     :prendMedicament ?m .
}
GROUP BY ?nomPatient ?age
HAVING (COUNT(DISTINCT ?m) >= 3)
ORDER BY DESC(?nbMedicaments)`,
  },
  {
    id: "comorbidites",
    titre: "4. Comorbidités Multiples (HAVING ≥ 2 pathologies)",
    badge: "Agrégation SPARQL",
    couleurBadge: "info",
    explication:
      "Équivalent SPARQL de la classe :PatientAPathologieMultiple. Identifie les patients suivis pour au moins deux maladies actives simultanées.",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?nomPatient ?age (COUNT(DISTINCT ?patho) AS ?nbPathologies)
WHERE {
  ?p a/rdfs:subClassOf* :Patient ;
     :nom ?nomPatient ;
     :age ?age ;
     :souffreDe ?patho .
}
GROUP BY ?nomPatient ?age
HAVING (COUNT(DISTINCT ?patho) >= 2)
ORDER BY DESC(?nbPathologies)`,
  },
  {
    id: "ask",
    titre: "5. Requête Booléenne ASK (Validation instantanée)",
    badge: "SPARQL ASK",
    couleurBadge: "secondary",
    explication:
      "Vérifie de façon ultra-rapide si un patient précis (:Pat_Sami) respecte la condition de polymédication (au moins 3 médicaments distincts). Renvoie un booléen pur (true / false).",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>

ASK {
  :Pat_Sami :prendMedicament ?m1 , ?m2 , ?m3 .
  FILTER(?m1 != ?m2 && ?m1 != ?m3 && ?m2 != ?m3)
}`,
  },
  {
    id: "describe",
    titre: "6. Extraction RDF Turtle DESCRIBE (Sous-graphe du patient)",
    badge: "Graphe RDF",
    couleurBadge: "default",
    explication:
      "Extrait l'ensemble des triplets RDF entourant l'individu :Pat_Sami (propriétés directes, médicaments, pathologies, médecin) sous forme de syntaxe Turtle.",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>

DESCRIBE :Pat_Sami`,
  },
  {
    id: "union",
    titre: "7. Vue 360° du Dossier Patient (Requête UNION)",
    badge: "SPARQL UNION",
    couleurBadge: "primary",
    explication:
      "Utilise l'opérateur SPARQL UNION pour fusionner 3 dimensions ontologiques hétérogènes (médicaments, pathologies et médecin traitant) en une vue unifiée.",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>

SELECT ?typeRelation ?elementLie
WHERE {
  {
    :Pat_Sami :prendMedicament ?elem .
    BIND("1. Médicament prescrit" AS ?typeRelation)
  } UNION {
    :Pat_Sami :souffreDe ?elem .
    BIND("2. Pathologie diagnostiquée" AS ?typeRelation)
  } UNION {
    :Pat_Sami :estSuiviPar ?elem .
    BIND("3. Médecin référent" AS ?typeRelation)
  }
  BIND(STRAFTER(STR(?elem), "#") AS ?elementLie)
}
ORDER BY ?typeRelation`,
  },
  {
    id: "negation",
    titre: "8. Négation sémantique : Patients sans traitement (FILTER NOT EXISTS)",
    badge: "Négation / CWA",
    couleurBadge: "default",
    explication:
      "Montre l'hypothèse du monde fermé (Closed World) en SPARQL : identifie les patients pour lesquels aucun triplet :prendMedicament n'est enregistré (ex : Pat_Karim).",
    sparql: `PREFIX : <http://www.esprit.tn/ontologies/pharma-sante#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?nomPatient ?prenom ?age
WHERE {
  ?p a/rdfs:subClassOf* :Patient ;
     :nom ?nomPatient ;
     :age ?age .
  OPTIONAL { ?p :prenom ?prenom }
  FILTER NOT EXISTS { ?p :prendMedicament ?m }
}
ORDER BY ?nomPatient`,
  },
];

export default function SparqlDemonstratorModal({ open, onClose, defaultPatientId }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [codeQuery, setCodeQuery] = useState(REQUETES_SOUTENANCE[0].sparql);
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");
  const [copied, setCopied] = useState(false);

  const reqCourante = REQUETES_SOUTENANCE[selectedIdx];

  const handleSelectQuery = (idx) => {
    setSelectedIdx(idx);
    let q = REQUETES_SOUTENANCE[idx].sparql;
    if (defaultPatientId && (q.includes(":Pat_Sami") || q.includes("Pat_Amina"))) {
      // Optionnel : adapter au patient courant
    }
    setCodeQuery(q);
    setResultat(null);
    setErreur("");
  };

  const handleExecuter = async () => {
    try {
      setLoading(true);
      setErreur("");
      setResultat(null);
      const res = await api.executerSparql(codeQuery);
      setResultat(res);
    } catch (e) {
      setErreur(e.message || "Erreur lors de l'exécution de la requête");
    } finally {
      setLoading(false);
    }
  };

  const handleCopier = () => {
    navigator.clipboard.writeText(codeQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}>
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <SchoolIcon sx={{ color: "#065f46", fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: -0.3 }}>
              Laboratoire de Requêtes SPARQL Réelles (Prêt pour la soutenance)
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              8 Requêtes sémantiques réelles prêtes à être exécutées en direct et testées devant l'examinateur
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <Grid container spacing={3}>
          {/* Colonne GAUCHE : Sélecteur de requêtes */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#334155", mb: 1.5 }}>
              Sélectionnez une requête type :
            </Typography>
            <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, overflow: "hidden", maxHeight: 560, overflowY: "auto" }}>
              <List disablePadding>
                {REQUETES_SOUTENANCE.map((item, idx) => {
                  const isSel = idx === selectedIdx;
                  return (
                    <ListItemButton
                      key={item.id}
                      selected={isSel}
                      onClick={() => handleSelectQuery(idx)}
                      sx={{
                        py: 1.5,
                        px: 2,
                        borderBottom: "1px solid #f1f5f9",
                        bgcolor: isSel ? "#ecfdf5 !important" : "transparent",
                        "&:hover": { bgcolor: "#f8fafc" },
                      }}
                    >
                      <ListItemText
                        disableTypography
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: isSel ? 700 : 600, color: isSel ? "#065f46" : "#1e293b" }}>
                            {item.titre}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Chip
                              label={item.badge}
                              size="small"
                              color={item.couleurBadge}
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                            />
                          </Box>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          </Grid>

          {/* Colonne DROITE : Éditeur, Rationale & Résultats */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={2.5}>
              {/* Encadré Rationale Ontologique */}
              <Alert
                severity="info"
                icon={<SchoolIcon fontSize="small" />}
                sx={{
                  borderRadius: 2.5,
                  bgcolor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  fontSize: "0.85rem",
                  py: 1,
                }}
              >
                <Box component="span" sx={{ fontWeight: 800, mr: 0.5 }}>Objectif pédagogique pour le prof :</Box>{reqCourante.explication}
              </Alert>

              {/* Zone de code SPARQL */}
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Requête SPARQL (Éditable)
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                      onClick={handleCopier}
                      sx={{
                        fontSize: "0.78rem",
                        textTransform: "none",
                        color: copied ? "#16a34a" : "#475569",
                        fontWeight: 600,
                      }}
                    >
                      {copied ? "Copié !" : "Copier pour Fuseki Web UI"}
                    </Button>
                  </Stack>
                </Stack>

                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  sx={{
                    "& .MuiInputBase-root": {
                      fontFamily: "Consolas, Menlo, Monaco, monospace",
                      fontSize: "0.84rem",
                      bgcolor: "#0f172a",
                      color: "#f8fafc",
                      borderRadius: 2.5,
                      lineHeight: 1.45,
                    },
                  }}
                />
              </Box>

              {/* Bouton Exécuter */}
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : <PlayArrowIcon />}
                  disabled={loading}
                  onClick={handleExecuter}
                  sx={{
                    bgcolor: "#065f46",
                    "&:hover": { bgcolor: "#044e39" },
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 700,
                    px: 3,
                    py: 1,
                  }}
                >
                  Exécuter la requête SPARQL en direct
                </Button>
                <Typography variant="caption" sx={{ color: "#64748b" }}>
                  Interroge Apache Fuseki (ou le moteur RDFLib local)
                </Typography>
              </Stack>

              {erreur && (
                <Alert severity="error" sx={{ borderRadius: 2, fontSize: "0.84rem" }}>
                  {erreur}
                </Alert>
              )}

              {/* Affichage des Résultats */}
              {resultat && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: "1px solid #cbd5e1",
                    bgcolor: "#ffffff",
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0f172a" }}>
                      Résultat retourné : Type {resultat.type}
                    </Typography>
                    {Array.isArray(resultat.data) && (
                      <Chip label={`${resultat.data.length} résultat(s)`} size="small" sx={{ fontWeight: 700 }} />
                    )}
                  </Stack>

                  {/* 1. Résultat booléen ASK */}
                  {resultat.type === "ASK" && (
                    <Box sx={{ p: 2, textAlign: "center", bgcolor: resultat.data ? "#f0fdf4" : "#fef2f2", borderRadius: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: resultat.data ? "#16a34a" : "#dc2626" }}>
                        {resultat.data ? "TRUE (VRAI) ✅" : "FALSE (FAUX) ❌"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#475569", mt: 0.5 }}>
                        La condition ontologique testée est satisfaite dans le graphe RDF.
                      </Typography>
                    </Box>
                  )}

                  {/* 2. Résultat Turtle DESCRIBE */}
                  {resultat.type === "DESCRIBE" && (
                    <Box
                      component="pre"
                      sx={{
                        p: 1.5,
                        m: 0,
                        bgcolor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 2,
                        fontSize: "0.8rem",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        color: "#0f172a",
                      }}
                    >
                      {resultat.data || "Aucun triplet RDF retourné."}
                    </Box>
                  )}

                  {/* 3. Résultat Tabulaire SELECT */}
                  {resultat.type === "SELECT" && (
                    <>
                      {resultat.data?.length === 0 ? (
                        <Typography variant="body2" color="#64748b" sx={{ p: 2, textAlign: "center" }}>
                          Aucun résultat ne correspond aux filtres de cette requête.
                        </Typography>
                      ) : (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                                {Object.keys(resultat.data[0] || {}).map((col) => (
                                  <TableCell key={col} sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#334155" }}>
                                    ?{col}
                                  </TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {resultat.data.map((row, rIdx) => (
                                <TableRow key={rIdx} hover>
                                  {Object.keys(resultat.data[0]).map((col) => (
                                    <TableCell key={col} sx={{ fontSize: "0.82rem", color: "#0f172a" }}>
                                      {String(row[col] ?? "—")}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </>
                  )}
                </Paper>
              )}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}


export { SparqlDemonstratorModal };
