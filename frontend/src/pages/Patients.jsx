import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, IconButton, InputAdornment,
  Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography, Grid
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import MedicationOutlinedIcon from "@mui/icons-material/MedicationOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";

const VUES = {
  tous: "/patients",
  polymedies: "/patients/polymedies",
  pathologies: "/patients/pathologie-multiple",
};

const FORMULAIRE_VIDE = { id: null, nom: "", prenom: "", age: "" };

function getInitials(prenom, nom) {
  const p = (prenom || "").trim()[0] || "";
  const n = (nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "P";
}

export default function Patients() {
  const [vue, setVue] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");

  const [patients, setPatients] = useState([]);
  const [tousPatients, setTousPatients] = useState([]);
  const [sparql, setSparql] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);

  // Charger les données de la vue courante
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      let url = VUES[vue];
      if (vue === "tous") {
        const params = new URLSearchParams();
        if (recherche.trim()) params.set("q", recherche.trim());
        if (ageMin !== "") params.set("age_min", ageMin);
        if (ageMax !== "") params.set("age_max", ageMax);
        const suffixe = params.toString();
        if (suffixe) url += "?" + suffixe;
      }
      const reponse = await api.get(url);
      setPatients(reponse.data);
      setSparql(reponse.sparql);

      // Si vue = tous sans filtre, garder la liste pour calculer les KPIs
      if (vue === "tous" && !recherche && !ageMin && !ageMax) {
        setTousPatients(reponse.data);
      }
    } catch (e) {
      setErreur(e.message);
      setPatients([]);
    } finally {
      setChargement(false);
    }
  }, [vue, recherche, ageMin, ageMax]);

  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
  }, [charger]);

  // Calcul des métriques globales
  const totalGlobal = tousPatients.length || patients.length;
  const nbPolymediques = (tousPatients.length ? tousPatients : patients).filter(
    (p) => (p.nb_medicaments ?? 0) >= 3
  ).length;
  const nbPathoMultiples = (tousPatients.length ? tousPatients : patients).filter(
    (p) => (p.nb_pathologies ?? 0) >= 2
  ).length;

  const enregistrer = async () => {
    const age = Number(formulaire.age);
    if (!formulaire.nom.trim()) return setErreur("Le nom est obligatoire");
    if (formulaire.age === "" || !Number.isInteger(age) || age < 0 || age > 120)
      return setErreur("L'âge doit être un entier entre 0 et 120 (axiome OWL :age [0-120])");

    const corps = { nom: formulaire.nom.trim(), age };
    if (formulaire.prenom.trim()) corps.prenom = formulaire.prenom.trim();
    try {
      if (formulaire.id) {
        const res = await api.put(`/patients/${formulaire.id}`, corps);
        setMessage("Dossier patient mis à jour avec succès dans Fuseki");
        setSparql(res.sparql);
      } else {
        const res = await api.post("/patients", corps);
        setMessage("Nouveau patient inséré avec succès (INSERT DATA)");
        setSparql(res.sparql);
      }
      setFormulaire(null);
      setErreur("");
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const supprimer = async () => {
    try {
      const res = await api.del(`/patients/${aSupprimer.id}`);
      setMessage("Patient supprimé du graphe RDF");
      setSparql(res.sparql);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e.message);
      setASupprimer(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      {/* En-tête de page */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="700" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
            Dossiers Patients
          </Typography>
          <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem", mt: 0.2 }}>
            Registre clinique sémantique · Ontologie OWL & Apache Jena Fuseki
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setErreur(""); setFormulaire(FORMULAIRE_VIDE); }}
          sx={{
            bgcolor: "#065f46",
            "&:hover": { bgcolor: "#044e39" },
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            px: 2,
            py: 0.9,
            borderRadius: 2,
            boxShadow: "0 2px 4px rgba(6,95,70,0.2)",
          }}
        >
          Nouveau Patient
        </Button>
      </Stack>

      {/* Cartes KPI synthétiques */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setVue("tous")}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: vue === "tous" ? "2px solid #065f46" : "1px solid #e2e8f0",
              bgcolor: vue === "tous" ? "#f0fdf4" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#065f46", transform: "translateY(-1px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}>
                  Total Dossiers
                </Typography>
                <Typography variant="h5" fontWeight="700" color="#0f172a" sx={{ mt: 0.5 }}>
                  {totalGlobal}
                </Typography>
                <Typography variant="caption" color="#64748b" sx={{ fontSize: "0.72rem" }}>
                  Tous les individus <code>:Patient</code>
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#dcfce7", color: "#065f46", width: 44, height: 44 }}>
                <PeopleAltOutlinedIcon fontSize="small" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setVue("polymedies")}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: vue === "polymedies" ? "2px solid #d97706" : "1px solid #e2e8f0",
              bgcolor: vue === "polymedies" ? "#fffbeb" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#d97706", transform: "translateY(-1px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}>
                  Polymédiqués (≥ 3 méd.)
                </Typography>
                <Typography variant="h5" fontWeight="700" color="#b45309" sx={{ mt: 0.5 }}>
                  {nbPolymediques}
                </Typography>
                <Typography variant="caption" color="#78350f" sx={{ fontSize: "0.72rem" }}>
                  Classe <code>:PatientPolymedique</code>
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#fef3c7", color: "#d97706", width: 44, height: 44 }}>
                <MedicationOutlinedIcon fontSize="small" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setVue("pathologies")}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: vue === "pathologies" ? "2px solid #2563eb" : "1px solid #e2e8f0",
              bgcolor: vue === "pathologies" ? "#eff6ff" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#2563eb", transform: "translateY(-1px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: "#1d4ed8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}>
                  Comorbidités (≥ 2 path.)
                </Typography>
                <Typography variant="h5" fontWeight="700" color="#1d4ed8" sx={{ mt: 0.5 }}>
                  {nbPathoMultiples}
                </Typography>
                <Typography variant="caption" color="#1e40af" sx={{ fontSize: "0.72rem" }}>
                  Classe <code>:PatientAPathologieMultiple</code>
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#dbeafe", color: "#2563eb", width: 44, height: 44 }}>
                <WarningAmberOutlinedIcon fontSize="small" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Barre de recherche et filtres */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 2.5,
          border: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {/* Sélecteur de vue */}
          <Stack direction="row" spacing={0.75}>
            <Button
              size="small"
              variant={vue === "tous" ? "contained" : "outlined"}
              onClick={() => setVue("tous")}
              sx={{
                borderRadius: 2,
                fontSize: "0.76rem",
                textTransform: "none",
                fontWeight: 600,
                px: 1.75,
                bgcolor: vue === "tous" ? "#065f46" : "transparent",
                color: vue === "tous" ? "#ffffff" : "#475569",
                borderColor: "#cbd5e1",
                "&:hover": { bgcolor: vue === "tous" ? "#044e39" : "#f1f5f9" },
              }}
            >
              Tous ({totalGlobal})
            </Button>
            <Button
              size="small"
              variant={vue === "polymedies" ? "contained" : "outlined"}
              onClick={() => setVue("polymedies")}
              sx={{
                borderRadius: 2,
                fontSize: "0.76rem",
                textTransform: "none",
                fontWeight: 600,
                px: 1.75,
                bgcolor: vue === "polymedies" ? "#d97706" : "transparent",
                color: vue === "polymedies" ? "#ffffff" : "#b45309",
                borderColor: vue === "polymedies" ? "#d97706" : "#cbd5e1",
                "&:hover": { bgcolor: vue === "polymedies" ? "#b45309" : "#fef3c7" },
              }}
            >
              Polymédiqués ({nbPolymediques})
            </Button>
            <Button
              size="small"
              variant={vue === "pathologies" ? "contained" : "outlined"}
              onClick={() => setVue("pathologies")}
              sx={{
                borderRadius: 2,
                fontSize: "0.76rem",
                textTransform: "none",
                fontWeight: 600,
                px: 1.75,
                bgcolor: vue === "pathologies" ? "#2563eb" : "transparent",
                color: vue === "pathologies" ? "#ffffff" : "#1d4ed8",
                borderColor: vue === "pathologies" ? "#2563eb" : "#cbd5e1",
                "&:hover": { bgcolor: vue === "pathologies" ? "#1d4ed8" : "#dbeafe" },
              }}
            >
              Comorbidités ({nbPathoMultiples})
            </Button>
          </Stack>

          {vue === "tous" && (
            <>
              {/* Champ de recherche */}
              <TextField
                size="small"
                placeholder="Rechercher par nom ou prénom..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "#94a3b8", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  endAdornment: recherche && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setRecherche("")}>
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flexGrow: 1,
                  minWidth: 220,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    fontSize: "0.8rem",
                    bgcolor: "#f8fafc",
                  },
                }}
              />

              {/* Filtres d'âge */}
              <TextField
                size="small"
                placeholder="Âge min"
                type="number"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                sx={{
                  width: 95,
                  "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.8rem", bgcolor: "#f8fafc" },
                }}
              />
              <TextField
                size="small"
                placeholder="Âge max"
                type="number"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                sx={{
                  width: 95,
                  "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.8rem", bgcolor: "#f8fafc" },
                }}
              />
            </>
          )}
        </Stack>
      </Paper>

      {erreur && !formulaire && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>
          {erreur}
        </Alert>
      )}

      {/* Tableau des patients */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                Patient
              </TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                URI Ontologique
              </TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                Âge
              </TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                Statut Ontologique (Règle HermiT / HAVING)
              </TableCell>
              <TableCell align="right" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, py: 1.5 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chargement && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} sx={{ color: "#065f46" }} />
                  <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#64748b" }}>
                    Interrogation d'Apache Jena Fuseki...
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!chargement && patients.length === 0 && !erreur && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="#64748b">
                    Aucun dossier patient ne correspond à ces critères.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!chargement &&
              patients.map((p) => {
                const poly = (p.nb_medicaments ?? 0) >= 3;
                const patho = (p.nb_pathologies ?? 0) >= 2;
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
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            bgcolor: poly ? "#fef3c7" : patho ? "#dbeafe" : "#f1f5f9",
                            color: poly ? "#b45309" : patho ? "#1d4ed8" : "#475569",
                          }}
                        >
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a", fontSize: "0.82rem" }}>
                            {p.nom} {p.prenom || ""}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    {/* URI */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Chip
                        size="small"
                        label={`:${p.id}`}
                        variant="outlined"
                        sx={{
                          fontSize: "0.7rem",
                          fontFamily: "monospace",
                          bgcolor: "#f8fafc",
                          borderColor: "#cbd5e1",
                          color: "#334155",
                          height: 22,
                        }}
                      />
                    </TableCell>

                    {/* Âge */}
                    <TableCell sx={{ py: 1.25, fontSize: "0.8rem", color: "#334155", fontWeight: 500 }}>
                      {p.age !== undefined && p.age !== null ? `${p.age} ans` : "—"}
                    </TableCell>

                    {/* Statut Ontologique */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                        {poly && (
                          <Chip
                            size="small"
                            icon={<MedicationOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                            label={`Polymédiqué (${p.nb_medicaments} méd.)`}
                            sx={{
                              bgcolor: "#fef3c7",
                              color: "#b45309",
                              fontWeight: 600,
                              fontSize: "0.72rem",
                              height: 24,
                              border: "1px solid #fde68a",
                            }}
                          />
                        )}
                        {patho && (
                          <Chip
                            size="small"
                            icon={<WarningAmberOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                            label={`Comorbidités (${p.nb_pathologies} path.)`}
                            sx={{
                              bgcolor: "#dbeafe",
                              color: "#1d4ed8",
                              fontWeight: 600,
                              fontSize: "0.72rem",
                              height: 24,
                              border: "1px solid #bfdbfe",
                            }}
                          />
                        )}
                        {!poly && !patho && (
                          <Chip
                            size="small"
                            icon={<CheckCircleOutlineIcon sx={{ fontSize: "14px !important", color: "#64748b" }} />}
                            label={`Standard (${p.nb_medicaments ?? 0} méd. · ${p.nb_pathologies ?? 0} path.)`}
                            variant="outlined"
                            sx={{
                              fontSize: "0.72rem",
                              color: "#475569",
                              borderColor: "#cbd5e1",
                              height: 24,
                            }}
                          />
                        )}
                      </Stack>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right" sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Ouvrir la fiche et gérer les relations sémantiques">
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

                        {p.age !== undefined && (
                          <Tooltip title="Modifier les attributs simples (nom, prénom, âge)">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setErreur("");
                                setFormulaire({
                                  id: p.id,
                                  nom: p.nom,
                                  prenom: p.prenom ?? "",
                                  age: String(p.age),
                                });
                              }}
                              sx={{
                                color: "#475569",
                                bgcolor: "#f1f5f9",
                                "&:hover": { bgcolor: "#e2e8f0" },
                              }}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Supprimer (vérifie la contrainte d'intégrité OWL)">
                          <IconButton
                            size="small"
                            onClick={() => setASupprimer(p)}
                            sx={{
                              color: "#dc2626",
                              bgcolor: "#fef2f2",
                              "&:hover": { bgcolor: "#fee2e2" },
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Box SPARQL repliable élégante */}
      <SparqlBox sparql={sparql} />

      {/* Modal Création / Modification */}
      <Dialog
        open={!!formulaire}
        onClose={() => setFormulaire(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: "#065f46", color: "white", py: 1.75, px: 2.5, fontSize: "0.95rem", fontWeight: 600 }}>
          {formulaire?.id ? `Modifier le patient :${formulaire.id}` : "Nouveau Patient (INSERT DATA)"}
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, mt: 1 }}>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {erreur && (
              <Alert severity="error" sx={{ py: 0.5, fontSize: "0.8rem", borderRadius: 2 }}>
                {erreur}
              </Alert>
            )}
            <TextField
              label="Nom de famille"
              required
              fullWidth
              size="small"
              value={formulaire?.nom ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
            />
            <TextField
              label="Prénom"
              fullWidth
              size="small"
              value={formulaire?.prenom ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })}
            />
            <TextField
              label="Âge (0 à 120)"
              type="number"
              required
              fullWidth
              size="small"
              value={formulaire?.age ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, age: e.target.value })}
              helperText="Axiome OWL : xsd:integer [0-120]"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setFormulaire(null)} sx={{ textTransform: "none", color: "#64748b" }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={enregistrer}
            sx={{
              bgcolor: "#065f46",
              "&:hover": { bgcolor: "#044e39" },
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            {formulaire?.id ? "Mettre à jour" : "Insérer dans Fuseki"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Confirmation de suppression */}
      <Dialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: "#dc2626", fontSize: "0.95rem", fontWeight: 600 }}>
          Confirmer la suppression du patient ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.82rem", color: "#475569" }}>
            Tous les triplets décrivant <strong>:{aSupprimer?.id}</strong> ({aSupprimer?.nom}{" "}
            {aSupprimer?.prenom}) seront supprimés du graphe Fuseki via une requête{" "}
            <code>DELETE WHERE</code>.
            <br />
            <br />
            <em>Contrainte ontologique :</em> La suppression sera bloquée si une Prescription pointe vers
            ce patient (axiome <code>:pourPatient exactly 1 :Patient</code>).
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setASupprimer(null)} sx={{ textTransform: "none", color: "#64748b" }}>
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={supprimer}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
          >
            Supprimer définitivement
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!message}
        autoHideDuration={3000}
        onClose={() => setMessage("")}
        message={message}
      />
    </Box>
  );
}
