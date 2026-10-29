import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Divider
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../api.js';

/**
 * Le backend renvoie { data: { ...résultat }, sparql: "..." }.
 * Selon api.js, on peut recevoir :
 *   - la réponse axios  -> { data: { data: {...}, sparql } }
 *   - le corps JSON     -> { data: {...}, sparql }
 *   - déjà le résultat  -> { symptomes_detectes, ... }
 * Cette fonction retrouve toujours l'objet résultat.
 */
function extraireResultat(response) {
  let r = response;
  for (let i = 0; i < 3; i++) {
    if (r && typeof r === 'object' && 'symptomes_detectes' in r) return r;
    if (r && typeof r === 'object' && r.data !== undefined) r = r.data;
    else break;
  }
  return r;
}

export default function SymptomAnalyzer() {
  const [texte, setTexte] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyser = async () => {
    if (!texte.trim() || texte.length < 5) {
      setError("Veuillez entrer une description plus détaillée (min. 5 caractères).");
      return;
    }

    setLoading(true);
    setError(null);
    setResultat(null);

    try {
      const response = await api.analyserSymptomesNLP(texte);
      console.log("eeeeeeeeeeeeeee"+response);
      const res = extraireResultat(response);

      if (res?.erreur) {
        setError(res.erreur);
      } else {
        setResultat(res);
      }
    } catch (err) {
      setError(err.message || "Une erreur est survenue lors de la communication avec le serveur.");
    } finally {
      setLoading(false);
    }
  };

  const medicaments = resultat?.medicaments_risque ?? [];
  const symptomes = resultat?.symptomes_detectes ?? [];
  const nies = resultat?.symptomes_nies ?? [];

  return (
    <Card sx={{ mt: 4, boxShadow: 3 }}>
      <CardContent>
        <Typography variant="h5" color="primary" gutterBottom display="flex" alignItems="center" gap={1}>
          <SearchIcon /> Analyseur de Symptômes (NLP)
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          Décrivez les symptômes du patient pour vérifier s'ils correspondent à des effets secondaires connus de nos médicaments.
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          label="Description des symptômes"
          placeholder="Ex: Le patient prend un médicament et présente des difficultés respiratoires et un gonflement du visage..."
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleAnalyser}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
        >
          {loading ? 'Analyse en cours...' : 'Analyser le texte'}
        </Button>

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {resultat && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Résultats de l'analyse :
            </Typography>

            {resultat.alerte_urgence && (
              <Alert severity="error" icon={<WarningIcon fontSize="large" />} sx={{ mb: 3, fontWeight: 'bold' }}>
                URGENCE MÉDICALE : Les symptômes décrits (ex: difficultés respiratoires, gonflement) peuvent indiquer une réaction grave. Veuillez consulter un médecin ou appeler les urgences immédiatement.
              </Alert>
            )}

            {!resultat.alerte_urgence && resultat.alerte_grave && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Au moins un des symptômes identifiés correspond à un effet secondaire grave. Un avis médical est recommandé.
              </Alert>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Symptômes identifiés dans l'ontologie :
              </Typography>
              {symptomes.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {symptomes.map((symp, index) => (
                    <Chip key={index} label={symp} color="secondary" variant="outlined" />
                  ))}
                </Box>
              ) : (
                <Alert severity="info">
                  {resultat.message || "Aucun symptôme correspondant n'a été trouvé dans notre base de données."}
                </Alert>
              )}

              {nies.length > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Symptômes exclus (niés dans le texte) : {nies.join(', ')}
                </Typography>
              )}
            </Box>

            {medicaments.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Médicaments pouvant causer ces effets :
                </Typography>
                <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                  {medicaments.map((item, index) => (
                    <ListItem key={index} divider={index !== medicaments.length - 1}>
                      <ListItemText
                        primary={item.code_amm ? `${item.medicament} (${item.code_amm})` : item.medicament}
                        secondary={
                          `Lié au symptôme : ${item.symptome}` +
                          (item.frequence_pct != null ? ` — fréquence : ${item.frequence_pct} %` : '')
                        }
                      />
                      <Chip
                        label={item.est_grave ? "Effet Grave" : "Effet Bénin"}
                        color={item.est_grave ? "error" : "warning"}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3, fontStyle: 'italic' }}>
              Avertissement : Cet outil est une aide à la décision basée sur les données de l'ontologie. Il ne remplace en aucun cas un avis médical professionnel.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}