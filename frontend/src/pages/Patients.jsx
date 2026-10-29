import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, FormControl, Grid, IconButton,
  InputAdornment, InputLabel, MenuItem, Paper, Select, Snackbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography
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
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";
import { useSoutenance } from "../context/SoutenanceContext.jsx";

const VUES = {
  tous: "/patients",
  polymedies: "/patients/polymedies",
  pathologies: "/patients/pathologie-multiple",
};

const FORMULAIRE_VIDE = { id: null, nom: "", prenom: "", age: "", medecin: "" };

function getInitials(prenom, nom) {
  const p = (prenom || "").trim()[0] || "";
  const n = (nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "P";
}

export default function Patients() {
  const navigate = useNavigate();
  const { modeSoutenance } = useSoutenance();

  const [vue, setVue] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");

  const [patients, setPatients] = useState([]);
  const [tousPatients, setTousPatients] = useState([]);
  const [refMedecins, setRefMedecins] = useState([]);
  const [sparql, setSparql] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);

  // Charger le référentiel des médecins pour le formulaire
  useEffect(() => {
    api.referentielMedecins()
      .then((res) => setRefMedecins(res.data || []))
      .catch(() => {});
  }, []);

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
    if (!formulaire.nom.trim()) return setErreur("Le nom de famille est obligatoire");
    if (formulaire.age === "" || !Number.isInteger(age) || age < 0 || age > 120)
      return setErreur("L'âge doit être un nombre entier compris entre 0 et 120");

    const corps = { nom: formulaire.nom.trim(), age };
    if (formulaire.prenom.trim()) corps.prenom = formulaire.prenom.trim();

    try {
      if (formulaire.id) {
        // Modification
        const res = await api.put(`/patients/${formulaire.id}`, corps);
        setMessage("Dossier patient mis à jour avec succès");
        setSparql(res.sparql);
        setFormulaire(null);
        setErreur("");
        charger();
      } else {
        // Création d'un nouveau patient
        const res = await api.post("/patients", corps);
        const nouveauId = res.data?.id;

        // Si un médecin traitant a été sélectionné, l'associer directement
        if (nouveauId && formulaire.medecin) {
          try {
            await api.assignerMedecin(nouveauId, formulaire.medecin);
          } catch {
            // tolérance si l'assignation échoue
          }
        }

        setFormulaire(null);
        setErreur("");

        // Ouvrir directement la fiche du patient nouvellement créé pour enrichir ses données
        if (nouveauId) {
          navigate(`/patients/${nouveauId}`);
        } else {
          charger();
        }
      }
    } catch (e) {
      setErreur(e.message);
    }
  };

  const supprimer = async () => {
    try {
      const res = await api.del(`/patients/${aSupprimer.id}`);
      setMessage("Patient supprimé avec succès");
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h4" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
            Liste des patients
          </Typography>
          <Typography variant="body1" color="#64748b" sx={{ mt: 0.3 }}>
            Gestion des dossiers patients et suivi des traitements
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="medium"
          startIcon={<AddIcon />}
          onClick={() => { setErreur(""); setFormulaire(FORMULAIRE_VIDE); }}
          sx={{
            bgcolor: "#065f46",
            "&:hover": { bgcolor: "#044e39" },
            fontSize: "0.92rem",
            px: 2.5,
            py: 1,
            borderRadius: 2.5,
            boxShadow: "0 2px 4px rgba(6,95,70,0.2)",
          }}
        >
          Nouveau patient
        </Button>
      </Stack>

      {/* Cartes récapitulatives avec vocabulaire clair */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setVue("tous")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: vue === "tous" ? "2px solid #065f46" : "1px solid #e2e8f0",
              bgcolor: vue === "tous" ? "#f0fdf4" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#065f46", transform: "translateY(-2px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                  Patients enregistrés
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#0f172a" sx={{ mt: 0.5 }}>
                  {totalGlobal}
                </Typography>
                <Typography variant="body2" color="#64748b" sx={{ mt: 0.3 }}>
                  Total des dossiers actifs
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#dcfce7", color: "#065f46", width: 48, height: 48 }}>
                <PeopleAltOutlinedIcon fontSize="medium" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setVue("polymedies")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: vue === "polymedies" ? "2px solid #d97706" : "1px solid #e2e8f0",
              bgcolor: vue === "polymedies" ? "#fffbeb" : "#ffffff",
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
                  <Tooltip title="Classe définie :PatientPolymedique déduite par le raisonneur HermiT ou règle SPARQL HAVING (≥ 3 médicaments)">
                    <InfoOutlinedIcon sx={{ fontSize: 15, color: "#d97706" }} />
                  </Tooltip>
                </Stack>
                <Typography variant="h4" fontWeight="800" color="#b45309" sx={{ mt: 0.5 }}>
                  {nbPolymediques}
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
            onClick={() => setVue("pathologies")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: vue === "pathologies" ? "2px solid #2563eb" : "1px solid #e2e8f0",
              bgcolor: vue === "pathologies" ? "#eff6ff" : "#ffffff",
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
                  <Tooltip title="Classe définie :PatientAPathologieMultiple déduite par HermiT (≥ 2 pathologies liées)">
                    <InfoOutlinedIcon sx={{ fontSize: 15, color: "#2563eb" }} />
                  </Tooltip>
                </Stack>
                <Typography variant="h4" fontWeight="800" color="#1d4ed8" sx={{ mt: 0.5 }}>
                  {nbPathoMultiples}
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
      </Grid>

      {/* Barre de recherche et filtres */}
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
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {/* Boutons de sélection rapide */}
          <Stack direction="row" spacing={1}>
            <Button
              variant={vue === "tous" ? "contained" : "outlined"}
              onClick={() => setVue("tous")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: vue === "tous" ? "#065f46" : "transparent",
                color: vue === "tous" ? "#ffffff" : "#475569",
                borderColor: "#cbd5e1",
                "&:hover": { bgcolor: vue === "tous" ? "#044e39" : "#f1f5f9" },
              }}
            >
              Tous ({totalGlobal})
            </Button>
            <Button
              variant={vue === "polymedies" ? "contained" : "outlined"}
              onClick={() => setVue("polymedies")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: vue === "polymedies" ? "#d97706" : "transparent",
                color: vue === "polymedies" ? "#ffffff" : "#b45309",
                borderColor: vue === "polymedies" ? "#d97706" : "#cbd5e1",
                "&:hover": { bgcolor: vue === "polymedies" ? "#b45309" : "#fef3c7" },
              }}
            >
              3 médicaments ou + ({nbPolymediques})
            </Button>
            <Button
              variant={vue === "pathologies" ? "contained" : "outlined"}
              onClick={() => setVue("pathologies")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: vue === "pathologies" ? "#2563eb" : "transparent",
                color: vue === "pathologies" ? "#ffffff" : "#1d4ed8",
                borderColor: vue === "pathologies" ? "#2563eb" : "#cbd5e1",
                "&:hover": { bgcolor: vue === "pathologies" ? "#1d4ed8" : "#dbeafe" },
              }}
            >
              Plusieurs maladies ({nbPathoMultiples})
            </Button>
          </Stack>

          {vue === "tous" && (
            <>
              {/* Champ de recherche */}
              <TextField
                placeholder="Rechercher un patient par nom ou prénom..."
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

              {/* Filtres d'âge */}
              <TextField
                placeholder="Âge min"
                type="number"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                sx={{
                  width: 105,
                  "& .MuiOutlinedInput-root": { borderRadius: 2.5, fontSize: "0.9rem", bgcolor: "#f8fafc" },
                }}
              />
              <TextField
                placeholder="Âge max"
                type="number"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                sx={{
                  width: 105,
                  "& .MuiOutlinedInput-root": { borderRadius: 2.5, fontSize: "0.9rem", bgcolor: "#f8fafc" },
                }}
              />
            </>
          )}
        </Stack>
      </Paper>

      {erreur && !formulaire && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontSize: "0.88rem" }}>
          {erreur}
        </Alert>
      )}

      {/* Tableau des patients */}
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
                Âge
              </TableCell>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Situation
              </TableCell>
              <TableCell align="right" sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chargement && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} sx={{ color: "#065f46" }} />
                  <Typography variant="body2" sx={{ display: "block", mt: 1.5, color: "#64748b" }}>
                    Chargement des dossiers patients...
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!chargement && patients.length === 0 && !erreur && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <Typography variant="body1" color="#64748b">
                    Aucun patient ne correspond à votre recherche.
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

                    {/* Âge */}
                    <TableCell sx={{ py: 1.5, fontSize: "0.92rem", color: "#334155", fontWeight: 600 }}>
                      {p.age !== undefined && p.age !== null ? `${p.age} ans` : "—"}
                    </TableCell>

                    {/* Situation */}
                    <TableCell sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
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
                        {!poly && !patho && (
                          <Chip
                            size="small"
                            icon={<CheckCircleOutlineIcon sx={{ fontSize: "16px !important", color: "#64748b" }} />}
                            label={`Standard (${p.nb_medicaments ?? 0} méd. · ${p.nb_pathologies ?? 0} mal.)`}
                            variant="outlined"
                            sx={{
                              fontSize: "0.78rem",
                              color: "#475569",
                              borderColor: "#cbd5e1",
                              height: 26,
                            }}
                          />
                        )}
                      </Stack>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end">
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

                        {p.age !== undefined && (
                          <Tooltip title="Modifier les informations (nom, prénom, âge)">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setErreur("");
                                setFormulaire({
                                  id: p.id,
                                  nom: p.nom,
                                  prenom: p.prenom ?? "",
                                  age: String(p.age),
                                  medecin: "",
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

                        <Tooltip title="Supprimer ce dossier patient">
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

      {/* Requête SPARQL (affichée selon le mode soutenance) */}
      <SparqlBox sparql={sparql} />

      {/* Modal Création / Modification avec champ Médecin traitant */}
      <Dialog
        open={!!formulaire}
        onClose={() => setFormulaire(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: "#065f46", color: "white", py: 2, px: 3, fontSize: "1.05rem", fontWeight: 700 }}>
          {formulaire?.id ? `Modifier le patient :${formulaire.id}` : "Nouveau patient"}
        </DialogTitle>
        <DialogContent sx={{ p: 3, mt: 1 }}>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            {erreur && (
              <Alert severity="error" sx={{ py: 0.75, fontSize: "0.88rem", borderRadius: 2 }}>
                {erreur}
              </Alert>
            )}

            <TextField
              label="Nom de famille"
              required
              fullWidth
              value={formulaire?.nom ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
              helperText="Champ obligatoire"
            />

            <TextField
              label="Prénom"
              fullWidth
              value={formulaire?.prenom ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })}
              helperText="Optionnel"
            />

            <TextField
              label="Âge"
              type="number"
              required
              fullWidth
              value={formulaire?.age ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, age: e.target.value })}
              helperText="Âge entre 0 et 120"
            />

            {/* Médecin traitant (disponible à la création pour enrichir le patient immédiatement) */}
            {!formulaire?.id && (
              <FormControl fullWidth>
                <InputLabel>Médecin traitant (optionnel)</InputLabel>
                <Select
                  value={formulaire?.medecin ?? ""}
                  label="Médecin traitant (optionnel)"
                  onChange={(e) => setFormulaire({ ...formulaire, medecin: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Aucun médecin pour le moment</em>
                  </MenuItem>
                  {refMedecins.map((med) => (
                    <MenuItem key={med.id} value={med.id}>
                      Dr. {med.nom} {med.prenom || ""} (:{med.id})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setFormulaire(null)} sx={{ textTransform: "none", color: "#64748b", fontSize: "0.9rem" }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={enregistrer}
            sx={{
              bgcolor: "#065f46",
              "&:hover": { bgcolor: "#044e39" },
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.92rem",
              borderRadius: 2,
              px: 3,
            }}
          >
            {formulaire?.id ? "Mettre à jour" : "Enregistrer et ouvrir la fiche"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Confirmation de suppression */}
      <Dialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: "#dc2626", fontSize: "1.05rem", fontWeight: 700 }}>
          Supprimer ce dossier patient ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.9rem", color: "#475569" }}>
            Êtes-vous sûr de vouloir supprimer le dossier de <strong>{aSupprimer?.nom} {aSupprimer?.prenom}</strong> (identifiant <code>:{aSupprimer?.id}</code>) ?
            <br />
            <br />
            <em>Remarque :</em> La suppression sera automatiquement refusée si une prescription médicale est rattachée à ce patient dans l'établissement.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setASupprimer(null)} sx={{ textTransform: "none", color: "#64748b", fontSize: "0.9rem" }}>
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={supprimer}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.9rem", borderRadius: 2 }}
          >
            Confirmer la suppression
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
