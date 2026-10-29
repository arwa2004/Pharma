import { useEffect, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Avatar, Box, Button,
  Card, CardContent, Chip, CircularProgress, Divider, Grid, IconButton,
  InputAdornment, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ClearIcon from "@mui/icons-material/Clear";
import StorageIcon from "@mui/icons-material/Storage";
import TerminalIcon from "@mui/icons-material/Terminal";
import HistoryIcon from "@mui/icons-material/History";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";

const QUESTIONS_RAPIDES = [
  {
    categorie: "Médicaments & Composition ",
    questions: [
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
    categorie: "Classes définies (Règles HermiT)",
    questions: [
      "Quels patients sont polymédiqués ?",
      "Quels patients ont des pathologies multiples ?",
      "Est-ce que Sami est polymédiqué ?",
    ],
  },
  {
    categorie: "Relations sémantiques par patient",
    questions: [
      "Quels médicaments prend Sami ?",
      "De quoi souffre Sami ?",
      "Qui est le médecin de Sami ?",
    ],
  },
  {
    categorie: "Recherches croisées & Interactions",
    questions: [
      "Quels patients prennent de l'Aspirine ?",
      "Y a-t-il des interactions médicamenteuses ?",
      "Combien de patients sont enregistrés ?",
    ],
  },
    {
    categorie: "Prescriptions & Professionnels (Membre D)",
    questions: [
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
];

export default function Assistant() {
  const [question, setQuestion] = useState("");
  const [chargement, setChargement] = useState(false);
  const [reponse, setReponse] = useState(null);
  const [erreur, setErreur] = useState("");
  const [historique, setHistorique] = useState([]);

  const handlePoserQuestion = async (qTexte) => {
    const q = (qTexte || question).trim();
    if (!q) return;
    setChargement(true);
    setErreur("");
    setReponse(null);

    try {
      const res = await api.askNlp(q);
      setReponse(res);
      setHistorique((prev) => [
        {
          question: q,
          succes: res.succes,
          intention: res.intention,
          reponse: res.reponse_texte,
          date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.slice(0, 5),
      ]);
      setQuestion(q);
    } catch (e) {
      setErreur(e.message || "Erreur de communication avec le module NLP spaCy");
    } finally {
      setChargement(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePoserQuestion();
    }
  };

  return (
    <Box sx={{ maxWidth: 1150, mx: "auto" }}>
      {/* En-tête de page moderne */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" fontWeight="700" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
              Assistant IA
            </Typography>
            <Chip
              icon={<PsychologyIcon sx={{ fontSize: "15px !important", color: "#065f46" }} />}
              size="small"
              sx={{ bgcolor: "#ecfdf5", color: "#065f46", fontWeight: 600, fontSize: "0.72rem" }}
            />
          </Stack>
          <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem", mt: 0.3 }}>
          </Typography>
        </Box>
      </Stack>

      {/* Barre de saisie de la question */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2.5,
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
          <TextField
            fullWidth
            placeholder="Posez votre question (ex : 'Quels patients sont polymédiqués ?', 'De quoi souffre Sami ?')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={chargement}
            size="medium"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <QuestionAnswerIcon sx={{ color: "#065f46", fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: question && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQuestion("")}>
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                fontSize: "0.88rem",
                bgcolor: "#f8fafc",
                "&.Mui-focused": { bgcolor: "#ffffff" },
              },
            }}
          />
          <Button
            variant="contained"
            endIcon={chargement ? <CircularProgress size={16} color="inherit" /> : <SendIcon fontSize="small" />}
            onClick={() => handlePoserQuestion()}
            disabled={chargement || !question.trim()}
            sx={{
              minWidth: 140,
              height: 48,
              bgcolor: "#065f46",
              "&:hover": { bgcolor: "#044e39" },
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.85rem",
              borderRadius: 2.5,
              boxShadow: "0 2px 4px rgba(6,95,70,0.2)",
              whiteSpace: "nowrap",
            }}
          >
            {chargement ? "Analyse..." : "Interroger"}
          </Button>
        </Stack>

        {/* Suggestions classées par catégorie */}
        <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid #f1f5f9" }}>
          <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem", display: "block", mb: 1.25 }}>
            💡 Questions recommandées :
          </Typography>
          <Grid container spacing={1.5}>
            {QUESTIONS_RAPIDES.map((bloc, bIdx) => (
              <Grid item xs={12} md={4} key={bIdx}>
                <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 600, fontSize: "0.72rem", display: "block", mb: 0.5 }}>
                  {bloc.categorie}
                </Typography>
                <Stack spacing={0.6}>
                  {bloc.questions.map((q, qIdx) => (
                    <Chip
                      key={qIdx}
                      label={q}
                      size="small"
                      clickable
                      onClick={() => handlePoserQuestion(q)}
                      icon={<AutoAwesomeIcon sx={{ fontSize: "13px !important", color: "#059669" }} />}
                      sx={{
                        fontSize: "0.74rem",
                        bgcolor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        justifyContent: "flex-start",
                        height: 28,
                        "&:hover": { bgcolor: "#ecfdf5", borderColor: "#a7f3d0" },
                      }}
                    />
                  ))}
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>

      {/* Erreur de requête */}
      {erreur && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontSize: "0.82rem" }} onClose={() => setErreur("")}>
          {erreur}
        </Alert>
      )}

      {/* Résultat du pipeline NLP & SPARQL */}
      {reponse && (
        <Stack spacing={2.5} sx={{ mb: 3 }}>
          {/* Carte Résultat Synthétique */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            {/* Ligne Diagnostic NLP */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                {reponse.succes ? (
                  <CheckCircleOutlinedIcon sx={{ color: "#059669", fontSize: 22 }} />
                ) : (
                  <WarningAmberIcon sx={{ color: "#d97706", fontSize: 22 }} />
                )}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>
                  {reponse.succes ? "Intention NLP identifiée par spaCy" : "Analyse incertaine"}
                </Typography>
                {reponse.intention && (
                  <Chip
                    label={reponse.intention}
                    size="small"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.72rem",
                      bgcolor: "#f1f5f9",
                      color: "#334155",
                      fontWeight: 600,
                    }}
                  />
                )}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                {reponse.confiance !== undefined && (
                  <Chip
                    label={`Score spaCy : ${Math.round(reponse.confiance * 100)}%`}
                    size="small"
                    sx={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      bgcolor: reponse.confiance >= 0.7 ? "#dcfce7" : "#fef3c7",
                      color: reponse.confiance >= 0.7 ? "#166534" : "#92400e",
                      border: "1px solid",
                      borderColor: reponse.confiance >= 0.7 ? "#bbf7d0" : "#fde68a",
                    }}
                  />
                )}
              </Stack>
            </Stack>

            {/* Entités nommées reconnues (NER) */}
            {reponse.entites && Object.keys(reponse.entites).length > 0 && (
              <Box sx={{ mb: 1.5, p: 1, px: 1.5, bgcolor: "#f8fafc", borderRadius: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, fontSize: "0.72rem" }}>
                  Entités extraites (NER) :
                </Typography>
                {Object.entries(reponse.entites).map(([k, v]) => (
                  <Chip
                    key={k}
                    label={`${k} = "${v}"`}
                    size="small"
                    sx={{ fontSize: "0.7rem", bgcolor: "#e0e7ff", color: "#3730a3", fontWeight: 600, height: 22 }}
                  />
                ))}
              </Box>
            )}

            {/* Réponse médicale en langage naturel */}
            {reponse.reponse_texte && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                <Typography variant="caption" sx={{ color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem", display: "block", mb: 0.5 }}>
                  Réponse synthétisée :
                </Typography>
                <Typography variant="body1" sx={{ color: "#14532d", fontWeight: 600, fontSize: "0.92rem", lineHeight: 1.5 }}>
                  {reponse.reponse_texte}
                </Typography>
              </Box>
            )}

            {!reponse.succes && reponse.erreur && (
              <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2, fontSize: "0.82rem" }}>
                {reponse.erreur}
              </Alert>
            )}
          </Paper>

          {/* SPARQL généré dynamiquement */}
          {reponse.sparql && (
            <SparqlBox sparql={reponse.sparql} defaultOpen={true} />
          )}

          {/* Données brutes renvoyées par Fuseki */}
          {reponse.donnees && Array.isArray(reponse.donnees) && reponse.donnees.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: "1px solid #e2e8f0",
                bgcolor: "#ffffff",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <StorageIcon sx={{ color: "#065f46", fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a" }}>
                  Résultats bruts Fuseki ({reponse.donnees.length} ligne{reponse.donnees.length > 1 ? "s" : ""})
                </Typography>
              </Stack>

              <TableContainer sx={{ borderRadius: 2, border: "1px solid #e2e8f0", maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {Object.keys(reponse.donnees[0]).map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 700, bgcolor: "#f8fafc", color: "#475569", fontSize: "0.72rem", py: 1 }}>
                          ?{col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reponse.donnees.map((ligne, idx) => (
                      <TableRow key={idx} hover>
                        {Object.keys(reponse.donnees[0]).map((col) => (
                          <TableCell key={col} sx={{ fontSize: "0.78rem", py: 1 }}>
                            {String(ligne[col] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Cas de réponse SPARQL ASK booléenne */}
          {reponse.donnees && reponse.donnees.reponse_booleenne !== undefined && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: "1px solid #e2e8f0",
                bgcolor: "#ffffff",
                textAlign: "center",
              }}
            >
              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}>
                Résultat booléen de la requête SPARQL ASK
              </Typography>
              <Typography
                variant="h4"
                fontWeight="700"
                sx={{
                  mt: 0.5,
                  color: reponse.donnees.reponse_booleenne ? "#16a34a" : "#dc2626",
                }}
              >
                {reponse.donnees.reponse_booleenne ? "TRUE (Vrai)" : "FALSE (Faux)"}
              </Typography>
            </Paper>
          )}
        </Stack>
      )}

      {/* Historique des requêtes */}
      {historique.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            border: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <HistoryIcon sx={{ color: "#64748b", fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#475569" }}>
              Historique récent de la session ({historique.length})
            </Typography>
          </Stack>
          <Stack spacing={1}>
            {historique.map((h, i) => (
              <Box
                key={i}
                onClick={() => handlePoserQuestion(h.question)}
                sx={{
                  p: 1.25,
                  px: 1.75,
                  borderRadius: 2,
                  bgcolor: "#f8fafc",
                  border: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": { bgcolor: "#f1f5f9", borderColor: "#cbd5e1" },
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8rem", color: "#0f172a" }}>
                    « {h.question} »
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.72rem" }}>
                    {h.reponse || h.intention}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: "0.7rem", fontFamily: "monospace" }}>
                  {h.date}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
