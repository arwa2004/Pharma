import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, FormControl, FormControlLabel, Grid, IconButton, InputAdornment,
  InputLabel, MenuItem, Paper, Select, Snackbar, Stack, Switch, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography, Tabs, Tab
} from "@mui/material";
import MedicationIcon from "@mui/icons-material/Medication";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import BusinessIcon from "@mui/icons-material/Business";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ScienceIcon from "@mui/icons-material/Science";
import FilterListIcon from "@mui/icons-material/FilterList";

import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";

const FORM_MED_VIDE = {
  nomCommercial: "",
  codeAMM: "",
  dosageMg: "",
  surOrdonnance: true,
  idLaboratoire: "",
  idForme: "",
  idVoie: "",
  idClasse: "",
  molecules: [],
  excipients: [],
};

const FORM_LAB_VIDE = {
  nom: "",
  pays: "Tunisie",
  adresse: "",
};

export default function Medicaments() {
  const navigate = useNavigate();

  // Onglet courant : "tous", "ordonnance", "libre", "contre_indication"
  const [onglet, setOnglet] = useState("tous");

  // Filtres
  const [recherche, setRecherche] = useState("");
  const [dosageMin, setDosageMin] = useState("");
  const [dosageMax, setDosageMax] = useState("");
  const [filtreLabo, setFiltreLabo] = useState("");
  const [filtreForme, setFiltreForme] = useState("");
  const [filtreClasse, setFiltreClasse] = useState("");
  const [filtreMolecule, setFiltreMolecule] = useState("");

  // Données
  const [medicaments, setMedicaments] = useState([]);
  const [stats, setStats] = useState({ total: 0, ordonnance: 0, libre: 0, ciAbsolue: 0, labos: 0 });
  const [sparql, setSparql] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  // Référentiels pour formulaires et filtres
  const [refMolecules, setRefMolecules] = useState([]);
  const [refFormes, setRefFormes] = useState([]);
  const [refVoies, setRefVoies] = useState([]);
  const [refClasses, setRefClasses] = useState([]);
  const [refLabos, setRefLabos] = useState([]);
  const [refExcipients, setRefExcipients] = useState([]);

  // Modales
  const [dialogMedOuvert, setDialogMedOuvert] = useState(false);
  const [formMed, setFormMed] = useState(FORM_MED_VIDE);
  const [editionId, setEditionId] = useState(null);

  const [dialogLabOuvert, setDialogLabOuvert] = useState(false);
  const [listeLabos, setListeLabos] = useState([]);
  const [formLab, setFormLab] = useState(FORM_LAB_VIDE);
  const [editionLabId, setEditionLabId] = useState(null);

  const [aSupprimer, setASupprimer] = useState(null);

  // Charger les référentiels une seule fois au montage
  useEffect(() => {
    async function chargerReferentiels() {
      try {
        const [mols, frms, voies, clss, labs, excs] = await Promise.all([
          api.referentielMolecules(),
          api.referentielFormes(),
          api.referentielVoies(),
          api.referentielClasses(),
          api.referentielLaboratoires(),
          api.referentielExcipients(),
        ]);
        setRefMolecules(mols.data || []);
        setRefFormes(frms.data || []);
        setRefVoies(voies.data || []);
        setRefClasses(clss.data || []);
        setRefLabos(labs.data || []);
        setRefExcipients(excs.data || []);
      } catch (e) {
        console.error("Erreur de chargement des référentiels:", e);
      }
    }
    chargerReferentiels();
  }, []);

  // Charger la liste des médicaments selon les filtres et l'onglet
  const chargerMedicaments = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      if (onglet === "contre_indication") {
        const res = await api.listerMedicamentsContreIndicationAbsolue();
        setMedicaments(res.data || []);
        setSparql(res.sparql || "");
      } else {
        const params = {};
        if (recherche.trim()) params.q = recherche.trim();
        if (dosageMin !== "") params.dosage_min = dosageMin;
        if (dosageMax !== "") params.dosage_max = dosageMax;
        if (filtreLabo) params.laboratoire = filtreLabo;
        if (filtreForme) params.forme = filtreForme;
        if (filtreClasse) params.classe = filtreClasse;
        if (filtreMolecule) params.molecule = filtreMolecule;

        if (onglet === "ordonnance") params.sur_ordonnance = true;
        if (onglet === "libre") params.sur_ordonnance = false;

        const res = await api.listerMedicaments(params);
        setMedicaments(res.data || []);
        setSparql(res.sparql || "");
      }

      // Mise à jour des stats globales si pas de filtre complexe
      const tous = await api.listerMedicaments();
      if (tous.data) {
        const ord = tous.data.filter((m) => m.surOrdonnance).length;
        const ci = tous.data.filter((m) => m.estContreIndicationAbsolue).length;
        const labs = new Set(tous.data.map((m) => m.nomLabo).filter(Boolean)).size;
        setStats({
          total: tous.data.length,
          ordonnance: ord,
          libre: tous.data.length - ord,
          ciAbsolue: ci,
          labos: labs,
        });
      }
    } catch (e) {
      setErreur(e.message);
      setMedicaments([]);
    } finally {
      setChargement(false);
    }
  }, [onglet, recherche, dosageMin, dosageMax, filtreLabo, filtreForme, filtreClasse, filtreMolecule]);

  useEffect(() => {
    chargerMedicaments();
  }, [chargerMedicaments]);

  // Gestion des Laboratoires
  const chargerLaboratoires = async () => {
    try {
      const res = await api.listerLaboratoires();
      setListeLabos(res.data || []);
    } catch (e) {
      setErreur("Erreur chargement labos: " + e.message);
    }
  };

  const handleOuvrirLabos = () => {
    chargerLaboratoires();
    setFormLab(FORM_LAB_VIDE);
    setEditionLabId(null);
    setDialogLabOuvert(true);
  };

  const handleSauvegarderLab = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (editionLabId) {
        res = await api.modifierLaboratoire(editionLabId, formLab);
      } else {
        res = await api.creerLaboratoire(formLab);
      }
      setMessage(res.data?.message || "Laboratoire enregistré");
      setSparql(res.sparql);
      setFormLab(FORM_LAB_VIDE);
      setEditionLabId(null);
      chargerLaboratoires();
      // Rafraîchir le référentiel des labos
      const labs = await api.referentielLaboratoires();
      setRefLabos(labs.data || []);
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleSupprimerLab = async (idLab) => {
    if (!window.confirm(`Supprimer le laboratoire ${idLab} ?`)) return;
    try {
      const res = await api.supprimerLaboratoire(idLab);
      setMessage(res.data?.message || "Laboratoire supprimé");
      setSparql(res.sparql);
      chargerLaboratoires();
      const labs = await api.referentielLaboratoires();
      setRefLabos(labs.data || []);
    } catch (e) {
      setErreur(e.message);
    }
  };

  // Gestion de la création / modification Médicament
  const handleOuvrirNouveauMed = () => {
    setFormMed(FORM_MED_VIDE);
    setEditionId(null);
    setDialogMedOuvert(true);
  };

  const handleOuvrirEditionMed = (med) => {
    setEditionId(med.id);
    setFormMed({
      nomCommercial: med.nomCommercial || "",
      codeAMM: med.codeAMM || "",
      dosageMg: med.dosageMg || "",
      surOrdonnance: Boolean(med.surOrdonnance),
      idLaboratoire: med.idLabo || "",
      idForme: med.idForme || "",
      idVoie: med.idVoie || "",
      idClasse: med.idClasse || "",
      molecules: [],
      excipients: [],
    });
    setDialogMedOuvert(true);
  };

  const handleSauvegarderMed = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (editionId) {
        res = await api.modifierMedicament(editionId, {
          nomCommercial: formMed.nomCommercial,
          codeAMM: formMed.codeAMM,
          dosageMg: parseFloat(formMed.dosageMg),
          surOrdonnance: formMed.surOrdonnance,
          idLaboratoire: formMed.idLaboratoire,
          idForme: formMed.idForme,
          idVoie: formMed.idVoie,
          idClasse: formMed.idClasse,
        });
      } else {
        res = await api.creerMedicament({
          ...formMed,
          dosageMg: parseFloat(formMed.dosageMg),
        });
      }
      setMessage(res.data?.message || "Médicament enregistré avec succès");
      setSparql(res.sparql);
      setDialogMedOuvert(false);
      chargerMedicaments();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleSupprimerMed = async () => {
    if (!aSupprimer) return;
    try {
      const res = await api.supprimerMedicament(aSupprimer.id);
      setMessage(res.data?.message || `Médicament ${aSupprimer.id} supprimé.`);
      setSparql(res.sparql);
      setASupprimer(null);
      chargerMedicaments();
    } catch (e) {
      setErreur(e.message);
      setASupprimer(null);
    }
  };

  const reinitialiserFiltres = () => {
    setRecherche("");
    setDosageMin("");
    setDosageMax("");
    setFiltreLabo("");
    setFiltreForme("");
    setFiltreClasse("");
    setFiltreMolecule("");
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      {/* En-tête */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" fontWeight="700" color="#0f172a">
              Médicaments & Composition
            </Typography>
            <Chip
              label=" Domaine Ontologique "
              size="small"
              sx={{ bgcolor: "#059669", color: "#fff", fontWeight: 600, fontSize: "0.75rem" }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Ontologie OWL : Formes galéniques, principes actifs, excipients, laboratoires et classes thérapeutiques.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<BusinessIcon />}
            onClick={handleOuvrirLabos}
            sx={{ borderColor: "#cbd5e1", color: "#334155", textTransform: "none" }}
          >
            Laboratoires
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOuvrirNouveauMed}
            sx={{ bgcolor: "#059669", "&:hover": { bgcolor: "#047857" }, textTransform: "none", fontWeight: 600 }}
          >
            Nouveau Médicament
          </Button>
        </Stack>
      </Stack>

      {/* Cartes KPI */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  TOTAL MÉDICAMENTS
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#0f172a" sx={{ mt: 0.5 }}>
                  {stats.total}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#ecfdf5", color: "#059669", width: 44, height: 44 }}>
                <MedicationIcon />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  SUR ORDONNANCE
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#1e40af" sx={{ mt: 0.5 }}>
                  {stats.ordonnance}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#eff6ff", color: "#2563eb", width: 44, height: 44 }}>
                <CheckCircleOutlineIcon />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  VENTE LIBRE
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#047857" sx={{ mt: 0.5 }}>
                  {stats.libre}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#f0fdf4", color: "#16a34a", width: 44, height: 44 }}>
                <ScienceIcon />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2, border: "1px solid #fee2e2", bgcolor: "#fff5f5" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="#b91c1c" fontWeight="600">
                  CLASSE DÉFINIE (CI ABS.)
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#b91c1c" sx={{ mt: 0.5 }}>
                  {stats.ciAbsolue}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#fef2f2", color: "#dc2626", width: 44, height: 44 }}>
                <WarningAmberIcon />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  LABORATOIRES
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#6b21a8" sx={{ mt: 0.5 }}>
                  {stats.labos}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#faf5ff", color: "#9333ea", width: 44, height: 44 }}>
                <BusinessIcon />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Barre de navigation par onglets */}
      <Paper sx={{ mb: 2.5, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
        <Tabs
          value={onglet}
          onChange={(_, val) => setOnglet(val)}
          sx={{
            px: 2,
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.85rem" },
            "& .Mui-selected": { color: "#059669" },
            "& .MuiTabs-indicator": { bgcolor: "#059669" },
          }}
        >
          <Tab value="tous" label="Tous les Médicaments" />
          <Tab value="ordonnance" label="Sur Ordonnance" />
          <Tab value="libre" label="Sans Ordonnance (Vente libre)" />
          <Tab
            value="contre_indication"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Contre-indication Absolue</span>
                <Chip label="HermiT" size="small" sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#fee2e2", color: "#b91c1c" }} />
              </Stack>
            }
          />
        </Tabs>
      </Paper>

      {/* Barre de recherche et filtres combinés */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3.5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher par nom (ex: Doliprane, Clamoxyl)..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
                endAdornment: recherche ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setRecherche("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>

          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Dosage Min (mg)"
              value={dosageMin}
              onChange={(e) => setDosageMin(e.target.value)}
            />
          </Grid>

          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Dosage Max (mg)"
              value={dosageMax}
              onChange={(e) => setDosageMax(e.target.value)}
            />
          </Grid>

          <Grid item xs={6} md={2.25}>
            <FormControl fullWidth size="small">
              <InputLabel>Laboratoire</InputLabel>
              <Select
                value={filtreLabo}
                label="Laboratoire"
                onChange={(e) => setFiltreLabo(e.target.value)}
              >
                <MenuItem value="">Tous les laboratoires</MenuItem>
                {refLabos.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.nom}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} md={2.25}>
            <FormControl fullWidth size="small">
              <InputLabel>Forme Galénique</InputLabel>
              <Select
                value={filtreForme}
                label="Forme Galénique"
                onChange={(e) => setFiltreForme(e.target.value)}
              >
                <MenuItem value="">Toutes les formes</MenuItem>
                {refFormes.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.libelle}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {(recherche || dosageMin || dosageMax || filtreLabo || filtreForme || filtreClasse || filtreMolecule) && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Filtres actifs :
            </Typography>
            <Button size="small" onClick={reinitialiserFiltres} sx={{ textTransform: "none", fontSize: "0.75rem", p: 0 }}>
              Réinitialiser tous les filtres
            </Button>
          </Stack>
        )}
      </Paper>

      {/* Messages et alertes */}
      {erreur && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErreur("")}>
          {erreur}
        </Alert>
      )}

      {/* Tableau des médicaments */}
      <Paper sx={{ borderRadius: 2, border: "1px solid #e2e8f0", overflow: "hidden" }} elevation={0}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: "700", color: "#475569", fontSize: "0.78rem" }}>MÉDICAMENT</TableCell>
                <TableCell sx={{ fontWeight: "700", color: "#475569", fontSize: "0.78rem" }}>DOSAGE (MG)</TableCell>
                <TableCell sx={{ fontWeight: "700", color: "#475569", fontSize: "0.78rem" }}>STATUT PRESCRIPTION</TableCell>
                <TableCell sx={{ fontWeight: "700", color: "#475569", fontSize: "0.78rem" }}>FORME & VOIE</TableCell>
                <TableCell sx={{ fontWeight: "700", color: "#475569", fontSize: "0.78rem" }}>CLASSE THÉRAPEUTIQUE</TableCell>
                <TableCell sx={{ fontWeight: "700", color: "#475569", fontSize: "0.78rem" }}>LABORATOIRE</TableCell>
                <TableCell align="right" sx={{ fontWeight: "700", color: "#475569", fontSize: "0.78rem" }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {chargement ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: "#059669" }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Interrogation SPARQL du triple store Fuseki...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : medicaments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <MedicationIcon sx={{ fontSize: 48, color: "#cbd5e1", mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight="600" color="#334155">
                      Aucun médicament trouvé
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Essayez d'ajuster vos filtres de recherche ou ajoutez un nouveau médicament.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                medicaments.map((m) => {
                  const estCI = Boolean(m.estContreIndicationAbsolue || m.contreIndicationLibelle);
                  return (
                    <TableRow key={m.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ bgcolor: "#ecfdf5", color: "#059669", width: 36, height: 36 }}>
                            <MedicationIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography
                              component={Link}
                              to={`/medicaments/${m.id}`}
                              variant="subtitle2"
                              fontWeight="700"
                              color="#0f172a"
                              sx={{ textDecoration: "none", "&:hover": { color: "#059669" } }}
                            >
                              {m.nomCommercial || m.id}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.2 }}>
                              <Typography variant="caption" color="text.secondary">
                                :{m.id}
                              </Typography>
                              {m.codeAMM && (
                                <Typography variant="caption" sx={{ color: "#64748b" }}>
                                  · {m.codeAMM}
                                </Typography>
                              )}
                              {estCI && (
                                <Tooltip title="Classe Définie HermiT : Médicament à contre-indication absolue">
                                  <Chip
                                    icon={<WarningAmberIcon sx={{ "&&": { color: "#dc2626", fontSize: 14 } }} />}
                                    label="CI Absolue"
                                    size="small"
                                    sx={{ height: 20, fontSize: "0.68rem", bgcolor: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}
                                  />
                                </Tooltip>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" fontWeight="700" color="#0f172a">
                          {m.dosageMg !== undefined ? `${m.dosageMg} mg` : "—"}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        {m.surOrdonnance || m.typeLibelle === "Sur ordonnance" ? (
                          <Chip
                            label="Sur ordonnance"
                            size="small"
                            sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 600, fontSize: "0.72rem" }}
                          />
                        ) : (
                          <Chip
                            label="Sans ordonnance"
                            size="small"
                            sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 600, fontSize: "0.72rem" }}
                          />
                        )}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" color="#1e293b">
                          {m.formeLibelle || "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.voieLibelle || ""}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" color="#1e293b">
                          {m.classeLibelle || "—"}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" color="#1e293b" fontWeight="500">
                          {m.nomLabo || "—"}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Fiche détaillée et composition">
                            <IconButton size="small" component={Link} to={`/medicaments/${m.id}`}>
                              <VisibilityOutlinedIcon fontSize="small" sx={{ color: "#64748b" }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Modifier">
                            <IconButton size="small" onClick={() => handleOuvrirEditionMed(m)}>
                              <EditOutlinedIcon fontSize="small" sx={{ color: "#64748b" }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" onClick={() => setASupprimer(m)}>
                              <DeleteOutlineIcon fontSize="small" sx={{ color: "#ef4444" }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Boîte SPARQL de transparence */}
      <Box sx={{ mt: 3 }}>
        <SparqlBox
          sparql={sparql}
          titre="Requête SPARQL Exécutée (Domaine A - Médicaments)"
        />
      </Box>

      {/* Dialog Nouveau / Modifier Médicament */}
      <Dialog open={dialogMedOuvert} onClose={() => setDialogMedOuvert(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSauvegarderMed}>
          <DialogTitle sx={{ fontWeight: "700" }}>
            {editionId ? `Modifier le médicament : ${formMed.nomCommercial}` : "Ajouter un nouveau médicament"}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  required
                  label="Nom Commercial"
                  placeholder="ex: Paracétamol Doliprane"
                  value={formMed.nomCommercial}
                  onChange={(e) => setFormMed({ ...formMed, nomCommercial: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Dosage (en mg)"
                  placeholder="ex: 1000"
                  value={formMed.dosageMg}
                  onChange={(e) => setFormMed({ ...formMed, dosageMg: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Code AMM"
                  placeholder="ex: AMM-3400941-PARA"
                  value={formMed.codeAMM}
                  onChange={(e) => setFormMed({ ...formMed, codeAMM: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formMed.surOrdonnance}
                      onChange={(e) => setFormMed({ ...formMed, surOrdonnance: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={formMed.surOrdonnance ? "Soumis à ordonnance médicale" : "Vente libre (sans ordonnance)"}
                  sx={{ mt: 1 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Laboratoire Fabricant</InputLabel>
                  <Select
                    value={formMed.idLaboratoire}
                    label="Laboratoire Fabricant"
                    onChange={(e) => setFormMed({ ...formMed, idLaboratoire: e.target.value })}
                  >
                    <MenuItem value="">-- Aucun laboratoire --</MenuItem>
                    {refLabos.map((l) => (
                      <MenuItem key={l.id} value={l.id}>
                        {l.nom} ({l.pays})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Forme Galénique</InputLabel>
                  <Select
                    value={formMed.idForme}
                    label="Forme Galénique"
                    onChange={(e) => setFormMed({ ...formMed, idForme: e.target.value })}
                  >
                    <MenuItem value="">-- Aucune forme --</MenuItem>
                    {refFormes.map((f) => (
                      <MenuItem key={f.id} value={f.id}>
                        {f.libelle}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Voie d'administration</InputLabel>
                  <Select
                    value={formMed.idVoie}
                    label="Voie d'administration"
                    onChange={(e) => setFormMed({ ...formMed, idVoie: e.target.value })}
                  >
                    <MenuItem value="">-- Aucune voie --</MenuItem>
                    {refVoies.map((v) => (
                      <MenuItem key={v.id} value={v.id}>
                        {v.libelle}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Classe Thérapeutique</InputLabel>
                  <Select
                    value={formMed.idClasse}
                    label="Classe Thérapeutique"
                    onChange={(e) => setFormMed({ ...formMed, idClasse: e.target.value })}
                  >
                    <MenuItem value="">-- Aucune classe --</MenuItem>
                    {refClasses.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.libelle} {c.parentLibelle ? `(${c.parentLibelle})` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {!editionId && (
                <>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Molécules / Principes Actifs</InputLabel>
                      <Select
                        multiple
                        value={formMed.molecules}
                        label="Molécules / Principes Actifs"
                        onChange={(e) => setFormMed({ ...formMed, molecules: e.target.value })}
                        renderValue={(selected) => selected.join(", ")}
                      >
                        {refMolecules.map((m) => (
                          <MenuItem key={m.id} value={m.id}>
                            {m.nom} {m.formuleChimique ? `(${m.formuleChimique})` : ""}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Excipients</InputLabel>
                      <Select
                        multiple
                        value={formMed.excipients}
                        label="Excipients"
                        onChange={(e) => setFormMed({ ...formMed, excipients: e.target.value })}
                        renderValue={(selected) => selected.join(", ")}
                      >
                        {refExcipients.map((ex) => (
                          <MenuItem key={ex.id} value={ex.id}>
                            {ex.nom}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDialogMedOuvert(false)} color="inherit">
              Annuler
            </Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: "#059669", "&:hover": { bgcolor: "#047857" } }}>
              {editionId ? "Mettre à jour" : "Créer le Médicament"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog Gestion des Laboratoires (CRUD Laboratoire) */}
      <Dialog open={dialogLabOuvert} onClose={() => setDialogLabOuvert(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: "700" }}>
          Gestion des Laboratoires Pharmaceutiques (CRUD Ontologique)
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleSauvegarderLab} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>
              {editionLabId ? `Modifier le laboratoire : ${editionLabId}` : "Nouveau Laboratoire"}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Nom du laboratoire"
                  placeholder="ex: Laboratoires Saiph"
                  value={formLab.nom}
                  onChange={(e) => setFormLab({ ...formLab, nom: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Pays"
                  placeholder="ex: Tunisie"
                  value={formLab.pays}
                  onChange={(e) => setFormLab({ ...formLab, pays: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Adresse / Siège"
                  placeholder="ex: Zaghouan, Tunisie"
                  value={formLab.adresse}
                  onChange={(e) => setFormLab({ ...formLab, adresse: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {editionLabId && (
                    <Button
                      size="small"
                      onClick={() => {
                        setEditionLabId(null);
                        setFormLab(FORM_LAB_VIDE);
                      }}
                    >
                      Annuler édition
                    </Button>
                  )}
                  <Button type="submit" variant="contained" size="small" sx={{ bgcolor: "#059669" }}>
                    {editionLabId ? "Sauvegarder modification" : "Créer Laboratoire"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>
            Liste des Laboratoires enregistrés ({listeLabos.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: "#f8fafc" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: "700" }}>NOM</TableCell>
                  <TableCell sx={{ fontWeight: "700" }}>PAYS</TableCell>
                  <TableCell sx={{ fontWeight: "700" }}>ADRESSE</TableCell>
                  <TableCell sx={{ fontWeight: "700" }}>MÉDICAMENTS</TableCell>
                  <TableCell align="right" sx={{ fontWeight: "700" }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listeLabos.map((lab) => (
                  <TableRow key={lab.id}>
                    <TableCell fontWeight="600">{lab.nom}</TableCell>
                    <TableCell>{lab.pays || "—"}</TableCell>
                    <TableCell>{lab.adresse || "—"}</TableCell>
                    <TableCell>
                      <Chip label={`${lab.nb_medicaments || 0} produit(s)`} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditionLabId(lab.id);
                          setFormLab({
                            nom: lab.nom || "",
                            pays: lab.pays || "",
                            adresse: lab.adresse || "",
                          });
                        }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleSupprimerLab(lab.id)}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: "#ef4444" }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogLabOuvert(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Suppression Médicament */}
      <Dialog open={Boolean(aSupprimer)} onClose={() => setASupprimer(null)}>
        <DialogTitle sx={{ fontWeight: "700", color: "#b91c1c" }}>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Voulez-vous vraiment supprimer le médicament <strong>{aSupprimer?.nomCommercial}</strong> (:{aSupprimer?.id}) ?
            Cette action exécutera une mise à jour SPARQL DELETE sur le triple store Fuseki.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setASupprimer(null)}>Annuler</Button>
          <Button onClick={handleSupprimerMed} variant="contained" color="error">
            Supprimer définitivement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={Boolean(message)}
        autoHideDuration={4000}
        onClose={() => setMessage("")}
        message={message}
      />
    </Box>
  );
}
