import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Grid, Paper, Stack, Typography, Chip, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Tooltip
} from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import MedicationIcon from "@mui/icons-material/Medication";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PeopleIcon from "@mui/icons-material/People";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { api } from "../api.js";
import { useSoutenance } from "../context/SoutenanceContext.jsx";

export default function Dashboard() {
  const { modeSoutenance } = useSoutenance();
  const [chargement, setChargement] = useState(true);
  const [stats, setStats] = useState({ polymediques: [], pathologiesMultiples: [], interactions: [] });
  const [rechercheRapide, setRechercheRapide] = useState("");
  const [erreur, setErreur] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function chargerDonnees() {
      try {
        setChargement(true);
        const [repPoly, repPatho, repInter] = await Promise.all([
          api.get("/patients/polymedies"),
          api.get("/patients/pathologie-multiple"),
          api.get("/patients/alertes/interactions-tous"),
        ]);
        setStats({
          polymediques: repPoly.data,
          pathologiesMultiples: repPatho.data,
          interactions: repInter.data,
        });
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    }
    chargerDonnees();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(rechercheRapide.trim() ? `/patients?q=${encodeURIComponent(rechercheRapide.trim())}` : "/patients");
  };

  const vigilanceMap = new Map();
  stats.polymediques.forEach((p) => vigilanceMap.set(p.id, { ...p, alerte_poly: true }));
  stats.pathologiesMultiples.forEach((p) => {
    const ex = vigilanceMap.get(p.id) || p;
    vigilanceMap.set(p.id, { ...ex, alerte_patho: true });
  });
  const patientsVigilance = Array.from(vigilanceMap.values());

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      {/* En-tête */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h4" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
              Alertes et suivi
            </Typography>
            {modeSoutenance && (
              <Chip
                label="Requête SPARQL HAVING & Règle HermiT"
                size="small"
                sx={{ bgcolor: "#ecfdf5", color: "#065f46", fontWeight: 700, fontSize: "0.78rem" }}
              />
            )}
          </Stack>
          <Typography variant="body1" color="#64748b" sx={{ mt: 0.3 }}>
            Surveillance des traitements à risque et des patients prioritaires
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<PeopleIcon />}
          onClick={() => navigate("/patients")}
          sx={{ borderRadius: 2.5, px: 2, fontSize: "0.88rem" }}
        >
          Tous les patients
        </Button>
      </Stack>

      {/* Barre de recherche rapide */}
      <Paper
        component="form"
        onSubmit={handleSearch}
        sx={{
          p: 1.5,
          mb: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          bgcolor: "#ffffff",
          borderRadius: 3,
          border: "1px solid #e2e8f0",
        }}
      >
        <SearchIcon sx={{ color: "#94a3b8", fontSize: 22, ml: 1 }} />
        <Box
          component="input"
          type="text"
          placeholder="Recherche rapide d'un patient par nom ou prénom..."
          value={rechercheRapide}
          onChange={(e) => setRechercheRapide(e.target.value)}
          sx={{
            flexGrow: 1,
            border: "none",
            outline: "none",
            fontSize: "0.92rem",
            bgcolor: "transparent",
            fontFamily: "inherit",
          }}
        />
        <Button
          type="submit"
          variant="contained"
          sx={{
            bgcolor: "#065f46",
            "&:hover": { bgcolor: "#044e39" },
            borderRadius: 2,
            px: 2.5,
            fontSize: "0.88rem",
          }}
        >
          Rechercher
        </Button>
      </Paper>

      {erreur && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontSize: "0.88rem" }}>
          {erreur}
        </Alert>
      )}

      {chargement ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress color="primary" size={32} />
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* 3 Cartes d'indicateurs clairs */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: "#fffbeb", borderLeft: "6px solid #f59e0b", borderRadius: 3 }}>
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        <Typography variant="caption" color="#b45309" fontWeight="700" sx={{ fontSize: "0.8rem", textTransform: "uppercase" }}>
                          Patients avec 3 médicaments ou plus
                        </Typography>
                        <Tooltip title="Classe définie :PatientPolymedique déduite par le raisonneur HermiT ou règle HAVING (≥ 3 médicaments)">
                          <InfoOutlinedIcon sx={{ fontSize: 16, color: "#d97706" }} />
                        </Tooltip>
                      </Stack>
                      <Typography variant="h3" fontWeight="800" color="#b45309" sx={{ mt: 0.5 }}>
                        {stats.polymediques.length}
                      </Typography>
                      <Typography variant="body2" color="#92400e" sx={{ mt: 0.3 }}>
                        Dossiers polymédiqués
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: "#fef3c7", borderRadius: "50%" }}>
                      <MedicationIcon sx={{ fontSize: 28, color: "#d97706" }} />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: "#eff6ff", borderLeft: "6px solid #3b82f6", borderRadius: 3 }}>
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        <Typography variant="caption" color="#1d4ed8" fontWeight="700" sx={{ fontSize: "0.8rem", textTransform: "uppercase" }}>
                          Patients avec 2 maladies ou plus
                        </Typography>
                        <Tooltip title="Classe définie :PatientAPathologieMultiple déduite par HermiT (≥ 2 pathologies liées)">
                          <InfoOutlinedIcon sx={{ fontSize: 16, color: "#2563eb" }} />
                        </Tooltip>
                      </Stack>
                      <Typography variant="h3" fontWeight="800" color="#1d4ed8" sx={{ mt: 0.5 }}>
                        {stats.pathologiesMultiples.length}
                      </Typography>
                      <Typography variant="body2" color="#1e40af" sx={{ mt: 0.3 }}>
                        Comorbidités multiples
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: "#dbeafe", borderRadius: "50%" }}>
                      <WarningIcon sx={{ fontSize: 28, color: "#2563eb" }} />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  bgcolor: stats.interactions.length > 0 ? "#fef2f2" : "#f0fdf4",
                  borderLeft: `6px solid ${stats.interactions.length > 0 ? "#dc2626" : "#16a34a"}`,
                  borderRadius: 3,
                }}
              >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography
                        variant="caption"
                        fontWeight="700"
                        sx={{ fontSize: "0.8rem", textTransform: "uppercase" }}
                        color={stats.interactions.length > 0 ? "#dc2626" : "#16a34a"}
                      >
                        Médicaments à ne pas associer
                      </Typography>
                      <Typography
                        variant="h3"
                        fontWeight="800"
                        sx={{ mt: 0.5 }}
                        color={stats.interactions.length > 0 ? "#dc2626" : "#16a34a"}
                      >
                        {stats.interactions.length}
                      </Typography>
                      <Typography variant="body2" color={stats.interactions.length > 0 ? "#991b1b" : "#166534"} sx={{ mt: 0.3 }}>
                        Associations dangereuses détectées
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        p: 1.5,
                        bgcolor: stats.interactions.length > 0 ? "#fee2e2" : "#dcfce7",
                        borderRadius: "50%",
                      }}
                    >
                      <ReportProblemIcon
                        sx={{
                          fontSize: 28,
                          color: stats.interactions.length > 0 ? "#dc2626" : "#16a34a",
                        }}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Alerte si des associations dangereuses existent */}
          {stats.interactions.length > 0 && (
            <Alert
              severity="error"
              icon={<ReportProblemIcon />}
              sx={{ border: "2px solid #dc2626", borderRadius: 3, p: 2 }}
            >
              <Typography variant="subtitle1" fontWeight="700" color="error.dark">
                Associations dangereuses détectées chez des patients :
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {stats.interactions.map((inter, idx) => (
                  <Typography key={idx} variant="body1" sx={{ color: "#991b1b" }}>
                    • <strong>{inter.nomMedA || inter.medA}</strong> et <strong>{inter.nomMedB || inter.medB}</strong>
                    {inter.libelle ? ` : ${inter.libelle}` : ""} — Patient concerné : <strong>{inter.nom}</strong>
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}

          {/* Tableau des patients à surveiller */}
          {patientsVigilance.length > 0 && (
            <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid #e2e8f0" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight="700" color="#065f46">
                    Patients à surveiller ({patientsVigilance.length})
                  </Typography>
                  <Typography variant="body2" color="#64748b">
                    Patients nécessitant un contrôle thérapeutique
                  </Typography>
                </Box>
                {modeSoutenance && (
                  <Chip label="Filtre SPARQL HAVING" color="success" size="small" variant="outlined" />
                )}
              </Stack>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: "#f0fdf4" }}>
                    <TableRow>
                      <TableCell sx={{ color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                        Patient
                      </TableCell>
                      <TableCell sx={{ color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                        Situation
                      </TableCell>
                      <TableCell sx={{ color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                        Nb médicaments
                      </TableCell>
                      <TableCell sx={{ color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                        Nb maladies
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                        Dossier
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientsVigilance.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell sx={{ fontWeight: 700, fontSize: "0.92rem" }}>
                          {p.prenom} {p.nom}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.75}>
                            {p.alerte_poly && (
                              <Chip size="small" color="warning" label="3 médicaments ou +" sx={{ fontWeight: 700 }} />
                            )}
                            {p.alerte_patho && (
                              <Chip size="small" color="info" label="Plusieurs maladies" sx={{ fontWeight: 700 }} />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.92rem", fontWeight: 600 }}>
                          {p.nb_medicaments ?? "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.92rem", fontWeight: 600 }}>
                          {p.nb_pathologies ?? "—"}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            component={Link}
                            to={`/patients/${p.id}`}
                            variant="outlined"
                            color="success"
                            size="small"
                            startIcon={<VisibilityIcon fontSize="small" />}
                            sx={{ fontSize: "0.82rem", py: 0.5, px: 1.5, borderRadius: 2 }}
                          >
                            Consulter
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Stack>
      )}
    </Box>
  );
}
