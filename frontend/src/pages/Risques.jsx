import { useCallback, useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, FormControl, FormControlLabel,
  Grid, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Snackbar,
  Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SickOutlinedIcon from "@mui/icons-material/SickOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import MedicationOutlinedIcon from "@mui/icons-material/MedicationOutlined";
import LocalHospitalOutlinedIcon from "@mui/icons-material/LocalHospitalOutlined";
import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";

const COULEUR = "#7c2d12"; // thème "risque" (brique/orangé) distinct du vert Patients
const COULEUR_FOND = "#fff7ed";

function Onglet({ children, actif, index }) {
  return actif === index ? <Box sx={{ mt: 2 }}>{children}</Box> : null;
}

// ============================================================================
// Page principale : 3 onglets (Effets secondaires / Contre-indications / Interactions)
// ============================================================================
export default function Risques() {
  const [onglet, setOnglet] = useState(0);
  const [refMedicaments, setRefMedicaments] = useState([]);
  const [refPathologies, setRefPathologies] = useState([]);
  const [sparql, setSparql] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.referentielMedicamentsRisques().then((r) => setRefMedicaments(r.data)).catch(() => {});
    api.referentielPathologiesRisques().then((r) => setRefPathologies(r.data)).catch(() => {});
  }, []);

  const nomMed = (id) => refMedicaments.find((m) => m.id === id)?.nom || id;
  const nomPatho = (id) => refPathologies.find((p) => p.id === id)?.nom || id;

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      <Stack sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="700" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
          Gestion des Risques
        </Typography>
        <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem", mt: 0.2 }}>
          Effets secondaires · Contre-indications · Interactions médicamenteuses — Ontologie OWL &amp; Apache Jena Fuseki
        </Typography>
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 2.5, border: "1px solid #e2e8f0", mb: 2, overflow: "hidden" }}>
        <Tabs
          value={onglet}
          onChange={(_, v) => setOnglet(v)}
          variant="fullWidth"
          TabIndicatorProps={{ style: { backgroundColor: COULEUR } }}
          sx={{
            bgcolor: "#ffffff",
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.85rem", py: 1.5 },
            "& .Mui-selected": { color: `${COULEUR} !important` },
          }}
        >
          <Tab icon={<SickOutlinedIcon fontSize="small" />} iconPosition="start" label="Effets Secondaires" />
          <Tab icon={<BlockOutlinedIcon fontSize="small" />} iconPosition="start" label="Contre-Indications" />
          <Tab icon={<CompareArrowsOutlinedIcon fontSize="small" />} iconPosition="start" label="Interactions" />
        </Tabs>
      </Paper>

      <Onglet actif={onglet} index={0}>
        <OngletEffets
          refMedicaments={refMedicaments} nomMed={nomMed}
          setSparql={setSparql} setMessage={setMessage}
        />
      </Onglet>
      <Onglet actif={onglet} index={1}>
        <OngletContreIndications
          refMedicaments={refMedicaments} refPathologies={refPathologies}
          nomMed={nomMed} nomPatho={nomPatho}
          setSparql={setSparql} setMessage={setMessage}
        />
      </Onglet>
      <Onglet actif={onglet} index={2}>
        <OngletInteractions
          refMedicaments={refMedicaments} nomMed={nomMed}
          setSparql={setSparql} setMessage={setMessage}
        />
      </Onglet>

      <SparqlBox sparql={sparql} />

      <Snackbar open={!!message} autoHideDuration={3000} onClose={() => setMessage("")} message={message} />
    </Box>
  );
}

// ============================================================================
// Carte KPI cliquable (filtre rapide)
// ============================================================================
function CarteKpi({ label, valeur, sousTitre, actif, couleur, fond, icone, onClick }) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2, borderRadius: 2.5, cursor: onClick ? "pointer" : "default",
        border: actif ? `2px solid ${couleur}` : "1px solid #e2e8f0",
        bgcolor: actif ? fond : "#ffffff",
        transition: "all 0.2s",
        "&:hover": onClick ? { borderColor: couleur, transform: "translateY(-1px)" } : {},
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="caption" sx={{ color: couleur, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight="700" color={couleur} sx={{ mt: 0.5 }}>{valeur}</Typography>
          <Typography variant="caption" color="#64748b" sx={{ fontSize: "0.72rem" }}>{sousTitre}</Typography>
        </Box>
        <Avatar sx={{ bgcolor: fond, color: couleur, width: 44, height: 44 }}>{icone}</Avatar>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// ONGLET 1 : EFFETS SECONDAIRES
// ============================================================================
function OngletEffets({ refMedicaments, nomMed, setSparql, setMessage }) {
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState(""); // "", "grave", "benin"
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [formulaire, setFormulaire] = useState(null); // {id, libelle, grave, frequenceEffet, id_medicament}
  const [aSupprimer, setASupprimer] = useState(null);
  const [gestion, setGestion] = useState(null); // fiche détaillée en cours de gestion des liens
  const [medASocier, setMedASocier] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (recherche.trim()) params.set("q", recherche.trim());
      if (filtreType) params.set("type", filtreType);
      const suffixe = params.toString();
      const res = await api.listerEffets(suffixe ? `?${suffixe}` : "");
      setListe(res.data);
      setSparql(res.sparql);
    } catch (e) {
      setErreur(e.message);
      setListe([]);
    } finally {
      setChargement(false);
    }
  }, [recherche, filtreType, setSparql]);

  useEffect(() => { const t = setTimeout(charger, 250); return () => clearTimeout(t); }, [charger]);

  const nbGraves = liste.filter((e) => e.grave).length;
  const nbBenins = liste.filter((e) => !e.grave).length;

  const ouvrirGestion = async (id) => {
    try {
      const res = await api.ficheEffet(id);
      setGestion(res.data);
      setSparql(res.sparql);
    } catch (e) { setErreur(e.message); }
  };

  const enregistrer = async () => {
    if (!formulaire.libelle.trim()) return setErreur("Le libellé est obligatoire");
    try {
      if (formulaire.id) {
        const corps = { libelle: formulaire.libelle.trim(), grave: formulaire.grave };
        if (formulaire.frequenceEffet !== "") corps.frequenceEffet = Number(formulaire.frequenceEffet);
        const res = await api.modifierEffet(formulaire.id, corps);
        setSparql(res.sparql);
        setMessage("Effet secondaire mis à jour avec succès dans Fuseki");
      } else {
        if (!formulaire.id_medicament) return setErreur("Un médicament initial est requis (axiome OWL : minCardinality 1 sur :estEffetDe)");
        const corps = { libelle: formulaire.libelle.trim(), grave: formulaire.grave, id_medicament: formulaire.id_medicament };
        if (formulaire.frequenceEffet !== "") corps.frequenceEffet = Number(formulaire.frequenceEffet);
        const res = await api.creerEffet(corps);
        setSparql(res.sparql);
        setMessage("Nouvel effet secondaire inséré avec succès (INSERT DATA)");
      }
      setFormulaire(null);
      setErreur("");
      charger();
    } catch (e) { setErreur(e.message); }
  };

  const supprimer = async () => {
    try {
      const res = await api.supprimerEffet(aSupprimer.id);
      setSparql(res.sparql);
      setMessage("Effet secondaire supprimé du graphe RDF");
      setASupprimer(null);
      charger();
    } catch (e) { setErreur(e.message); setASupprimer(null); }
  };

  const associer = async () => {
    if (!medASocier) return;
    try {
      const res = await api.associerMedicamentEffet(gestion.id, medASocier);
      setSparql(res.sparql);
      setMessage(`Médicament :${medASocier} associé (:aEffetSecondaire)`);
      setMedASocier("");
      ouvrirGestion(gestion.id);
      charger();
    } catch (e) { setErreur(e.message); }
  };

  const retirer = async (idMed) => {
    try {
      const res = await api.retirerMedicamentEffet(gestion.id, idMed);
      setSparql(res.sparql);
      setMessage(`Médicament :${idMed} dissocié`);
      ouvrirGestion(gestion.id);
      charger();
    } catch (e) { setErreur(e.message); }
  };

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={4}>
          <CarteKpi label="Total effets" valeur={liste.length} sousTitre="Classe :EffetSecondaire"
            actif={!filtreType} couleur={COULEUR} fond={COULEUR_FOND}
            icone={<SickOutlinedIcon fontSize="small" />} onClick={() => setFiltreType("")} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <CarteKpi label="Graves" valeur={nbGraves} sousTitre="Classe :EffetSecondaireGrave"
            actif={filtreType === "grave"} couleur="#dc2626" fond="#fef2f2"
            icone={<ReportProblemOutlinedIcon fontSize="small" />} onClick={() => setFiltreType("grave")} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <CarteKpi label="Bénins" valeur={nbBenins} sousTitre="Classe :EffetSecondaireBenin"
            actif={filtreType === "benin"} couleur="#2563eb" fond="#eff6ff"
            icone={<SickOutlinedIcon fontSize="small" />} onClick={() => setFiltreType("benin")} />
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small" placeholder="Rechercher par libellé..." value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#94a3b8", fontSize: 18 }} /></InputAdornment>,
              endAdornment: recherche && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setRecherche("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 220, "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.8rem", bgcolor: "#f8fafc" } }}
          />
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => { setErreur(""); setFormulaire({ id: null, libelle: "", grave: false, frequenceEffet: "", id_medicament: "" }); }}
            sx={{ bgcolor: COULEUR, "&:hover": { bgcolor: "#6c2410" }, textTransform: "none", fontWeight: 600, fontSize: "0.82rem", borderRadius: 2 }}
          >
            Nouvel Effet
          </Button>
        </Stack>
      </Paper>

      {erreur && !formulaire && !gestion && <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>{erreur}</Alert>}

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Libellé</TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Type</TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Fréquence</TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Médicaments liés</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chargement && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                <CircularProgress size={22} sx={{ color: COULEUR }} />
              </TableCell></TableRow>
            )}
            {!chargement && liste.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="#64748b">Aucun effet secondaire ne correspond.</Typography>
              </TableCell></TableRow>
            )}
            {!chargement && liste.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell sx={{ py: 1.1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{e.libelle}</Typography>
                  <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "0.7rem" }}>:{e.id}</Typography>
                </TableCell>
                <TableCell sx={{ py: 1.1 }}>
                  <Chip size="small" label={e.grave ? "Grave" : "Bénin"}
                    sx={{ bgcolor: e.grave ? "#fef2f2" : "#eff6ff", color: e.grave ? "#dc2626" : "#2563eb", fontWeight: 600, fontSize: "0.7rem" }} />
                </TableCell>
                <TableCell sx={{ py: 1.1, fontSize: "0.8rem" }}>
                  {e.frequenceEffet !== undefined && e.frequenceEffet !== null ? `${e.frequenceEffet} %` : "—"}
                </TableCell>
                <TableCell sx={{ py: 1.1 }}>
                  <Chip size="small" variant="outlined" label={`${e.nb_medicaments ?? 0} médicament(s)`} sx={{ fontSize: "0.72rem" }} />
                </TableCell>
                <TableCell align="right" sx={{ py: 1.1 }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Gérer les médicaments associés">
                      <IconButton size="small" onClick={() => ouvrirGestion(e.id)} sx={{ color: COULEUR, bgcolor: COULEUR_FOND }}>
                        <SettingsOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Modifier">
                      <IconButton size="small"
                        onClick={() => { setErreur(""); setFormulaire({ id: e.id, libelle: e.libelle, grave: e.grave, frequenceEffet: e.frequenceEffet ?? "", id_medicament: "" }); }}
                        sx={{ color: "#475569", bgcolor: "#f1f5f9" }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" onClick={() => setASupprimer(e)} sx={{ color: "#dc2626", bgcolor: "#fef2f2" }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog création / modification */}
      <Dialog open={!!formulaire} onClose={() => setFormulaire(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: COULEUR, color: "white", py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>
          {formulaire?.id ? `Modifier :${formulaire.id}` : "Nouvel Effet Secondaire (INSERT DATA)"}
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, mt: 1 }}>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {erreur && <Alert severity="error" sx={{ py: 0.5, fontSize: "0.8rem", borderRadius: 2 }}>{erreur}</Alert>}
            <TextField label="Libellé" required fullWidth size="small" value={formulaire?.libelle ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, libelle: e.target.value })} />
            <FormControlLabel
              control={<Switch checked={!!formulaire?.grave} onChange={(e) => setFormulaire({ ...formulaire, grave: e.target.checked })} color="error" />}
              label={formulaire?.grave ? "Grave (:EffetSecondaireGrave)" : "Bénin (:EffetSecondaireBenin)"}
            />
            <TextField label="Fréquence (% , 0-100)" type="number" fullWidth size="small" value={formulaire?.frequenceEffet ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, frequenceEffet: e.target.value })} />
            {!formulaire?.id && (
              <FormControl fullWidth size="small">
                <InputLabel>Médicament initial (requis)</InputLabel>
                <Select value={formulaire?.id_medicament ?? ""} label="Médicament initial (requis)"
                  onChange={(e) => setFormulaire({ ...formulaire, id_medicament: e.target.value })}>
                  {refMedicaments.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setFormulaire(null)} sx={{ textTransform: "none", color: "#64748b" }}>Annuler</Button>
          <Button variant="contained" onClick={enregistrer} sx={{ bgcolor: COULEUR, "&:hover": { bgcolor: "#6c2410" }, textTransform: "none", fontWeight: 600, borderRadius: 2 }}>
            {formulaire?.id ? "Mettre à jour" : "Insérer dans Fuseki"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!aSupprimer} onClose={() => setASupprimer(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: "#dc2626", fontSize: "0.95rem", fontWeight: 600 }}>Confirmer la suppression ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.82rem" }}>
            Tous les triplets décrivant <strong>:{aSupprimer?.id}</strong> ({aSupprimer?.libelle}) seront supprimés via <code>DELETE WHERE</code>.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setASupprimer(null)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button color="error" variant="contained" onClick={supprimer} sx={{ textTransform: "none", fontWeight: 600 }}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog gestion des liens médicaments */}
      <Dialog open={!!gestion} onClose={() => setGestion(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>
          Médicaments liés à :{gestion?.id} (<code>:aEffetSecondaire</code>)
          <IconButton onClick={() => setGestion(null)} sx={{ position: "absolute", right: 10, top: 10 }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          {erreur && <Alert severity="error" sx={{ mb: 1.5, py: 0.5, fontSize: "0.8rem" }} onClose={() => setErreur("")}>{erreur}</Alert>}
          <Alert severity="info" sx={{ mb: 1.5, py: 0.5, fontSize: "0.78rem" }}>
            Axiome OWL : un effet secondaire doit rester lié à au moins 1 médicament (minCardinality 1 sur <code>:estEffetDe</code>).
          </Alert>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {gestion?.medicaments?.length === 0 && <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem" }}>Aucun médicament lié.</Typography>}
            {gestion?.medicaments?.map((m) => (
              <Paper key={m.id} elevation={0} sx={{ p: 1.25, px: 1.75, borderRadius: 2, border: "1px solid #f1f5f9", bgcolor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <MedicationOutlinedIcon sx={{ fontSize: 18, color: COULEUR }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{m.nom ?? m.id}</Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.7rem" }}>:{m.id}</Typography>
                  </Box>
                </Stack>
                <Tooltip title="Dissocier">
                  <IconButton size="small" onClick={() => retirer(m.id)} sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626" } }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Paper>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>Associer un médicament</InputLabel>
              <Select value={medASocier} label="Associer un médicament" onChange={(e) => setMedASocier(e.target.value)}>
                {refMedicaments.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={associer} disabled={!medASocier} sx={{ bgcolor: COULEUR, textTransform: "none", whiteSpace: "nowrap" }}>
              Associer
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGestion(null)} sx={{ textTransform: "none" }}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================================================
// ONGLET 2 : CONTRE-INDICATIONS
// ============================================================================
function OngletContreIndications({ refMedicaments, refPathologies, nomMed, nomPatho, setSparql, setMessage }) {
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [gestion, setGestion] = useState(null);
  const [medASocier, setMedASocier] = useState("");
  const [pathoASocier, setPathoASocier] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (recherche.trim()) params.set("q", recherche.trim());
      if (filtreType) params.set("type", filtreType);
      const suffixe = params.toString();
      const res = await api.listerContreIndications(suffixe ? `?${suffixe}` : "");
      setListe(res.data);
      setSparql(res.sparql);
    } catch (e) { setErreur(e.message); setListe([]); } finally { setChargement(false); }
  }, [recherche, filtreType, setSparql]);

  useEffect(() => { const t = setTimeout(charger, 250); return () => clearTimeout(t); }, [charger]);

  const nbAbsolues = liste.filter((c) => c.absolue).length;
  const nbRelatives = liste.filter((c) => !c.absolue).length;

  const ouvrirGestion = async (id) => {
    try {
      const res = await api.ficheContreIndication(id);
      setGestion(res.data);
      setSparql(res.sparql);
    } catch (e) { setErreur(e.message); }
  };

  const enregistrer = async () => {
    if (!formulaire.libelle.trim()) return setErreur("Le libellé est obligatoire");
    try {
      if (formulaire.id) {
        const res = await api.modifierContreIndication(formulaire.id, { libelle: formulaire.libelle.trim(), absolue: formulaire.absolue });
        setSparql(res.sparql);
        setMessage("Contre-indication mise à jour avec succès");
      } else {
        if (!formulaire.id_pathologie) return setErreur("Une pathologie est requise (axiome OWL : someValuesFrom :Pathologie)");
        const corps = { libelle: formulaire.libelle.trim(), absolue: formulaire.absolue, id_pathologie: formulaire.id_pathologie };
        if (formulaire.id_medicament) corps.id_medicament = formulaire.id_medicament;
        const res = await api.creerContreIndication(corps);
        setSparql(res.sparql);
        setMessage("Nouvelle contre-indication insérée avec succès (INSERT DATA)");
      }
      setFormulaire(null);
      setErreur("");
      charger();
    } catch (e) { setErreur(e.message); }
  };

  const supprimer = async () => {
    try {
      const res = await api.supprimerContreIndication(aSupprimer.id);
      setSparql(res.sparql);
      setMessage("Contre-indication supprimée du graphe RDF");
      setASupprimer(null);
      charger();
    } catch (e) { setErreur(e.message); setASupprimer(null); }
  };

  const associerMed = async () => {
    if (!medASocier) return;
    try {
      const res = await api.associerMedicamentCi(gestion.id, medASocier);
      setSparql(res.sparql);
      setMessage(`Médicament :${medASocier} associé (:aContreIndication)`);
      setMedASocier("");
      ouvrirGestion(gestion.id); charger();
    } catch (e) { setErreur(e.message); }
  };

  const retirerMed = async (idMed) => {
    try {
      const res = await api.retirerMedicamentCi(gestion.id, idMed);
      setSparql(res.sparql);
      setMessage(`Médicament :${idMed} dissocié`);
      ouvrirGestion(gestion.id); charger();
    } catch (e) { setErreur(e.message); }
  };

  const associerPatho = async () => {
    if (!pathoASocier) return;
    try {
      const res = await api.associerPathologieCi(gestion.id, pathoASocier);
      setSparql(res.sparql);
      setMessage(`Pathologie :${pathoASocier} associée (:concernePathologie)`);
      setPathoASocier("");
      ouvrirGestion(gestion.id); charger();
    } catch (e) { setErreur(e.message); }
  };

  const retirerPatho = async (idPatho) => {
    try {
      const res = await api.retirerPathologieCi(gestion.id, idPatho);
      setSparql(res.sparql);
      setMessage(`Pathologie :${idPatho} dissociée`);
      ouvrirGestion(gestion.id); charger();
    } catch (e) { setErreur(e.message); }
  };

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={4}>
          <CarteKpi label="Total CI" valeur={liste.length} sousTitre="Classe :ContreIndication"
            actif={!filtreType} couleur={COULEUR} fond={COULEUR_FOND}
            icone={<BlockOutlinedIcon fontSize="small" />} onClick={() => setFiltreType("")} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <CarteKpi label="Absolues" valeur={nbAbsolues} sousTitre="Classe :ContreIndicationAbsolue"
            actif={filtreType === "absolue"} couleur="#dc2626" fond="#fef2f2"
            icone={<ReportProblemOutlinedIcon fontSize="small" />} onClick={() => setFiltreType("absolue")} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <CarteKpi label="Relatives" valeur={nbRelatives} sousTitre="Classe :ContreIndicationRelative"
            actif={filtreType === "relative"} couleur="#2563eb" fond="#eff6ff"
            icone={<BlockOutlinedIcon fontSize="small" />} onClick={() => setFiltreType("relative")} />
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small" placeholder="Rechercher par libellé..." value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#94a3b8", fontSize: 18 }} /></InputAdornment>,
              endAdornment: recherche && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setRecherche("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 220, "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.8rem", bgcolor: "#f8fafc" } }}
          />
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => { setErreur(""); setFormulaire({ id: null, libelle: "", absolue: false, id_pathologie: "", id_medicament: "" }); }}
            sx={{ bgcolor: COULEUR, "&:hover": { bgcolor: "#6c2410" }, textTransform: "none", fontWeight: 600, fontSize: "0.82rem", borderRadius: 2 }}
          >
            Nouvelle Contre-Indication
          </Button>
        </Stack>
      </Paper>

      {erreur && !formulaire && !gestion && <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>{erreur}</Alert>}

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Libellé</TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Type</TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Médicaments</TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Pathologies</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chargement && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={22} sx={{ color: COULEUR }} /></TableCell></TableRow>
            )}
            {!chargement && liste.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography variant="body2" color="#64748b">Aucune contre-indication ne correspond.</Typography></TableCell></TableRow>
            )}
            {!chargement && liste.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ py: 1.1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{c.libelle}</Typography>
                  <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "0.7rem" }}>:{c.id}</Typography>
                </TableCell>
                <TableCell sx={{ py: 1.1 }}>
                  <Chip size="small" label={c.absolue ? "Absolue" : "Relative"}
                    sx={{ bgcolor: c.absolue ? "#fef2f2" : "#eff6ff", color: c.absolue ? "#dc2626" : "#2563eb", fontWeight: 600, fontSize: "0.7rem" }} />
                </TableCell>
                <TableCell sx={{ py: 1.1 }}>
                  <Chip size="small" variant="outlined" label={`${c.nb_medicaments ?? 0}`} sx={{ fontSize: "0.72rem" }} />
                </TableCell>
                <TableCell sx={{ py: 1.1 }}>
                  <Chip size="small" variant="outlined" label={`${c.nb_pathologies ?? 0}`} sx={{ fontSize: "0.72rem" }} />
                </TableCell>
                <TableCell align="right" sx={{ py: 1.1 }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Gérer les liens">
                      <IconButton size="small" onClick={() => ouvrirGestion(c.id)} sx={{ color: COULEUR, bgcolor: COULEUR_FOND }}>
                        <SettingsOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Modifier">
                      <IconButton size="small"
                        onClick={() => { setErreur(""); setFormulaire({ id: c.id, libelle: c.libelle, absolue: c.absolue, id_pathologie: "", id_medicament: "" }); }}
                        sx={{ color: "#475569", bgcolor: "#f1f5f9" }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" onClick={() => setASupprimer(c)} sx={{ color: "#dc2626", bgcolor: "#fef2f2" }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog création / modification */}
      <Dialog open={!!formulaire} onClose={() => setFormulaire(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: COULEUR, color: "white", py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>
          {formulaire?.id ? `Modifier :${formulaire.id}` : "Nouvelle Contre-Indication (INSERT DATA)"}
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, mt: 1 }}>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {erreur && <Alert severity="error" sx={{ py: 0.5, fontSize: "0.8rem", borderRadius: 2 }}>{erreur}</Alert>}
            <TextField label="Libellé" required fullWidth size="small" value={formulaire?.libelle ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, libelle: e.target.value })} />
            <FormControlLabel
              control={<Switch checked={!!formulaire?.absolue} onChange={(e) => setFormulaire({ ...formulaire, absolue: e.target.checked })} color="error" />}
              label={formulaire?.absolue ? "Absolue (:ContreIndicationAbsolue)" : "Relative (:ContreIndicationRelative)"}
            />
            {!formulaire?.id && (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>Pathologie concernée (requis)</InputLabel>
                  <Select value={formulaire?.id_pathologie ?? ""} label="Pathologie concernée (requis)"
                    onChange={(e) => setFormulaire({ ...formulaire, id_pathologie: e.target.value })}>
                    {refPathologies.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.nom ? `${p.nom} (:${p.id})` : `:${p.id}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Médicament à associer (facultatif)</InputLabel>
                  <Select value={formulaire?.id_medicament ?? ""} label="Médicament à associer (facultatif)"
                    onChange={(e) => setFormulaire({ ...formulaire, id_medicament: e.target.value })}>
                    <MenuItem value="">— Aucun —</MenuItem>
                    {refMedicaments.map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setFormulaire(null)} sx={{ textTransform: "none", color: "#64748b" }}>Annuler</Button>
          <Button variant="contained" onClick={enregistrer} sx={{ bgcolor: COULEUR, "&:hover": { bgcolor: "#6c2410" }, textTransform: "none", fontWeight: 600, borderRadius: 2 }}>
            {formulaire?.id ? "Mettre à jour" : "Insérer dans Fuseki"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!aSupprimer} onClose={() => setASupprimer(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: "#dc2626", fontSize: "0.95rem", fontWeight: 600 }}>Confirmer la suppression ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.82rem" }}>
            Tous les triplets décrivant <strong>:{aSupprimer?.id}</strong> ({aSupprimer?.libelle}) seront supprimés via <code>DELETE WHERE</code>.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setASupprimer(null)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button color="error" variant="contained" onClick={supprimer} sx={{ textTransform: "none", fontWeight: 600 }}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog gestion des liens */}
      <Dialog open={!!gestion} onClose={() => setGestion(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>
          Liens de :{gestion?.id}
          <IconButton onClick={() => setGestion(null)} sx={{ position: "absolute", right: 10, top: 10 }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          {erreur && <Alert severity="error" sx={{ mb: 1.5, py: 0.5, fontSize: "0.8rem" }} onClose={() => setErreur("")}>{erreur}</Alert>}

          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.82rem", mb: 1 }}>
            Médicaments (<code>:aContreIndication</code>)
          </Typography>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {gestion?.medicaments?.length === 0 && <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.8rem" }}>Aucun médicament lié.</Typography>}
            {gestion?.medicaments?.map((m) => (
              <Paper key={m.id} elevation={0} sx={{ p: 1, px: 1.5, borderRadius: 2, border: "1px solid #f1f5f9", bgcolor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <MedicationOutlinedIcon sx={{ fontSize: 16, color: COULEUR }} />
                  <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>{m.nom ?? m.id}</Typography>
                </Stack>
                <IconButton size="small" onClick={() => retirerMed(m.id)} sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626" } }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Paper>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Associer un médicament</InputLabel>
              <Select value={medASocier} label="Associer un médicament" onChange={(e) => setMedASocier(e.target.value)}>
                {refMedicaments.map((m) => (<MenuItem key={m.id} value={m.id}>{m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={associerMed} disabled={!medASocier} sx={{ bgcolor: COULEUR, textTransform: "none", whiteSpace: "nowrap" }}>Associer</Button>
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.82rem", mb: 1 }}>
            Pathologies (<code>:concernePathologie</code>)
          </Typography>
          <Alert severity="info" sx={{ mb: 1.5, py: 0.5, fontSize: "0.76rem" }}>
            Axiome OWL : au moins 1 pathologie requise (someValuesFrom :Pathologie).
          </Alert>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {gestion?.pathologies?.length === 0 && <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.8rem" }}>Aucune pathologie liée.</Typography>}
            {gestion?.pathologies?.map((p) => (
              <Paper key={p.id} elevation={0} sx={{ p: 1, px: 1.5, borderRadius: 2, border: "1px solid #f1f5f9", bgcolor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <LocalHospitalOutlinedIcon sx={{ fontSize: 16, color: "#2563eb" }} />
                  <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>{p.nom ?? p.id}</Typography>
                </Stack>
                <IconButton size="small" onClick={() => retirerPatho(p.id)} sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626" } }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Paper>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>Associer une pathologie</InputLabel>
              <Select value={pathoASocier} label="Associer une pathologie" onChange={(e) => setPathoASocier(e.target.value)}>
                {refPathologies.map((p) => (<MenuItem key={p.id} value={p.id}>{p.nom ? `${p.nom} (:${p.id})` : `:${p.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={associerPatho} disabled={!pathoASocier} sx={{ bgcolor: "#2563eb", textTransform: "none", whiteSpace: "nowrap" }}>Associer</Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGestion(null)} sx={{ textTransform: "none" }}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================================================
// ONGLET 3 : INTERACTIONS
// ============================================================================
function OngletInteractions({ refMedicaments, nomMed, setSparql, setMessage }) {
  const [recherche, setRecherche] = useState("");
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [gestion, setGestion] = useState(null);
  const [medASocier, setMedASocier] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const params = new URLSearchParams();
      if (recherche.trim()) params.set("q", recherche.trim());
      const suffixe = params.toString();
      const res = await api.listerInteractions(suffixe ? `?${suffixe}` : "");
      setListe(res.data);
      setSparql(res.sparql);
    } catch (e) { setErreur(e.message); setListe([]); } finally { setChargement(false); }
  }, [recherche, setSparql]);

  useEffect(() => { const t = setTimeout(charger, 250); return () => clearTimeout(t); }, [charger]);

  const ouvrirGestion = async (id) => {
    try {
      const res = await api.ficheInteraction(id);
      setGestion(res.data);
      setSparql(res.sparql);
    } catch (e) { setErreur(e.message); }
  };

  const enregistrer = async () => {
    if (!formulaire.libelle.trim()) return setErreur("Le libellé est obligatoire");
    try {
      if (formulaire.id) {
        const res = await api.modifierInteraction(formulaire.id, { libelle: formulaire.libelle.trim() });
        setSparql(res.sparql);
        setMessage("Interaction mise à jour avec succès");
      } else {
        if (!formulaire.id_medicament_a || !formulaire.id_medicament_b)
          return setErreur("2 médicaments distincts sont requis (axiome OWL : minCardinality 2 sur :impliqueMedicament)");
        if (formulaire.id_medicament_a === formulaire.id_medicament_b)
          return setErreur("Les 2 médicaments doivent être distincts");
        const res = await api.creerInteraction({
          libelle: formulaire.libelle.trim(),
          id_medicament_a: formulaire.id_medicament_a,
          id_medicament_b: formulaire.id_medicament_b,
        });
        setSparql(res.sparql);
        setMessage("Nouvelle interaction insérée avec succès (INSERT DATA + :interagitAvec)");
      }
      setFormulaire(null);
      setErreur("");
      charger();
    } catch (e) { setErreur(e.message); }
  };

  const supprimer = async () => {
    try {
      const res = await api.supprimerInteraction(aSupprimer.id);
      setSparql(res.sparql);
      setMessage("Interaction supprimée du graphe RDF");
      setASupprimer(null);
      charger();
    } catch (e) { setErreur(e.message); setASupprimer(null); }
  };

  const associer = async () => {
    if (!medASocier) return;
    try {
      const res = await api.ajouterMedicamentInteraction(gestion.id, medASocier);
      setSparql(res.sparql);
      setMessage(`Médicament :${medASocier} ajouté à l'interaction`);
      setMedASocier("");
      ouvrirGestion(gestion.id); charger();
    } catch (e) { setErreur(e.message); }
  };

  const retirer = async (idMed) => {
    try {
      const res = await api.retirerMedicamentInteraction(gestion.id, idMed);
      setSparql(res.sparql);
      setMessage(`Médicament :${idMed} retiré de l'interaction`);
      ouvrirGestion(gestion.id); charger();
    } catch (e) { setErreur(e.message); }
  };

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6}>
          <CarteKpi label="Total interactions" valeur={liste.length} sousTitre="Classe :Interaction (minCardinality 2)"
            actif couleur={COULEUR} fond={COULEUR_FOND} icone={<CompareArrowsOutlinedIcon fontSize="small" />} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <CarteKpi label="Médicaments impactés" valeur={new Set(liste.flatMap((i) => (i.medicaments || "").split(", ").filter(Boolean))).size}
            sousTitre="Classe définie :MedicamentAInteraction" actif={false} couleur="#dc2626" fond="#fef2f2"
            icone={<ReportProblemOutlinedIcon fontSize="small" />} />
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small" placeholder="Rechercher par libellé..." value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#94a3b8", fontSize: 18 }} /></InputAdornment>,
              endAdornment: recherche && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setRecherche("")}><ClearIcon sx={{ fontSize: 16 }} /></IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 220, "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.8rem", bgcolor: "#f8fafc" } }}
          />
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => { setErreur(""); setFormulaire({ id: null, libelle: "", id_medicament_a: "", id_medicament_b: "" }); }}
            sx={{ bgcolor: COULEUR, "&:hover": { bgcolor: "#6c2410" }, textTransform: "none", fontWeight: 600, fontSize: "0.82rem", borderRadius: 2 }}
          >
            Nouvelle Interaction
          </Button>
        </Stack>
      </Paper>

      {erreur && !formulaire && !gestion && <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>{erreur}</Alert>}

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Libellé</TableCell>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Médicaments impliqués</TableCell>
              <TableCell align="right" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chargement && (<TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}><CircularProgress size={22} sx={{ color: COULEUR }} /></TableCell></TableRow>)}
            {!chargement && liste.length === 0 && (
              <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}><Typography variant="body2" color="#64748b">Aucune interaction ne correspond.</Typography></TableCell></TableRow>
            )}
            {!chargement && liste.map((i) => (
              <TableRow key={i.id} hover>
                <TableCell sx={{ py: 1.1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{i.libelle}</Typography>
                  <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "0.7rem" }}>:{i.id}</Typography>
                </TableCell>
                <TableCell sx={{ py: 1.1 }}>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {(i.medicaments || "").split(", ").filter(Boolean).map((idMed) => (
                      <Chip key={idMed} size="small" icon={<MedicationOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                        label={nomMed(idMed)} sx={{ bgcolor: COULEUR_FOND, color: COULEUR, fontSize: "0.72rem", height: 22 }} />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ py: 1.1 }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Gérer les médicaments impliqués">
                      <IconButton size="small" onClick={() => ouvrirGestion(i.id)} sx={{ color: COULEUR, bgcolor: COULEUR_FOND }}>
                        <SettingsOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Modifier le libellé">
                      <IconButton size="small" onClick={() => { setErreur(""); setFormulaire({ id: i.id, libelle: i.libelle }); }} sx={{ color: "#475569", bgcolor: "#f1f5f9" }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton size="small" onClick={() => setASupprimer(i)} sx={{ color: "#dc2626", bgcolor: "#fef2f2" }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog création / modification */}
      <Dialog open={!!formulaire} onClose={() => setFormulaire(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: COULEUR, color: "white", py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>
          {formulaire?.id ? `Modifier :${formulaire.id}` : "Nouvelle Interaction (INSERT DATA)"}
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, mt: 1 }}>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {erreur && <Alert severity="error" sx={{ py: 0.5, fontSize: "0.8rem", borderRadius: 2 }}>{erreur}</Alert>}
            <TextField label="Libellé" required fullWidth size="small" value={formulaire?.libelle ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, libelle: e.target.value })} />
            {!formulaire?.id && (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>Médicament A (requis)</InputLabel>
                  <Select value={formulaire?.id_medicament_a ?? ""} label="Médicament A (requis)"
                    onChange={(e) => setFormulaire({ ...formulaire, id_medicament_a: e.target.value })}>
                    {refMedicaments.map((m) => (<MenuItem key={m.id} value={m.id}>{m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Médicament B (requis)</InputLabel>
                  <Select value={formulaire?.id_medicament_b ?? ""} label="Médicament B (requis)"
                    onChange={(e) => setFormulaire({ ...formulaire, id_medicament_b: e.target.value })}>
                    {refMedicaments.map((m) => (<MenuItem key={m.id} value={m.id}>{m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}</MenuItem>))}
                  </Select>
                </FormControl>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setFormulaire(null)} sx={{ textTransform: "none", color: "#64748b" }}>Annuler</Button>
          <Button variant="contained" onClick={enregistrer} sx={{ bgcolor: COULEUR, "&:hover": { bgcolor: "#6c2410" }, textTransform: "none", fontWeight: 600, borderRadius: 2 }}>
            {formulaire?.id ? "Mettre à jour" : "Insérer dans Fuseki"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!aSupprimer} onClose={() => setASupprimer(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: "#dc2626", fontSize: "0.95rem", fontWeight: 600 }}>Confirmer la suppression ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.82rem" }}>
            Tous les triplets décrivant <strong>:{aSupprimer?.id}</strong> ({aSupprimer?.libelle}) ainsi que le lien symétrique <code>:interagitAvec</code> associé seront supprimés.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setASupprimer(null)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button color="error" variant="contained" onClick={supprimer} sx={{ textTransform: "none", fontWeight: 600 }}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog gestion des participants */}
      <Dialog open={!!gestion} onClose={() => setGestion(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>
          Médicaments impliqués dans :{gestion?.id} (<code>:impliqueMedicament</code>)
          <IconButton onClick={() => setGestion(null)} sx={{ position: "absolute", right: 10, top: 10 }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          {erreur && <Alert severity="error" sx={{ mb: 1.5, py: 0.5, fontSize: "0.8rem" }} onClose={() => setErreur("")}>{erreur}</Alert>}
          <Alert severity="info" sx={{ mb: 1.5, py: 0.5, fontSize: "0.78rem" }}>
            Axiome OWL : une interaction doit impliquer au moins 2 médicaments (minCardinality 2).
          </Alert>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {gestion?.medicaments?.map((m) => (
              <Paper key={m.id} elevation={0} sx={{ p: 1.25, px: 1.75, borderRadius: 2, border: "1px solid #f1f5f9", bgcolor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <MedicationOutlinedIcon sx={{ fontSize: 18, color: COULEUR }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>{m.nom ?? m.id}</Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.7rem" }}>:{m.id}</Typography>
                  </Box>
                </Stack>
                <Tooltip title="Retirer de l'interaction">
                  <IconButton size="small" onClick={() => retirer(m.id)} sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626" } }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Paper>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>Ajouter un médicament</InputLabel>
              <Select value={medASocier} label="Ajouter un médicament" onChange={(e) => setMedASocier(e.target.value)}>
                {refMedicaments.map((m) => (<MenuItem key={m.id} value={m.id}>{m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={associer} disabled={!medASocier} sx={{ bgcolor: COULEUR, textTransform: "none", whiteSpace: "nowrap" }}>Ajouter</Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGestion(null)} sx={{ textTransform: "none" }}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
