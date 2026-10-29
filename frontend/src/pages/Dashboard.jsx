import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Grid, IconButton,
  InputAdornment, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import MedicationOutlinedIcon from "@mui/icons-material/MedicationOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";
import SparqlDemonstratorModal from "../components/SparqlDemonstratorModal.jsx";
import SchoolIcon from "@mui/icons-material/School";

function getInitials(prenom, nom) {
  const p = (prenom || "").trim()[0] || "";
  const n = (nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "P";
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [chargement, setChargement] = useState(true);
  const [stats, setStats] = useState({ polymediques: [], pathologiesMultiples: [], interactions: [], contreIndications: [] });
  const [openSparqlLab, setOpenSparqlLab] = useState(false);
  const [sparql, setSparql] = useState("");
  const [filtreActif, setFiltreActif] = useState("tous"); // "tous", "poly", "patho", "inter"
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    async function chargerDonnees() {
      try {
        setChargement(true);
        const [repPoly, repPatho, repInter, repCi] = await Promise.all([
          api.get("/patients/polymedies"),
          api.get("/patients/pathologie-multiple"),
          api.get("/patients/alertes/interactions-tous"),
          api.get("/patients/alertes/contre-indications-tous"),
        ]);
        setStats({
          polymediques: repPoly.data || [],
          pathologiesMultiples: repPatho.data || [],
          interactions: repInter.data || [],
          contreIndications: repCi.data || [],
        });
        // Garder la requête SPARQL la plus pertinente pour le mode soutenance
        setSparql(repPoly.sparql || repInter.sparql || "");
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    }
    chargerDonnees();
  }, []);

  // Construire la liste fusionnée des patients à surveiller
  const vigilanceMap = new Map();

  // Patients polymédiqués
  stats.polymediques.forEach((p) => {
    vigilanceMap.set(p.id, {
      ...p,
      alerte_poly: true,
      nb_medicaments: p.nb_medicaments ?? 3,
      nb_pathologies: p.nb_pathologies ?? 0,
    });
  });

  // Patients avec comorbidités
  stats.pathologiesMultiples.forEach((p) => {
    const ex = vigilanceMap.get(p.id) || p;
    vigilanceMap.set(p.id, {
      ...ex,
      alerte_patho: true,
      nb_medicaments: ex.nb_medicaments ?? 0,
      nb_pathologies: p.nb_pathologies ?? 2,
    });
  });

  // Patients ayant une interaction médicamenteuse
  stats.interactions.forEach((inter) => {
    const pId = inter.patient ? inter.patient.split("#").pop() : inter.id;
    if (pId) {
      const ex = vigilanceMap.get(pId);
      if (ex) {
        vigilanceMap.set(pId, { ...ex, alerte_interaction: true });
      }
    }
  });

  const tousPatientsVigilance = Array.from(vigilanceMap.values());

  // Filtrage selon le bouton cliqué et la recherche
  const patientsFiltres = tousPatientsVigilance.filter((p) => {
    // Filtre d'onglet
    if (filtreActif === "poly" && !p.alerte_poly) return false;
    if (filtreActif === "patho" && !p.alerte_patho) return false;
    if (filtreActif === "inter" && !p.alerte_interaction) return false;

    // Filtre de recherche textuelle
    if (recherche.trim()) {
      const q = recherche.toLowerCase().trim();
      const nomComplet = `${p.nom || ""} ${p.prenom || ""}`.toLowerCase();
      return nomComplet.includes(q) || (p.id && p.id.toLowerCase().includes(q));
    }
    return true;
  });

  const nbPoly = stats.polymediques.length;
  const nbPatho = stats.pathologiesMultiples.length;
  const nbInter = stats.interactions.length;

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      {/* En-tête de page identique à Patients */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h4" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
              Alertes et suivi
            </Typography>
          </Stack>
          <Typography variant="body1" color="#64748b" sx={{ mt: 0.3 }}>
            Surveillance des traitements à risque, comorbidités et interactions
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            startIcon={<SchoolIcon />}
            onClick={() => setOpenSparqlLab(true)}
            sx={{
              bgcolor: "#065f46",
              "&:hover": { bgcolor: "#044e39" },
              borderRadius: 2.5,
              px: 2.5,
              py: 0.9,
              fontSize: "0.88rem",
              fontWeight: 700,
              textTransform: "none",
            }}
          >
            Laboratoire SPARQL Soutenance
          </Button>
          <Button
            variant="outlined"
            startIcon={<PeopleAltOutlinedIcon />}
            onClick={() => navigate("/patients")}
          sx={{
            borderColor: "#cbd5e1",
            color: "#475569",
            borderRadius: 2.5,
            px: 2.5,
            py: 0.9,
            fontSize: "0.9rem",
            fontWeight: 600,
            "&:hover": { borderColor: "#065f46", color: "#065f46" },
          }}
        >
          Tous les patients
        </Button>
        </Stack>
      </Stack>

      {/* 3 Cartes KPI synthétiques identiques à la page Patients */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setFiltreActif(filtreActif === "poly" ? "tous" : "poly")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: filtreActif === "poly" ? "2px solid #d97706" : "1px solid #e2e8f0",
              bgcolor: filtreActif === "poly" ? "#fffbeb" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#d97706", transform: "translateY(-2px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                    Patients avec 3 médicaments ou plus
                  </Typography>
                  <Tooltip title="Classe définie :PatientPolymedique déduite par HermiT ou règle SPARQL HAVING (≥ 3 médicaments)">
                    <InfoOutlinedIcon sx={{ fontSize: 15, color: "#d97706" }} />
                  </Tooltip>
                </Stack>
                <Typography variant="h4" fontWeight="800" color="#b45309" sx={{ mt: 0.5 }}>
                  {nbPoly}
                </Typography>
                <Typography variant="body2" color="#92400e" sx={{ mt: 0.3 }}>
                  Surveillance polymédication
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#fef3c7", color: "#d97706", width: 48, height: 48 }}>
                <MedicationOutlinedIcon fontSize="medium" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setFiltreActif(filtreActif === "patho" ? "tous" : "patho")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: filtreActif === "patho" ? "2px solid #2563eb" : "1px solid #e2e8f0",
              bgcolor: filtreActif === "patho" ? "#eff6ff" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#2563eb", transform: "translateY(-2px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography variant="caption" sx={{ color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                    Patients avec 2 maladies ou plus
                  </Typography>
                  <Tooltip title="Classe définie :PatientAPathologieMultiple déduite par HermiT (≥ 2 pathologies)">
                    <InfoOutlinedIcon sx={{ fontSize: 15, color: "#2563eb" }} />
                  </Tooltip>
                </Stack>
                <Typography variant="h4" fontWeight="800" color="#1d4ed8" sx={{ mt: 0.5 }}>
                  {nbPatho}
                </Typography>
                <Typography variant="body2" color="#1e40af" sx={{ mt: 0.3 }}>
                  Suivi des comorbidités
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#dbeafe", color: "#2563eb", width: 48, height: 48 }}>
                <WarningAmberOutlinedIcon fontSize="medium" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setFiltreActif(filtreActif === "inter" ? "tous" : "inter")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: filtreActif === "inter" ? `2px solid ${nbInter > 0 ? "#dc2626" : "#16a34a"}` : "1px solid #e2e8f0",
              bgcolor: filtreActif === "inter" ? (nbInter > 0 ? "#fef2f2" : "#f0fdf4") : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: nbInter > 0 ? "#dc2626" : "#16a34a", transform: "translateY(-2px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: nbInter > 0 ? "#dc2626" : "#16a34a",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    fontSize: "0.75rem",
                  }}
                >
                  Médicaments à ne pas associer
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight="800"
                  sx={{ mt: 0.5 }}
                  color={nbInter > 0 ? "#dc2626" : "#16a34a"}
                >
                  {nbInter}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.3, color: nbInter > 0 ? "#991b1b" : "#166534" }}
                >
                  Associations dangereuses détectées
                </Typography>
              </Box>
              <Avatar
                sx={{
                  bgcolor: nbInter > 0 ? "#fee2e2" : "#dcfce7",
                  color: nbInter > 0 ? "#dc2626" : "#16a34a",
                  width: 48,
                  height: 48,
                }}
              >
                <ReportProblemOutlinedIcon fontSize="medium" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Barre de recherche et filtres de sélection (exactement comme Patients.jsx) */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant={filtreActif === "tous" ? "contained" : "outlined"}
              onClick={() => setFiltreActif("tous")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: filtreActif === "tous" ? "#065f46" : "transparent",
                color: filtreActif === "tous" ? "#ffffff" : "#475569",
                borderColor: "#cbd5e1",
                "&:hover": { bgcolor: filtreActif === "tous" ? "#044e39" : "#f1f5f9" },
              }}
            >
              Tous à surveiller ({tousPatientsVigilance.length})
            </Button>
            <Button
              variant={filtreActif === "poly" ? "contained" : "outlined"}
              onClick={() => setFiltreActif("poly")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: filtreActif === "poly" ? "#d97706" : "transparent",
                color: filtreActif === "poly" ? "#ffffff" : "#b45309",
                borderColor: filtreActif === "poly" ? "#d97706" : "#cbd5e1",
                "&:hover": { bgcolor: filtreActif === "poly" ? "#b45309" : "#fef3c7" },
              }}
            >
              3 médicaments ou + ({nbPoly})
            </Button>
            <Button
              variant={filtreActif === "patho" ? "contained" : "outlined"}
              onClick={() => setFiltreActif("patho")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: filtreActif === "patho" ? "#2563eb" : "transparent",
                color: filtreActif === "patho" ? "#ffffff" : "#1d4ed8",
                borderColor: filtreActif === "patho" ? "#2563eb" : "#cbd5e1",
                "&:hover": { bgcolor: filtreActif === "patho" ? "#1d4ed8" : "#dbeafe" },
              }}
            >
              Plusieurs maladies ({nbPatho})
            </Button>
          </Stack>

          {/* Champ de recherche homogène */}
          <TextField
            placeholder="Filtrer un patient sous surveillance par nom ou prénom..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: recherche && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setRecherche("")}>
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              flexGrow: 1,
              minWidth: 260,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                fontSize: "0.9rem",
                bgcolor: "#f8fafc",
              },
            }}
          />
        </Stack>
      </Paper>

      {erreur && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontSize: "0.88rem" }}>
          {erreur}
        </Alert>
      )}

      {/* Alerte si des associations dangereuses sont présentes */}
      {nbInter > 0 && (
        <Alert
          severity="error"
          icon={<ReportProblemOutlinedIcon />}
          sx={{
            mb: 2.5,
            border: "1px solid #fca5a5",
            bgcolor: "#fef2f2",
            borderRadius: 3,
            p: 2,
          }}
        >
          <Typography variant="subtitle1" fontWeight="700" color="error.dark">
            Associations dangereuses détectées chez des patients :
          </Typography>
          <Stack spacing={0.6} sx={{ mt: 1 }}>
            {stats.interactions.map((inter, idx) => (
              <Typography key={idx} variant="body1" sx={{ color: "#991b1b" }}>
                • <strong>{inter.nomMedA || inter.medA}</strong> et <strong>{inter.nomMedB || inter.medB}</strong>
                {inter.libelle ? ` : ${inter.libelle}` : ""} — Patient concerné : <strong>{inter.nom}</strong>
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      {/* Tableau des patients à surveiller - Style 100% homogène avec Patients.jsx */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        <Table>
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Patient
              </TableCell>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Identifiant
              </TableCell>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Situation
              </TableCell>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Nb médicaments
              </TableCell>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Nb maladies
              </TableCell>
              <TableCell align="right" sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chargement && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} sx={{ color: "#065f46" }} />
                  <Typography variant="body2" sx={{ display: "block", mt: 1.5, color: "#64748b" }}>
                    Analyse des alertes cliniques...
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!chargement && patientsFiltres.length === 0 && !erreur && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                  <Typography variant="body1" color="#64748b">
                    Aucun patient ne nécessite de surveillance pour ces critères.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!chargement &&
              patientsFiltres.map((p) => {
                const poly = p.alerte_poly;
                const patho = p.alerte_patho;
                const initials = getInitials(p.prenom, p.nom);

                return (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{
                      "&:last-child td, &:last-child th": { border: 0 },
                      transition: "background-color 0.15s",
                    }}
                  >
                    {/* Nom + Prénom avec Avatar */}
                    <TableCell sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={1.75} alignItems="center">
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            bgcolor: poly ? "#fef3c7" : patho ? "#dbeafe" : "#f1f5f9",
                            color: poly ? "#b45309" : patho ? "#1d4ed8" : "#475569",
                          }}
                        >
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: "#0f172a" }}>
                            {p.nom} {p.prenom || ""}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    {/* Identifiant */}
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        size="small"
                        label={`:${p.id}`}
                        variant="outlined"
                        sx={{
                          fontSize: "0.78rem",
                          fontFamily: "monospace",
                          bgcolor: "#f8fafc",
                          borderColor: "#cbd5e1",
                          color: "#334155",
                          height: 24,
                        }}
                      />
                    </TableCell>

                    {/* Situation */}
                    <TableCell sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                        {poly && (
                          <Chip
                            size="small"
                            icon={<MedicationOutlinedIcon sx={{ fontSize: "16px !important" }} />}
                            label={`3 médicaments ou + (${p.nb_medicaments})`}
                            sx={{
                              bgcolor: "#fef3c7",
                              color: "#b45309",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              height: 26,
                              border: "1px solid #fde68a",
                            }}
                          />
                        )}
                        {patho && (
                          <Chip
                            size="small"
                            icon={<WarningAmberOutlinedIcon sx={{ fontSize: "16px !important" }} />}
                            label={`Plusieurs maladies (${p.nb_pathologies})`}
                            sx={{
                              bgcolor: "#dbeafe",
                              color: "#1d4ed8",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              height: 26,
                              border: "1px solid #bfdbfe",
                            }}
                          />
                        )}
                        {p.alerte_interaction && (
                          <Chip
                            size="small"
                            icon={<ReportProblemOutlinedIcon sx={{ fontSize: "16px !important" }} />}
                            label="Association dangereuse"
                            sx={{
                              bgcolor: "#fee2e2",
                              color: "#dc2626",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              height: 26,
                              border: "1px solid #fca5a5",
                            }}
                          />
                        )}
                      </Stack>
                    </TableCell>

                    {/* Nb Médicaments */}
                    <TableCell sx={{ py: 1.5, fontSize: "0.92rem", fontWeight: 600 }}>
                      {p.nb_medicaments ?? "—"}
                    </TableCell>

                    {/* Nb Maladies */}
                    <TableCell sx={{ py: 1.5, fontSize: "0.92rem", fontWeight: 600 }}>
                      {p.nb_pathologies ?? "—"}
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Tooltip title="Ouvrir la fiche du patient (traitements, médecin, antécédents)">
                        <IconButton
                          component={Link}
                          to={`/patients/${p.id}`}
                          size="small"
                          sx={{
                            color: "#065f46",
                            bgcolor: "#ecfdf5",
                            "&:hover": { bgcolor: "#d1fae5" },
                          }}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Requête SPARQL */}
      <SparqlBox sparql={sparql} />
      <SparqlDemonstratorModal
        open={openSparqlLab}
        onClose={() => setOpenSparqlLab(false)}
      />
    </Box>
  );
}
