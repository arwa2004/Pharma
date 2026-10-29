import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Autocomplete, Avatar, Badge, Box, Button, Checkbox, Chip,
  CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, IconButton, InputAdornment, LinearProgress,
  MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import CodeIcon from "@mui/icons-material/Code";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import DashboardIcon from "@mui/icons-material/Dashboard";
import TuneIcon from "@mui/icons-material/Tune";
import ClearIcon from "@mui/icons-material/Clear";
import EventIcon from "@mui/icons-material/Event";
import { prescriptionsApi } from "../apiPrescriptions";

/* ---------- Palette (alignée sur le Dashboard) ---------- */
const C = {
  vert: "#065f46",
  vertMoyen: "#16a34a",
  vertPale: "#f0fdf4",
  vertBord: "#d1fae5",
  ambre: "#b45309",
  ambrePale: "#fffbeb",
  rouge: "#dc2626",
  rougeFonce: "#991b1b",
  rougePale: "#fef2f2",
  gris: "#64748b",
  trait: "#e5e7eb",
};

const EMPTY_FORM = {
  medecin: "",
  patient: "",
  medicaments: [],
  pharmacien: "",
  date_prescription: new Date().toISOString().slice(0, 10),
  duree_jours: 7,
  posologie: "",
};

const EMPTY_FILTERS = {
  q: "", medecin: "", patient: "", medicament: "",
  date_debut: "", date_fin: "", duree_min: "", non_delivrees: false,
};

const FILTRES_AVANCES = ["medecin", "patient", "medicament", "date_debut", "date_fin", "duree_min", "non_delivrees"];

const cellHead = {
  fontSize: "0.75rem", fontWeight: 700, color: C.vert, whiteSpace: "nowrap",
  bgcolor: C.vertPale, borderBottom: `2px solid ${C.vertBord}`,
};
const cellBody = { fontSize: "0.8rem" };

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const initiales = (nom = "") =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");

/* ---------- Petits composants ---------- */
function Indicateur({ icone, valeur, libelle, detail, couleur, fond }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, px: 2.5, py: 1.75, minWidth: 0 }}>
      <Avatar sx={{ bgcolor: fond, color: couleur, width: 42, height: 42 }}>{icone}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography sx={{ fontSize: "1.7rem", fontWeight: 700, lineHeight: 1, color: couleur }}>{valeur}</Typography>
          <Typography variant="body2" fontWeight={600} noWrap>{libelle}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap component="div">{detail}</Typography>
      </Box>
    </Stack>
  );
}

export default function Prescriptions() {
  const navigate = useNavigate();
  const [options, setOptions] = useState({ medecins: [], pharmaciens: [], patients: [], medicaments: [] });
  const [items, setItems] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [stats, setStats] = useState([]);
  const [sparql, setSparql] = useState("");
  const [showSparql, setShowSparql] = useState(false);
  const [showAvances, setShowAvances] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null); // null = création
  const [openForm, setOpenForm] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null);
  const [erreur, setErreur] = useState("");
  const [erreurForm, setErreurForm] = useState("");
  const [succes, setSucces] = useState("");
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async (f) => {
    try {
      setChargement(true);
      setErreur("");
      const [list, al, st] = await Promise.all([
        prescriptionsApi.list(f),
        prescriptionsApi.alertes(),
        prescriptionsApi.stats(),
      ]);
      setItems(list.items);
      setSparql(list.sparql);
      setAlertes(al);
      setStats(st);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    prescriptionsApi.options().then(setOptions).catch((e) => setErreur(e.message));
    charger(EMPTY_FILTERS);
  }, [charger]);

  const setF = (k) => (e) =>
    setFilters((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setFo = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtrer = (e) => { e?.preventDefault(); charger(filters); };
  const reinitialiser = () => { setFilters(EMPTY_FILTERS); charger(EMPTY_FILTERS); };

  const nbFiltresActifs = FILTRES_AVANCES.filter((k) => Boolean(filters[k])).length;

  const ouvrirCreation = () => {
    setEditId(null); setForm(EMPTY_FORM); setErreurForm(""); setOpenForm(true);
  };

  const ouvrirEdition = (p) => {
    setEditId(p.id);
    setForm({
      medecin: p.medecin.id,
      patient: p.patient.id,
      medicaments: p.medicaments.map((m) => m.id),
      pharmacien: p.pharmacien?.id || "",
      date_prescription: p.date,
      duree_jours: p.duree_jours || 1,
      posologie: p.posologie,
    });
    setErreurForm(""); setOpenForm(true);
  };

  const enregistrer = async () => {
    if (!form.medecin || !form.patient || form.medicaments.length === 0 || !form.posologie.trim())
      return setErreurForm("Médecin, patient, posologie et au moins un médicament sont obligatoires.");
    const body = {
      ...form,
      duree_jours: Number(form.duree_jours),
      pharmacien: form.pharmacien || null,
    };
    try {
      if (editId) await prescriptionsApi.update(editId, body);
      else await prescriptionsApi.create(body);
      setOpenForm(false);
      setSucces(editId ? "Prescription modifiée." : "Prescription créée.");
      charger(filters);
    } catch (e) {
      setErreurForm(e.message);
    }
  };

  const supprimer = async () => {
    try {
      await prescriptionsApi.remove(aSupprimer.id);
      setASupprimer(null);
      setSucces("Prescription supprimée.");
      charger(filters);
    } catch (e) {
      setASupprimer(null);
      setErreur(e.message);
    }
  };

  const nbNonDelivrees = items.filter((p) => !p.pharmacien).length;
  const idsARisque = useMemo(() => new Set(alertes.map((a) => a.prescription)), [alertes]);
  const maxStat = Math.max(1, ...stats.map((s) => Number(s.nb) || 0));

  return (
    <Box>
      {/* ---------- En-tête ---------- */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" fontWeight="bold" color={C.vert}>Gestion des Prescriptions</Typography>
            <Chip label="SPARQL CRUD" color="success" size="small" variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Ordonnances, délivrance et détection des interactions médicamenteuses
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="success" size="small" startIcon={<DashboardIcon fontSize="small" />}
            onClick={() => navigate("/vigilance")}>
            Vigilance
          </Button>
          <Button variant="contained" color="success" size="small" startIcon={<AddIcon fontSize="small" />}
            onClick={ouvrirCreation} disableElevation>
            Nouvelle prescription
          </Button>
        </Stack>
      </Stack>

      {erreur && (
        <Alert severity="error" onClose={() => setErreur("")} sx={{ mb: 1.5, py: 0.5, fontSize: "0.8rem" }}>
          {erreur}
        </Alert>
      )}

      <Stack spacing={2}>
        {/* ---------- Bandeau d'indicateurs ---------- */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", borderColor: C.trait }}>
          <Stack direction={{ xs: "column", md: "row" }}
            divider={<Divider flexItem orientation="vertical" sx={{ display: { xs: "none", md: "block" } }} />}>
            <Indicateur icone={<AssignmentIcon fontSize="small" />} valeur={items.length}
              libelle="prescriptions" detail="Résultat du filtre actuel" couleur={C.vert} fond={C.vertBord} />
            <Divider sx={{ display: { xs: "block", md: "none" } }} />
            <Indicateur icone={<LocalPharmacyIcon fontSize="small" />} valeur={nbNonDelivrees}
              libelle="non délivrées" detail="Aucun pharmacien associé"
              couleur={nbNonDelivrees > 0 ? C.ambre : C.vertMoyen} fond={nbNonDelivrees > 0 ? "#fef3c7" : C.vertBord} />
            <Divider sx={{ display: { xs: "block", md: "none" } }} />
            <Indicateur icone={<ReportProblemIcon fontSize="small" />} valeur={alertes.length}
              libelle="interactions" detail={alertes.length > 0 ? "À vérifier avant délivrance" : "Aucune interaction détectée"}
              couleur={alertes.length > 0 ? C.rouge : C.vertMoyen} fond={alertes.length > 0 ? "#fee2e2" : C.vertBord} />
          </Stack>
        </Paper>

        {/* ---------- Alerte d'interactions ---------- */}
        {alertes.length > 0 && (
          <Paper variant="outlined" sx={{
            borderRadius: 2, borderColor: "#fecaca", bgcolor: C.rougePale,
            borderLeft: `5px solid ${C.rouge}`, p: 2,
          }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <ReportProblemIcon sx={{ color: C.rouge, mt: 0.25 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" color={C.rougeFonce} gutterBottom>
                  {alertes.length === 1 ? "1 interaction médicamenteuse détectée" : `${alertes.length} interactions médicamenteuses détectées`}
                </Typography>
                <Stack spacing={0.75}>
                  {alertes.map((a, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={a.prescription} sx={{ bgcolor: "#fff", fontWeight: 700, color: C.rougeFonce }} />
                      <Typography variant="body2" sx={{ color: C.rougeFonce }}>
                        <strong>{a.medicament1}</strong> + <strong>{a.medicament2}</strong>
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* ---------- Recherche et filtres ---------- */}
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5, borderColor: C.trait }}>
          <Box component="form" onSubmit={filtrer}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
              <TextField size="small" fullWidth placeholder="Rechercher un patient, un médecin, un médicament, une posologie…"
                value={filters.q} onChange={setF("q")}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>,
                  endAdornment: filters.q ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setFilters((f) => ({ ...f, q: "" }))}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }} />
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Badge badgeContent={nbFiltresActifs} color="success" invisible={nbFiltresActifs === 0}>
                  <Button variant={showAvances ? "contained" : "outlined"} color="success" size="small" disableElevation
                    startIcon={<TuneIcon fontSize="small" />} onClick={() => setShowAvances((v) => !v)}>
                    Filtres
                  </Button>
                </Badge>
                <Button type="submit" variant="contained" color="success" size="small" disableElevation>Rechercher</Button>
                <Button variant="text" color="inherit" size="small" onClick={reinitialiser}>Réinitialiser</Button>
              </Stack>
            </Stack>

            <Collapse in={showAvances} unmountOnExit>
              <Divider sx={{ my: 1.5 }} />
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} sm={4} md={3}>
                  <TextField select size="small" fullWidth label="Médecin" value={filters.medecin} onChange={setF("medecin")}>
                    <MenuItem value="">Tous</MenuItem>
                    {options.medecins.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <TextField select size="small" fullWidth label="Patient" value={filters.patient} onChange={setF("patient")}>
                    <MenuItem value="">Tous</MenuItem>
                    {options.patients.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <TextField select size="small" fullWidth label="Médicament" value={filters.medicament} onChange={setF("medicament")}>
                    <MenuItem value="">Tous</MenuItem>
                    {options.medicaments.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <TextField size="small" fullWidth type="number" label="Durée minimale (jours)" inputProps={{ min: 1 }}
                    value={filters.duree_min} onChange={setF("duree_min")} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <TextField size="small" fullWidth type="date" label="Du" InputLabelProps={{ shrink: true }}
                    value={filters.date_debut} onChange={setF("date_debut")} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <TextField size="small" fullWidth type="date" label="Au" InputLabelProps={{ shrink: true }}
                    value={filters.date_fin} onChange={setF("date_fin")} />
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <FormControlLabel
                    control={<Checkbox size="small" color="success" checked={filters.non_delivrees} onChange={setF("non_delivrees")} />}
                    label={<Typography variant="body2">Non délivrées seulement</Typography>} />
                </Grid>
              </Grid>
            </Collapse>
          </Box>
        </Paper>

        {/* ---------- Tableau ---------- */}
        <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: C.trait, overflow: "hidden" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.25 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" fontWeight="bold" color={C.vert}>Liste des prescriptions</Typography>
              <Chip size="small" label={items.length} color="success" />
            </Stack>
            <Button size="small" color="success" startIcon={<CodeIcon fontSize="small" />}
              onClick={() => setShowSparql((v) => !v)}>
              {showSparql ? "Masquer la requête SPARQL" : "Voir la requête SPARQL"}
            </Button>
          </Stack>

          <Collapse in={showSparql}>
            <Box component="pre" sx={{
              bgcolor: "#064e3b", color: "#d1fae5", p: 1.75, m: 0, mx: 2, mb: 1.5, borderRadius: 1.5,
              fontSize: "0.72rem", overflow: "auto", maxHeight: 260,
            }}>
              {sparql}
            </Box>
          </Collapse>

          {chargement && <LinearProgress color="success" sx={{ height: 2 }} />}

          <TableContainer sx={{ maxHeight: 520, opacity: chargement ? 0.55 : 1, transition: "opacity .2s" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={cellHead}>Prescription</TableCell>
                  <TableCell sx={cellHead}>Patient</TableCell>
                  <TableCell sx={cellHead}>Médecin</TableCell>
                  <TableCell sx={cellHead}>Médicaments</TableCell>
                  <TableCell sx={cellHead}>Posologie</TableCell>
                  <TableCell sx={cellHead}>Délivrance</TableCell>
                  <TableCell align="right" sx={cellHead}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((p) => {
                  const aRisque = idsARisque.has(p.id);
                  return (
                    <TableRow key={p.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                      <TableCell sx={{ ...cellBody, borderLeft: `4px solid ${aRisque ? C.rouge : "transparent"}`, whiteSpace: "nowrap" }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700 }}>{p.id}</Typography>
                          {aRisque && (
                            <Tooltip title="Interaction médicamenteuse détectée">
                              <ReportProblemIcon sx={{ fontSize: 16, color: C.rouge }} />
                            </Tooltip>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: C.gris, mt: 0.25 }}>
                          <EventIcon sx={{ fontSize: 13 }} />
                          <Typography variant="caption">{formatDate(p.date)} · {p.duree_jours} j</Typography>
                        </Stack>
                      </TableCell>

                      <TableCell sx={cellBody}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 26, height: 26, fontSize: "0.7rem", bgcolor: C.vertBord, color: C.vert, fontWeight: 700 }}>
                            {initiales(p.patient.nom)}
                          </Avatar>
                          <span>{p.patient.nom}</span>
                        </Stack>
                      </TableCell>

                      <TableCell sx={cellBody}>Dr {p.medecin.nom}</TableCell>

                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {p.medicaments.map((m) => (
                            <Chip key={m.id} size="small" label={m.nom} variant="outlined"
                              color={aRisque ? "error" : "success"} />
                          ))}
                        </Stack>
                      </TableCell>

                      <TableCell sx={{ ...cellBody, maxWidth: 220, color: "text.secondary" }}>{p.posologie}</TableCell>

                      <TableCell>
                        {p.pharmacien
                          ? <Chip size="small" color="success" icon={<LocalPharmacyIcon />} label={p.pharmacien.nom} />
                          : <Chip size="small" color="warning" variant="outlined" label="À délivrer" />}
                      </TableCell>

                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Modifier">
                          <IconButton size="small" color="success" onClick={() => ouvrirEdition(p)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" color="error" onClick={() => setASupprimer(p)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!chargement && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 5, textAlign: "center", border: 0 }}>
                      <AssignmentIcon sx={{ fontSize: 36, color: C.vertBord }} />
                      <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>Aucune prescription trouvée</Typography>
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
                        Modifiez vos filtres ou créez une nouvelle prescription.
                      </Typography>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button size="small" color="inherit" onClick={reinitialiser}>Réinitialiser les filtres</Button>
                        <Button size="small" variant="contained" color="success" disableElevation onClick={ouvrirCreation}>
                          Nouvelle prescription
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}

                {chargement && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 4, textAlign: "center", border: 0 }}>
                      <CircularProgress color="success" size={24} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* ---------- Répartition par médecin ---------- */}
        {stats.length > 0 && (
          <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: C.trait, p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight="bold" color={C.vert}>Prescriptions par médecin</Typography>
              <Chip label="SPARQL COUNT / GROUP BY" color="success" size="small" variant="outlined" />
            </Stack>
            <Grid container spacing={1.5}>
              {stats.map((st) => (
                <Grid item xs={12} sm={6} md={4} key={st.medecin}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="body2">Dr {st.medecin}</Typography>
                    <Typography variant="body2" fontWeight={700} color={C.vert}>{st.nb}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" color="success"
                    value={(Number(st.nb) / maxStat) * 100}
                    sx={{ height: 6, borderRadius: 3, bgcolor: C.vertBord }} />
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}
      </Stack>

      {/* ---------- Dialogue création / modification ---------- */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ color: C.vert, fontWeight: "bold", fontSize: "1rem" }}>
            {editId ? `Modifier ${editId}` : "Nouvelle prescription"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Seuls les médicaments sur ordonnance peuvent être prescrits.
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {erreurForm && <Alert severity="error" sx={{ mb: 2, py: 0.5, fontSize: "0.8rem" }}>{erreurForm}</Alert>}

          <Typography variant="caption" fontWeight="bold" color={C.vert}>Qui</Typography>
          <Grid container spacing={1.5} sx={{ mb: 2, mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField select size="small" fullWidth required label="Médecin" value={form.medecin} onChange={setFo("medecin")}>
                {options.medecins.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select size="small" fullWidth required label="Patient" value={form.patient} onChange={setFo("patient")}>
                {options.patients.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>

          <Typography variant="caption" fontWeight="bold" color={C.vert}>Traitement</Typography>
          <Grid container spacing={1.5} sx={{ mb: 2, mt: 0 }}>
            <Grid item xs={12}>
              <Autocomplete multiple size="small" options={options.medicaments}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={options.medicaments.filter((m) => form.medicaments.includes(m.id))}
                onChange={(_, v) => setForm((f) => ({ ...f, medicaments: v.map((m) => m.id) }))}
                renderTags={(value, getTagProps) =>
                  value.map((o, index) => (
                    <Chip {...getTagProps({ index })} key={o.id} size="small" color="success" variant="outlined" label={o.label} />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} required={form.medicaments.length === 0} label="Médicaments" />
                )} />
            </Grid>
            <Grid item xs={12}>
              <TextField size="small" fullWidth required label="Posologie" placeholder="ex : 1 comprimé matin et soir"
                value={form.posologie} onChange={setFo("posologie")} />
            </Grid>
          </Grid>

          <Typography variant="caption" fontWeight="bold" color={C.vert}>Durée et délivrance</Typography>
          <Grid container spacing={1.5} sx={{ mt: 0 }}>
            <Grid item xs={6} sm={4}>
              <TextField size="small" fullWidth required type="date" label="Date" InputLabelProps={{ shrink: true }}
                value={form.date_prescription} onChange={setFo("date_prescription")} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField size="small" fullWidth required type="number" label="Durée (j)" inputProps={{ min: 1 }}
                value={form.duree_jours} onChange={setFo("duree_jours")} />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField select size="small" fullWidth label="Pharmacien" value={form.pharmacien} onChange={setFo("pharmacien")}>
                <MenuItem value="">Non délivrée</MenuItem>
                {options.pharmaciens.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button color="inherit" size="small" onClick={() => setOpenForm(false)}>Annuler</Button>
          <Button variant="contained" color="success" size="small" disableElevation onClick={enregistrer}>
            {editId ? "Enregistrer les modifications" : "Créer la prescription"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- Dialogue de suppression ---------- */}
      <Dialog open={Boolean(aSupprimer)} onClose={() => setASupprimer(null)} PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontSize: "1rem", fontWeight: "bold" }}>Supprimer cette prescription ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            La prescription <strong>{aSupprimer?.id}</strong> de <strong>{aSupprimer?.patient.nom}</strong> sera
            supprimée définitivement du graphe RDF.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" size="small" onClick={() => setASupprimer(null)}>Annuler</Button>
          <Button variant="contained" color="error" size="small" disableElevation onClick={supprimer}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* ---------- Confirmation ---------- */}
      <Snackbar open={Boolean(succes)} autoHideDuration={3500} onClose={() => setSucces("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setSucces("")} sx={{ fontSize: "0.8rem" }}>
          {succes}
        </Alert>
      </Snackbar>
    </Box>
  );
}