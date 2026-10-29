import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Grid, Paper, Stack, Typography, Chip, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer
} from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import MedicationIcon from "@mui/icons-material/Medication";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PeopleIcon from "@mui/icons-material/People";
import { api } from "../api.js";
import AssignmentIcon from "@mui/icons-material/Assignment";
export default function Dashboard() {
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
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" fontWeight="bold" color="#065f46">Tableau de Vigilance Clinique</Typography>
          <Chip label="Requête SPARQL HAVING" color="success" size="small" variant="outlined" />
        </Stack>
        <Stack direction="row" spacing={1}>
  <Button variant="outlined" color="success" size="small" startIcon={<PeopleIcon fontSize="small" />}
    onClick={() => navigate("/patients")}>
    Tous les dossiers
  </Button>
  <Button variant="contained" color="success" size="small" startIcon={<AssignmentIcon fontSize="small" />}
    onClick={() => navigate("/prescriptions")}>
    Prescriptions
  </Button>
</Stack>
      </Stack>

      {/* Recherche rapide */}
      <Paper component="form" onSubmit={handleSearch}
        sx={{ p: 1.25, mb: 2, display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#ffffff", borderRadius: 2 }}>
        <SearchIcon color="action" fontSize="small" />
        <Box component="input" type="text"
          placeholder="Recherche rapide d'un patient par nom ou prénom..."
          value={rechercheRapide} onChange={(e) => setRechercheRapide(e.target.value)}
          sx={{ flexGrow: 1, border: "none", outline: "none", fontSize: "0.82rem", bgcolor: "transparent" }}
        />
        <Button type="submit" variant="outlined" color="success" size="small">Rechercher</Button>
      </Paper>

      {erreur && <Alert severity="error" sx={{ mb: 1.5, py: 0.5, fontSize: "0.8rem" }}>{erreur}</Alert>}

      {chargement ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress color="success" size={24} /></Box>
      ) : (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: "#fffbeb", borderLeft: "5px solid #f59e0b", borderRadius: 2 }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="#b45309" fontWeight="bold">Polymédication (≥ 3 médicaments)</Typography>
                      <Typography variant="h4" fontWeight="bold" color="#b45309">{stats.polymediques.length}</Typography>
                      <Typography variant="caption" color="text.secondary">Règle sémantique : COUNT médicaments ≥ 3</Typography>
                    </Box>
                    <Box sx={{ p: 1, bgcolor: "#fef3c7", borderRadius: "50%" }}>
                      <MedicationIcon fontSize="small" sx={{ color: "#d97706" }} />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: "#eff6ff", borderLeft: "5px solid #3b82f6", borderRadius: 2 }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="#1d4ed8" fontWeight="bold">Comorbidités multiples (≥ 2 pathologies)</Typography>
                      <Typography variant="h4" fontWeight="bold" color="#1d4ed8">{stats.pathologiesMultiples.length}</Typography>
                      <Typography variant="caption" color="text.secondary">Règle sémantique : COUNT pathologies ≥ 2</Typography>
                    </Box>
                    <Box sx={{ p: 1, bgcolor: "#dbeafe", borderRadius: "50%" }}>
                      <WarningIcon fontSize="small" sx={{ color: "#2563eb" }} />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{
                bgcolor: stats.interactions.length > 0 ? "#fef2f2" : "#f0fdf4",
                borderLeft: `5px solid ${stats.interactions.length > 0 ? "#dc2626" : "#16a34a"}`,
                borderRadius: 2,
              }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" fontWeight="bold"
                        color={stats.interactions.length > 0 ? "#dc2626" : "#16a34a"}>
                        Interactions médicamenteuses (requête croisée)
                      </Typography>
                      <Typography variant="h4" fontWeight="bold"
                        color={stats.interactions.length > 0 ? "#dc2626" : "#16a34a"}>
                        {stats.interactions.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Paires en interaction détectées</Typography>
                    </Box>
                    <Box sx={{ p: 1, bgcolor: stats.interactions.length > 0 ? "#fee2e2" : "#dcfce7", borderRadius: "50%" }}>
                      <ReportProblemIcon fontSize="small" sx={{ color: stats.interactions.length > 0 ? "#dc2626" : "#16a34a" }} />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {stats.interactions.length > 0 && (
            <Alert severity="error" icon={<ReportProblemIcon />} sx={{ border: "2px solid #dc2626" }}>
              <Typography variant="subtitle2" fontWeight="bold" color="error.dark" gutterBottom>
                Interactions médicamenteuses actives dans la base :
              </Typography>
              {stats.interactions.map((inter, idx) => (
                <Typography key={idx} variant="body2" sx={{ color: "#991b1b" }}>
                  • <strong>{inter.nomMedA || inter.medA}</strong> + <strong>{inter.nomMedB || inter.medB}</strong>
                  {inter.libelle ? ` : ${inter.libelle}` : ""} (Patient : {inter.nom})
                </Typography>
              ))}
              <Button component={Link} to="/prescriptions" size="small" color="error" variant="outlined" sx={{ mt: 1 }}>
  Voir les prescriptions
</Button>
            </Alert>
          )}

          {patientsVigilance.length > 0 && (
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="bold" color="#065f46">
                  Patients prioritaires pour revue thérapeutique ({patientsVigilance.length})
                </Typography>
                <Chip label="Requête SPARQL HAVING" color="success" size="small" variant="outlined" />
              </Stack>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#f0fdf4" }}>
                    <TableRow>
                      <TableCell sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>Patient</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>Statut Clinique</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>Médicaments</TableCell>
                      <TableCell sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>Pathologies</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.8rem", fontWeight: "bold" }}>Dossier</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientsVigilance.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{p.prenom} {p.nom}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            {p.alerte_poly && <Chip size="small" color="warning" label="Polymédiqué" />}
                            {p.alerte_patho && <Chip size="small" color="info" label="Comorbidités" />}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.8rem" }}>{p.nb_medicaments ?? "—"}</TableCell>
                        <TableCell sx={{ fontSize: "0.8rem" }}>{p.nb_pathologies ?? "—"}</TableCell>
                        <TableCell align="right">
                          <Button component={Link} to={`/patients/${p.id}`}
                            variant="outlined" color="success" size="small"
                            startIcon={<VisibilityIcon fontSize="small" />}
                            sx={{ fontSize: "0.75rem", py: 0.25 }}>
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
